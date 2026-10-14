/**
 * ServiceCollection — 服务注册容器。
 * 提取自 VS Code src/vs/platform/instantiation/common/serviceCollection.ts，原样。
 */

import type { ServiceIdentifier } from './instantiation.js';
import { SyncDescriptor } from './descriptors.js';

export class ServiceCollection {
	private readonly _entries = new Map<ServiceIdentifier<unknown>, unknown>();

	constructor(...entries: [ServiceIdentifier<unknown>, unknown][]) {
		for (const [id, service] of entries) {
			this.set(id, service);
		}
	}

	set<T>(id: ServiceIdentifier<T>, instanceOrDescriptor: T | SyncDescriptor<T>): T | SyncDescriptor<T> {
		const result = this._entries.get(id);
		this._entries.set(id, instanceOrDescriptor);
		return result as T | SyncDescriptor<T>;
	}

	has(id: ServiceIdentifier<unknown>): boolean {
		return this._entries.has(id);
	}

	get<T>(id: ServiceIdentifier<T>): T | SyncDescriptor<T> | undefined {
		return this._entries.get(id) as T | SyncDescriptor<T> | undefined;
	}
}
