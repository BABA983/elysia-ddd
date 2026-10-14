/**
 * SyncDescriptor — 懒加载服务描述符。
 * 提取自 VS Code src/vs/platform/instantiation/common/descriptors.ts，原样。
 */

export class SyncDescriptor<T> {
	readonly ctor: new (...args: unknown[]) => T;
	readonly staticArguments: unknown[];
	readonly supportsDelayedInstantiation: boolean;

	constructor(
		ctor: new (...args: unknown[]) => T,
		staticArguments: unknown[] = [],
		supportsDelayedInstantiation = false,
	) {
		this.ctor = ctor;
		this.staticArguments = staticArguments;
		this.supportsDelayedInstantiation = supportsDelayedInstantiation;
	}
}

export interface SyncDescriptor0<T> {
	readonly ctor: new () => T;
}
