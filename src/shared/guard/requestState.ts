/**
 * RequestState — 请求级状态，替代 NestJS 的 @RequestStateDecorator。
 * 通过 Elysia derive 注入到每个请求的 context。
 */

import { Elysia } from 'elysia';

export class RequestState {
	readonly userId: number;
	readonly requestId: string;
	readonly ip: string;

	constructor(userId: number, requestId: string, ip: string) {
		this.userId = userId;
		this.requestId = requestId;
		this.ip = ip;
	}
}

export const requestStatePlugin = new Elysia({ name: 'request-state' })
	.derive(({ request }) => {
		const userId = Number(request.headers.get('x-user-id') ?? '0');
		const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
		const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

		return { requestState: new RequestState(userId, requestId, ip) };
	});
