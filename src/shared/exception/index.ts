/**
 * 异常体系 — 提取自 pango 包，简化版。
 */

export class BaseException extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly extra?: Record<string, unknown>,
		readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class BizException extends BaseException {
	private static readonly DEFAULT_CODE = 'BIZ_ERROR';

	constructor(message: string, code?: string, extra?: Record<string, unknown>, cause?: Error) {
		super(message, code ?? BizException.DEFAULT_CODE, extra, cause);
	}
}

export class SysException extends BaseException {
	private static readonly DEFAULT_CODE = 'SYS_ERROR';

	constructor(message: string, code?: string, extra?: Record<string, unknown>, cause?: Error) {
		super(message, code ?? SysException.DEFAULT_CODE, extra, cause);
	}
}

export const ExceptionFactory = {
	bizException(message: string, code?: string, extra?: Record<string, unknown>, cause?: Error): BizException {
		return new BizException(message, code, extra, cause);
	},
	sysException(message: string, code?: string, extra?: Record<string, unknown>, cause?: Error): SysException {
		return new SysException(message, code, extra, cause);
	},
};
