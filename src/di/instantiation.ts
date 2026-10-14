/**
 * DI 核心接口和装饰器。
 * 提取自 VS Code src/vs/platform/instantiation/common/instantiation.ts，去掉了 tracing。
 */

import type { DisposableStore } from '../base/lifecycle.js';
import type { ServiceCollection } from './serviceCollection.js';

export namespace _util {
	export const serviceIds = new Map<string, ServiceIdentifier<unknown>>();

	export const DI_TARGET = '$di$target';
	export const DI_DEPENDENCIES = '$di$dependencies';

	export interface DependencyEntry {
		id: ServiceIdentifier<unknown>;
		index: number;
	}

	export interface DI_TARGET_OBJ extends Function {
		[DI_TARGET]: Function;
		[DI_DEPENDENCIES]: DependencyEntry[];
	}

	export function getServiceDependencies(ctor: DI_TARGET_OBJ): DependencyEntry[] {
		return ctor[DI_DEPENDENCIES] ?? [];
	}
}

export type BrandedService = { _serviceBrand: undefined };

export interface IConstructorSignature<T, Args extends unknown[] = []> {
	new <Services extends BrandedService[]>(...args: [...Args, ...Services]): T;
}

export interface ServicesAccessor {
	get<T>(id: ServiceIdentifier<T>): T;
}

/**
 * Identifies a service of type `T`.
 */
export interface ServiceIdentifier<T> {
	(...args: unknown[]): void;
	type: T;
}

export interface IInstantiationService {
	readonly _serviceBrand: undefined;

	createInstance<T>(ctor: new (...args: unknown[]) => T, ...args: unknown[]): T;

	invokeFunction<R, TS extends unknown[] = []>(
		fn: (accessor: ServicesAccessor, ...args: TS) => R,
		...args: TS
	): R;

	createChild(services: ServiceCollection, store?: DisposableStore): IInstantiationService;

	dispose(): void;
}

/**
 * Given a list of arguments as a tuple, attempt to extract the leading, non-service arguments
 * to their own tuple.
 */
export type GetLeadingNonServiceArgs<TArgs extends unknown[]> =
	TArgs extends [] ? []
	: TArgs extends [...infer TFirst, BrandedService] ? GetLeadingNonServiceArgs<TFirst>
	: TArgs;

function storeServiceDependency(
	id: ServiceIdentifier<unknown>,
	target: Function,
	index: number,
): void {
	const obj = target as _util.DI_TARGET_OBJ;
	if (obj[_util.DI_TARGET] === target) {
		obj[_util.DI_DEPENDENCIES].push({ id, index });
	} else {
		obj[_util.DI_DEPENDENCIES] = [{ id, index }];
		obj[_util.DI_TARGET] = target;
	}
}

/**
 * The *only* valid way to create a ServiceIdentifier.
 * Use as a constructor parameter decorator: `constructor(@IMyService svc: MyService)`.
 */
export function createDecorator<T>(serviceId: string): ServiceIdentifier<T> {
	if (_util.serviceIds.has(serviceId)) {
		return _util.serviceIds.get(serviceId) as ServiceIdentifier<T>;
	}

	const id = function (target: Function, _key: string | symbol, index: number): void {
		if (arguments.length !== 3) {
			throw new Error('@ServiceIdentifier decorator can only be used to decorate a parameter');
		}
		storeServiceDependency(id, target, index);
	} as ServiceIdentifier<T>;

	id.toString = () => serviceId;

	_util.serviceIds.set(serviceId, id);
	return id;
}

/**
 * Refine a service decorator to a more specific type.
 * Useful when a service is registered as an interface but consumed as a concrete class.
 */
export function refineServiceDecorator<T1, T extends T1>(
	serviceIdentifier: ServiceIdentifier<T1>,
): ServiceIdentifier<T> {
	return serviceIdentifier as ServiceIdentifier<T>;
}
