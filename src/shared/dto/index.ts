/**
 * 统一响应体 — 提取自 pango 包，简化版。
 */

export interface SingleResponse<T> {
	code: number;
	message: string;
	data: T;
}

export interface MultiResponse<T> {
	code: number;
	message: string;
	data: T[];
}

export interface PageResponse<T> {
	code: number;
	message: string;
	data: T[];
	total: number;
	page: number;
	pageSize: number;
}

export interface PageQuery {
	page?: number;
	pageSize?: number;
}

export const Response = {
	ok<T>(data: T): SingleResponse<T> {
		return { code: 0, message: 'ok', data };
	},
	okList<T>(data: T[]): MultiResponse<T> {
		return { code: 0, message: 'ok', data };
	},
	okPage<T>(data: T[], total: number, page: number, pageSize: number): PageResponse<T> {
		return { code: 0, message: 'ok', data, total, page, pageSize };
	},
	error(code: number, message: string): SingleResponse<null> {
		return { code, message, data: null };
	},
};
