/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Given a function, returns a function that is only calling that function once.
 */
export function createSingleCallFunction<T extends (...args: unknown[]) => unknown>(this: unknown, fn: T, fnDidRunCallback?: () => void): T {
	const _this = this;
	let didCall = false;
	let result: unknown;

	return function (...args: unknown[]) {
		if (didCall) {
			return result;
		}

		didCall = true;
		if (fnDidRunCallback) {
			try {
				result = fn.apply(_this, args);
			} finally {
				fnDidRunCallback();
			}
		} else {
			result = fn.apply(_this, args);
		}

		return result;
	} as unknown as T;
}
