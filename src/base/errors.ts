/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ErrorListenerCallback {
	(error: unknown): void;
}

export interface ErrorListenerUnbind {
	(): void;
}

// Avoid circular dependency on EventEmitter by implementing a subset of the interface.
export class ErrorHandler {
	private unexpectedErrorHandler: (e: unknown) => void;
	private listeners: ErrorListenerCallback[];

	constructor() {

		this.listeners = [];

		this.unexpectedErrorHandler = function (e: unknown) {
			setTimeout(() => {
				if (e instanceof Error) {
					// Same check as ErrorNoTelemetry.isErrorNoTelemetry (kept inline to avoid
					// the type predicate collapsing the else branch to `never`)
					if (e.name === 'CodeExpectedError') {
						throw new ErrorNoTelemetry(e.message + '\n\n' + e.stack);
					}

					throw new Error(e.message + '\n\n' + e.stack);
				}

				throw e;
			}, 0);
		};
	}

	addListener(listener: ErrorListenerCallback): ErrorListenerUnbind {
		this.listeners.push(listener);

		return () => {
			this._removeListener(listener);
		};
	}

	private emit(e: unknown): void {
		this.listeners.forEach((listener) => {
			listener(e);
		});
	}

	private _removeListener(listener: ErrorListenerCallback): void {
		this.listeners.splice(this.listeners.indexOf(listener), 1);
	}

	setUnexpectedErrorHandler(newUnexpectedErrorHandler: (e: unknown) => void): void {
		this.unexpectedErrorHandler = newUnexpectedErrorHandler;
	}

	getUnexpectedErrorHandler(): (e: unknown) => void {
		return this.unexpectedErrorHandler;
	}

	onUnexpectedError(e: unknown): void {
		this.unexpectedErrorHandler(e);
		this.emit(e);
	}

	// For external errors, we don't want the listeners to be called
	onUnexpectedExternalError(e: unknown): void {
		this.unexpectedErrorHandler(e);
	}
}

export const errorHandler = new ErrorHandler();

/** @skipMangle */
export function setUnexpectedErrorHandler(newUnexpectedErrorHandler: (e: unknown) => void): void {
	errorHandler.setUnexpectedErrorHandler(newUnexpectedErrorHandler);
}

/**
 * This function should only be called with errors that indicate a bug in the product.
 * E.g. buggy extensions/invalid user-input/network issues should not be able to trigger this code path.
 * If they are, this indicates there is also a bug in the product.
*/
export function onUnexpectedError(e: unknown): undefined {
	// ignore errors from cancelled promises
	if (!isCancellationError(e)) {
		errorHandler.onUnexpectedError(e);
	}
	return undefined;
}

export interface SerializedError {
	readonly $isError: true;
	readonly name: string;
	readonly message: string;
	readonly stack: string;
	readonly noTelemetry: boolean;
	readonly code?: string;
	readonly cause?: SerializedError;
}

type ErrorWithCode = Error & {
	code: string | undefined;
};

export function transformErrorForSerialization(error: Error): SerializedError;
export function transformErrorForSerialization(error: unknown): unknown;
export function transformErrorForSerialization(error: unknown): unknown {
	if (error instanceof Error) {
		const { name, message, cause } = error;
		const stack: string = (error as Error & { stacktrace?: string }).stacktrace || error.stack || '';
		return {
			$isError: true,
			name,
			message,
			stack,
			noTelemetry: ErrorNoTelemetry.isErrorNoTelemetry(error),
			cause: cause ? transformErrorForSerialization(cause) : undefined,
			code: (error as ErrorWithCode).code
		};
	}

	// return as is
	return error;
}

export function transformErrorFromSerialization(data: SerializedError): Error {
	let error: Error;
	if (data.noTelemetry) {
		error = new ErrorNoTelemetry();
	} else {
		error = new Error();
		error.name = data.name;
	}
	error.message = data.message;
	error.stack = data.stack;
	if (data.code) {
		(error as ErrorWithCode).code = data.code;
	}
	if (data.cause) {
		error.cause = transformErrorFromSerialization(data.cause);
	}
	return error;
}

export const canceledName = 'Canceled';

/**
 * Checks if the given error is a promise in canceled state
 */
export function isCancellationError(error: unknown): boolean {
	if (error instanceof CancellationError) {
		return true;
	}
	return error instanceof Error && error.name === canceledName && error.message === canceledName;
}

// !!!IMPORTANT!!!
// Do NOT change this class because it is also used as an API-type.
export class CancellationError extends Error {
	constructor() {
		super(canceledName);
		this.name = this.message;
	}
}

/**
 * @deprecated use {@link CancellationError `new CancellationError()`} instead
 */
export function canceled(): Error {
	const error = new Error(canceledName);
	error.name = error.message;
	return error;
}

export function illegalArgument(name?: string): Error {
	if (name) {
		return new Error(`Illegal argument: ${name}`);
	} else {
		return new Error('Illegal argument');
	}
}

export function illegalState(name?: string): Error {
	if (name) {
		return new Error(`Illegal state: ${name}`);
	} else {
		return new Error('Illegal state');
	}
}

export function getErrorMessage(err: unknown): string {
	if (!err) {
		return 'Error';
	}

	const maybeError = err as { message?: unknown; stack?: unknown };

	if (maybeError.message) {
		return String(maybeError.message);
	}

	if (maybeError.stack) {
		return String(maybeError.stack).split('\n')[0];
	}

	return String(err);
}

export class ExpectedError extends Error {
	readonly isExpected = true;
}

/**
 * Error that when thrown won't be logged in telemetry as an unhandled error.
 */
export class ErrorNoTelemetry extends Error {
	override readonly name: string;

	constructor(msg?: string) {
		super(msg);
		this.name = 'CodeExpectedError';
	}

	public static fromError(err: Error): ErrorNoTelemetry {
		if (err instanceof ErrorNoTelemetry) {
			return err;
		}

		const result = new ErrorNoTelemetry();
		result.message = err.message;
		result.stack = err.stack;
		return result;
	}

	public static isErrorNoTelemetry(err: Error): err is ErrorNoTelemetry {
		return err.name === 'CodeExpectedError';
	}
}

/**
 * This error indicates a bug.
 * Do not throw this for invalid user input.
 * Only catch this error to recover gracefully from bugs.
 */
export class BugIndicatingError extends Error {
	constructor(message?: string) {
		super(message || 'An unexpected bug occurred.');
		Object.setPrototypeOf(this, BugIndicatingError.prototype);

		// Because we know for sure only buggy code throws this,
		// we definitely want to break here and fix the bug.
		// debugger;
	}
}
