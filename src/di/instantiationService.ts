/**
 * InstantiationService — DI 容器核心。
 * 提取自 VS Code src/vs/platform/instantiation/common/instantiationService.ts，去掉了 tracing 和 delayed instantiation（Proxy 懒加载），保留同步实例化核心。
 */

import { DisposableStore, dispose, IDisposable, isDisposable } from '../base/lifecycle.js';
import { SyncDescriptor } from './descriptors.js';
import { Graph } from './graph.js';
import {
	type ServiceIdentifier,
	type ServicesAccessor,
	_util,
	createDecorator,
} from './instantiation.js';
import { ServiceCollection } from './serviceCollection.js';

class CyclicDependencyError<T> extends Error {
	constructor(graph: Graph<T>) {
		const cycle = graph.findCycleSlow() ?? 'UNKNOWN';
		super(`[InstantiationService] cyclic dependency detected: ${cycle}`);
	}
}

// 服务标识符定义在本文件底部，这里提取其类型用于 implements
type IInstantiationServiceInstance = { _serviceBrand: undefined; dispose(): void; };

export class InstantiationService implements IInstantiationServiceInstance {
	declare readonly _serviceBrand: undefined;

	private _isDisposed = false;
	private readonly _servicesToMaybeDispose = new Set<unknown>();
	private readonly _children = new Set<InstantiationService>();
	private readonly _activeInstantiations = new Set<ServiceIdentifier<unknown>>();

	constructor(
		private readonly _services: ServiceCollection = new ServiceCollection(),
		private readonly _strict = false,
		private readonly _parent?: InstantiationService,
	) {
		this._services.set(IInstantiationService, this);
	}

	dispose(): void {
		if (!this._isDisposed) {
			this._isDisposed = true;
			dispose(this._children);
			this._children.clear();

			for (const candidate of this._servicesToMaybeDispose) {
				if (isDisposable(candidate)) {
					(candidate as IDisposable).dispose();
				}
			}
			this._servicesToMaybeDispose.clear();
		}
	}

	createChild(services: ServiceCollection, store?: DisposableStore): InstantiationService {
		if (this._isDisposed) {
			throw new Error('InstantiationService has been disposed');
		}

		const that = this;
		const result = new class extends InstantiationService {
			override dispose(): void {
				that._children.delete(result);
				super.dispose();
			}
		}(services, this._strict, this);

		this._children.add(result);
		store?.add(result);
		return result;
	}

	invokeFunction<R, TS extends unknown[] = []>(
		fn: (accessor: ServicesAccessor, ...args: TS) => R,
		...args: TS
	): R {
		if (this._isDisposed) {
			throw new Error('InstantiationService has been disposed');
		}

		let done = false;
		const accessor: ServicesAccessor = {
			get: <T>(id: ServiceIdentifier<T>): T => {
				if (done) {
					throw new Error('service accessor is only valid during the invocation of its target method');
				}
				const result = this._getOrCreateServiceInstance(id);
				if (!result) {
					throw new Error(`[invokeFunction] unknown service '${String(id)}'`);
				}
				return result;
			},
		};
		try {
			return fn(accessor, ...args);
		} finally {
			done = true;
		}
	}

	createInstance<T>(ctor: new (...args: unknown[]) => T, ...args: unknown[]): T {
		if (this._isDisposed) {
			throw new Error('InstantiationService has been disposed');
		}
		return this._createInstance(ctor, args);
	}

	private _createInstance<T>(ctor: new (...args: unknown[]) => T, args: unknown[] = []): T {
		const serviceDependencies = _util.getServiceDependencies(ctor as unknown as _util.DI_TARGET_OBJ)
			.sort((a, b) => a.index - b.index);

		const serviceArgs: unknown[] = [];
		for (const dependency of serviceDependencies) {
			const service = this._getOrCreateServiceInstance(dependency.id);
			if (!service) {
				throw new Error(`[createInstance] ${ctor.name} depends on UNKNOWN service ${String(dependency.id)}.`);
			}
			serviceArgs.push(service);
		}

		const firstServiceArgPos = serviceDependencies.length > 0 ? serviceDependencies[0].index : args.length;

		if (args.length !== firstServiceArgPos) {
			const delta = firstServiceArgPos - args.length;
			if (delta > 0) {
				args = args.concat(new Array(delta));
			} else {
				args = args.slice(0, firstServiceArgPos);
			}
		}

		return Reflect.construct(ctor, args.concat(serviceArgs));
	}

	private _setCreatedServiceInstance<T>(id: ServiceIdentifier<T>, instance: T): void {
		if (this._services.get(id) instanceof SyncDescriptor) {
			this._services.set(id, instance);
		} else if (this._parent) {
			this._parent._setCreatedServiceInstance(id, instance);
		} else {
			throw new Error('illegalState - setting UNKNOWN service instance');
		}
	}

	private _getServiceInstanceOrDescriptor<T>(id: ServiceIdentifier<T>): T | SyncDescriptor<T> | undefined {
		const instanceOrDesc = this._services.get(id);
		if (!instanceOrDesc && this._parent) {
			return this._parent._getServiceInstanceOrDescriptor(id);
		}
		return instanceOrDesc as T | SyncDescriptor<T> | undefined;
	}

	private _getOrCreateServiceInstance<T>(id: ServiceIdentifier<T>): T | undefined {
		const thing = this._getServiceInstanceOrDescriptor(id);
		if (thing instanceof SyncDescriptor) {
			return this._safeCreateAndCacheServiceInstance(id, thing);
		}
		return thing as T | undefined;
	}

	private _safeCreateAndCacheServiceInstance<T>(id: ServiceIdentifier<T>, desc: SyncDescriptor<T>): T {
		if (this._activeInstantiations.has(id)) {
			throw new Error(`illegal state - RECURSIVELY instantiating service '${String(id)}'`);
		}
		this._activeInstantiations.add(id);
		try {
			return this._createAndCacheServiceInstance(id, desc);
		} finally {
			this._activeInstantiations.delete(id);
		}
	}

	private _createAndCacheServiceInstance<T>(id: ServiceIdentifier<T>, desc: SyncDescriptor<T>): T {
		type Triple = { id: ServiceIdentifier<unknown>; desc: SyncDescriptor<unknown> };
		const graph = new Graph<Triple>(data => String(data.id));

		let cycleCount = 0;
		const stack: Triple[] = [{ id, desc }];
		const seen = new Set<string>();

		while (stack.length) {
			const item = stack.pop()!;

			if (seen.has(String(item.id))) {
				continue;
			}
			seen.add(String(item.id));

			graph.lookupOrInsertNode(item);

			if (cycleCount++ > 1000) {
				throw new CyclicDependencyError(graph);
			}

			for (const dependency of _util.getServiceDependencies(item.desc.ctor as unknown as _util.DI_TARGET_OBJ)) {
				const instanceOrDesc = this._getServiceInstanceOrDescriptor(dependency.id);
				if (!instanceOrDesc) {
					throw new Error(`[createInstance] ${String(item.id)} depends on ${String(dependency.id)} which is NOT registered.`);
				}

				if (instanceOrDesc instanceof SyncDescriptor) {
					const d: Triple = { id: dependency.id, desc: instanceOrDesc };
					graph.insertEdge(item, d);
					stack.push(d);
				}
			}
		}

		while (true) {
			const roots = graph.roots();

			if (roots.length === 0) {
				if (!graph.isEmpty()) {
					throw new CyclicDependencyError(graph);
				}
				break;
			}

			for (const { data } of roots) {
				const instanceOrDesc = this._getServiceInstanceOrDescriptor(data.id);
				if (instanceOrDesc instanceof SyncDescriptor) {
					const instance = this._createServiceInstanceWithOwner(
						data.id,
						data.desc.ctor,
						data.desc.staticArguments,
					);
					this._setCreatedServiceInstance(data.id, instance);
				}
				graph.removeNode(data);
			}
		}

		return this._getServiceInstanceOrDescriptor(id) as T;
	}

	private _createServiceInstanceWithOwner<T>(
		id: ServiceIdentifier<T>,
		ctor: new (...args: unknown[]) => T,
		args: unknown[] = [],
	): T {
		if (this._services.get(id) instanceof SyncDescriptor) {
			const result = this._createInstance(ctor, args);
			this._servicesToMaybeDispose.add(result);
			return result;
		} else if (this._parent) {
			return this._parent._createServiceInstanceWithOwner(id, ctor, args);
		} else {
			throw new Error(`illegalState - creating UNKNOWN service instance ${ctor.name}`);
		}
	}
}

export const IInstantiationService: ServiceIdentifier<InstantiationService> = createDecorator<InstantiationService>('instantiationService');
