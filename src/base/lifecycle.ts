/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createSingleCallFunction } from './functional.js';
import { Iterable } from './iterator.js';
import { BugIndicatingError, onUnexpectedError } from './errors.js';

/**
 * An object that performs a cleanup operation when `.dispose()` is called.
 *
 * Some examples of how disposables are used:
 *
 * - An event listener that removes itself when `.dispose()` is called.
 * - A resource such as a file system watcher that cleans up the resource when `.dispose()` is called.
 * - The return value from registering a provider. When `.dispose()` is called, the provider is unregistered.
 */
export interface IDisposable {
	dispose(): void;
}

/**
 * Check if `thing` is {@link IDisposable disposable}.
 */
export function isDisposable<E>(thing: E): thing is E & IDisposable {
	return typeof thing === 'object' && thing !== null && typeof (thing as unknown as IDisposable).dispose === 'function' && (thing as unknown as IDisposable).dispose.length === 0;
}

/**
 * Disposes of the value(s) passed in.
 */
export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(disposable: T | undefined): T | undefined;
export function dispose<T extends IDisposable, A extends Iterable<T> = Iterable<T>>(disposables: A): A;
export function dispose<T extends IDisposable>(disposables: Array<T>): Array<T>;
export function dispose<T extends IDisposable>(disposables: ReadonlyArray<T>): ReadonlyArray<T>;
export function dispose<T extends IDisposable>(arg: T | Iterable<T> | undefined): unknown {
	if (Iterable.is(arg)) {
		const errors: unknown[] = [];

		for (const d of arg) {
			if (d) {
				try {
					d.dispose();
				} catch (e) {
					errors.push(e);
				}
			}
		}

		if (errors.length === 1) {
			throw errors[0];
		} else if (errors.length > 1) {
			throw new AggregateError(errors, 'Encountered errors while disposing of store');
		}

		return Array.isArray(arg) ? [] : arg;
	} else if (arg) {
		arg.dispose();
		return arg;
	}
}

export function disposeIfDisposable<T extends IDisposable | object>(disposables: Array<T>): Array<T> {
	for (const d of disposables) {
		if (isDisposable(d)) {
			d.dispose();
		}
	}
	return [];
}

/**
 * Combine multiple disposable values into a single {@link IDisposable}.
 */
export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
	return toDisposable(() => dispose(disposables));
}

class FunctionDisposable implements IDisposable {
	private _isDisposed: boolean;
	private readonly _fn: () => void;

	constructor(fn: () => void) {
		this._isDisposed = false;
		this._fn = fn;
	}

	dispose() {
		if (this._isDisposed) {
			return;
		}
		if (!this._fn) {
			throw new Error(`Unbound disposable context: Need to use an arrow function to preserve the value of this`);
		}
		this._isDisposed = true;
		this._fn();
	}
}

/**
 * Turn a function that implements dispose into an {@link IDisposable}.
 *
 * @param fn Clean up function, guaranteed to be called only **once**.
 */
export function toDisposable(fn: () => void): IDisposable {
	return new FunctionDisposable(fn);
}

/**
 * Manages a collection of disposable values.
 *
 * This is the preferred way to manage multiple disposables. A `DisposableStore` is safer to work with than an
 * `IDisposable[]` as it considers edge cases, such as registering the same value multiple times or adding an item to a
 * store that has already been disposed of.
 */
export class DisposableStore implements IDisposable {

	static DISABLE_DISPOSED_WARNING = false;

	private readonly _toDispose = new Set<IDisposable>();
	private _isDisposed = false;

	/**
	 * Dispose of all registered disposables and mark this object as disposed.
	 *
	 * Any future disposables added to this object will be disposed of on `add`.
	 */
	public dispose(): void {
		if (this._isDisposed) {
			return;
		}

		this._isDisposed = true;
		this.clear();
	}

	/**
	 * @return `true` if this object has been disposed of.
	 */
	public get isDisposed(): boolean {
		return this._isDisposed;
	}

	/**
	 * Dispose of all registered disposables but do not mark this object as disposed.
	 */
	public clear(): void {
		if (this._toDispose.size === 0) {
			return;
		}

		try {
			dispose(this._toDispose);
		} finally {
			this._toDispose.clear();
		}
	}

	/**
	 * Add a new {@link IDisposable disposable} to the collection.
	 */
	public add<T extends IDisposable>(o: T): T {
		if (!o || o === Disposable.None) {
			return o;
		}
		if ((o as unknown as DisposableStore) === this) {
			throw new Error('Cannot register a disposable on itself!');
		}

		if (this._isDisposed) {
			if (!DisposableStore.DISABLE_DISPOSED_WARNING) {
				console.warn(new Error('Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!').stack);
			}
		} else {
			this._toDispose.add(o);
		}

		return o;
	}

	/**
	 * Deletes a disposable from store and disposes of it. This will not throw or warn and proceed to dispose the
	 * disposable even when the disposable is not part in the store.
	 */
	public delete<T extends IDisposable>(o: T): void {
		if (!o) {
			return;
		}
		if ((o as unknown as DisposableStore) === this) {
			throw new Error('Cannot dispose a disposable on itself!');
		}
		this._toDispose.delete(o);
		o.dispose();
	}

	/**
	 * Deletes the value from the store, but does not dispose it.
	 */
	public deleteAndLeak<T extends IDisposable>(o: T): void {
		if (!o) {
			return;
		}
		this._toDispose.delete(o);
	}

	public assertNotDisposed(): void {
		if (this._isDisposed) {
			onUnexpectedError(new BugIndicatingError('Object disposed'));
		}
	}
}

/**
 * Abstract base class for a {@link IDisposable disposable} object.
 *
 * Subclasses can {@linkcode _register} disposables that will be automatically cleaned up when this object is disposed of.
 */
export abstract class Disposable implements IDisposable {

	/**
	 * A disposable that does nothing when it is disposed of.
	 *
	 * TODO: This should not be a static property.
	 */
	static readonly None = Object.freeze<IDisposable>({ dispose() { } });

	protected readonly _store = new DisposableStore();

	public dispose(): void {
		this._store.dispose();
	}

	/**
	 * Adds `o` to the collection of disposables managed by this object.
	 */
	protected _register<T extends IDisposable>(o: T): T {
		if ((o as unknown as Disposable) === this) {
			throw new Error('Cannot register a disposable on itself!');
		}
		return this._store.add(o);
	}
}

/**
 * Manages the lifecycle of a disposable value that may be changed.
 *
 * This ensures that when the disposable value is changed, the previously held disposable is disposed of. You can
 * also register a `MutableDisposable` on a `Disposable` to ensure it is automatically cleaned up.
 */
export class MutableDisposable<T extends IDisposable> implements IDisposable {
	private _value?: T;
	private _isDisposed = false;

	/**
	 * Get the currently held disposable value, or `undefined` if this MutableDisposable has been disposed
	 */
	get value(): T | undefined {
		return this._isDisposed ? undefined : this._value;
	}

	/**
	 * Set a new disposable value.
	 *
	 * Behaviour:
	 * - If the MutableDisposable has been disposed, the setter is a no-op.
	 * - If the new value is strictly equal to the current value, the setter is a no-op.
	 * - Otherwise the previous value (if any) is disposed and the new value is stored.
	 *
	 * Related helpers:
	 * - clear() resets the value to `undefined` (and disposes the previous value).
	 * - clearAndLeak() returns the old value without disposing it and removes its parent.
	 */
	set value(value: T | undefined) {
		if (this._isDisposed || value === this._value) {
			return;
		}

		this._value?.dispose();
		this._value = value;
	}

	/**
	 * Resets the stored value and disposed of the previously stored value.
	 */
	clear(): void {
		this.value = undefined;
	}

	dispose(): void {
		this._isDisposed = true;
		this._value?.dispose();
		this._value = undefined;
	}

	/**
	 * Clears the value, but does not dispose it.
	 * The old value is returned.
	*/
	clearAndLeak(): T | undefined {
		const oldValue = this._value;
		this._value = undefined;
		return oldValue;
	}
}

/**
 * Manages the lifecycle of a disposable value that may be changed like {@link MutableDisposable}, but the value must
 * exist and cannot be undefined.
 */
export class MandatoryMutableDisposable<T extends IDisposable> implements IDisposable {
	private readonly _disposable = new MutableDisposable<T>();
	private _isDisposed = false;

	constructor(initialValue: T) {
		this._disposable.value = initialValue;
	}

	get value(): T {
		return this._disposable.value!;
	}

	set value(value: T) {
		if (this._isDisposed || value === this._disposable.value) {
			return;
		}
		this._disposable.value = value;
	}

	dispose() {
		this._isDisposed = true;
		this._disposable.dispose();
	}
}

export class RefCountedDisposable {

	private _counter: number = 1;

	constructor(
		private readonly _disposable: IDisposable,
	) { }

	acquire() {
		this._counter++;
		return this;
	}

	release() {
		if (--this._counter === 0) {
			this._disposable.dispose();
		}
		return this;
	}
}

export interface IReference<T> extends IDisposable {
	readonly object: T;
}

export abstract class ReferenceCollection<T> {

	private readonly references: Map<string, { readonly object: T; counter: number }> = new Map();

	acquire(key: string, ...args: unknown[]): IReference<T> {
		let reference = this.references.get(key);

		if (!reference) {
			reference = { counter: 0, object: this.createReferencedObject(key, ...args) };
			this.references.set(key, reference);
		}

		const { object } = reference;
		const dispose = createSingleCallFunction(() => {
			if (--reference.counter === 0) {
				this.destroyReferencedObject(key, reference.object);
				this.references.delete(key);
			}
		});

		reference.counter++;

		return { object, dispose };
	}

	protected abstract createReferencedObject(key: string, ...args: unknown[]): T;
	protected abstract destroyReferencedObject(key: string, object: T): void;
}

/**
 * Unwraps a reference collection of promised values. Makes sure
 * references are disposed whenever promises get rejected.
 */
export class AsyncReferenceCollection<T> {

	constructor(private referenceCollection: ReferenceCollection<Promise<T>>) { }

	async acquire(key: string, ...args: unknown[]): Promise<IReference<T>> {
		const ref = this.referenceCollection.acquire(key, ...args);

		try {
			const object = await ref.object;

			return {
				object,
				dispose: () => ref.dispose()
			};
		} catch (error) {
			ref.dispose();
			throw error;
		}
	}
}

export class ImmortalReference<T> implements IReference<T> {
	constructor(public object: T) { }
	dispose(): void { /* noop */ }
}

export function disposeOnReturn(fn: (store: DisposableStore) => void): void {
	const store = new DisposableStore();
	try {
		fn(store);
	} finally {
		store.dispose();
	}
}

/**
 * A map the manages the lifecycle of the values that it stores.
 */
export class DisposableMap<K, V extends IDisposable = IDisposable> implements IDisposable {

	private readonly _store: Map<K, V>;
	private _isDisposed = false;

	constructor(store: Map<K, V> = new Map<K, V>()) {
		this._store = store;
	}

	/**
	 * Disposes of all stored values and mark this object as disposed.
	 *
	 * Trying to use this object after it has been disposed of is an error.
	 */
	dispose(): void {
		this._isDisposed = true;
		this.clearAndDisposeAll();
	}

	/**
	 * Disposes of all stored values and clear the map, but DO NOT mark this object as disposed.
	 */
	clearAndDisposeAll(): void {
		if (!this._store.size) {
			return;
		}

		try {
			dispose(this._store.values());
		} finally {
			this._store.clear();
		}
	}

	has(key: K): boolean {
		return this._store.has(key);
	}

	get size(): number {
		return this._store.size;
	}

	get(key: K): V | undefined {
		return this._store.get(key);
	}

	set(key: K, value: V, skipDisposeOnOverwrite = false): void {
		if (this._isDisposed) {
			console.warn(new Error('Trying to add a disposable to a DisposableMap that has already been disposed of. The added object will be leaked!').stack);
		}

		if (!skipDisposeOnOverwrite) {
			this._store.get(key)?.dispose();
		}

		this._store.set(key, value);
	}

	/**
	 * Delete the value stored for `key` from this map and also dispose of it.
	 */
	deleteAndDispose(key: K): void {
		this._store.get(key)?.dispose();
		this._store.delete(key);
	}

	/**
	 * Delete the value stored for `key` from this map but return it. The caller is
	 * responsible for disposing of the value.
	 */
	deleteAndLeak(key: K): V | undefined {
		const value = this._store.get(key);
		this._store.delete(key);
		return value;
	}

	keys(): IterableIterator<K> {
		return this._store.keys();
	}

	values(): IterableIterator<V> {
		return this._store.values();
	}

	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this._store[Symbol.iterator]();
	}
}

/**
 * A set that manages the lifecycle of the values that it stores.
 */
export class DisposableSet<V extends IDisposable = IDisposable> implements IDisposable {

	private readonly _store: Set<V>;
	private _isDisposed = false;

	constructor(store: Set<V> = new Set<V>()) {
		this._store = store;
	}

	/**
	 * Disposes of all stored values and mark this object as disposed.
	 *
	 * Trying to use this object after it has been disposed of is an error.
	 */
	dispose(): void {
		this._isDisposed = true;
		this.clearAndDisposeAll();
	}

	/**
	 * Disposes of all stored values and clear the set, but DO NOT mark this object as disposed.
	 */
	clearAndDisposeAll(): void {
		if (!this._store.size) {
			return;
		}

		try {
			dispose(this._store.values());
		} finally {
			this._store.clear();
		}
	}

	has(value: V): boolean {
		return this._store.has(value);
	}

	get size(): number {
		return this._store.size;
	}

	add(value: V): void {
		if (this._isDisposed) {
			console.warn(new Error('Trying to add a disposable to a DisposableSet that has already been disposed of. The added object will be leaked!').stack);
		}

		this._store.add(value);
	}

	/**
	 * Delete the value from this set and also dispose of it.
	 */
	deleteAndDispose(value: V): void {
		if (this._store.delete(value)) {
			value.dispose();
		}
	}

	/**
	 * Delete the value from this set but return it. The caller is
	 * responsible for disposing of the value.
	 */
	deleteAndLeak(value: V): V | undefined {
		if (this._store.delete(value)) {
			return value;
		}
		return undefined;
	}

	values(): IterableIterator<V> {
		return this._store.values();
	}

	[Symbol.iterator](): IterableIterator<V> {
		return this._store[Symbol.iterator]();
	}
}

/**
 * Call `then` on a Promise, unless the returned disposable is disposed.
 */
export function thenIfNotDisposed<T>(promise: Promise<T>, then: (result: T) => void): IDisposable {
	let disposed = false;
	promise.then(result => {
		if (disposed) {
			return;
		}
		then(result);
	});
	return toDisposable(() => {
		disposed = true;
	});
}

/**
 * Call `then` on a promise that resolves to a {@link IDisposable}, then either register the
 * disposable or register it to the {@link DisposableStore}, depending on whether the store is
 * disposed or not.
 */
export function thenRegisterOrDispose<T extends IDisposable>(promise: Promise<T>, store: DisposableStore): Promise<T> {
	return promise.then(disposable => {
		if (store.isDisposed) {
			disposable.dispose();
		} else {
			store.add(disposable);
		}
		return disposable;
	});
}
