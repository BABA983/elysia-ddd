/**
 * authGuard — Elysia guard plugin，替代 NestJS 的 @Roles + RolesGuard。
 * 用法: new Elysia().use(authGuard(GuardType.AUTH_USER)).get(...)
 */

import { Elysia, t } from 'elysia';
import { GuardType } from './GuardType.js';

export function authGuard(...allowedRoles: GuardType[]) {
	return new Elysia({ name: `guard-${allowedRoles.join('-')}` })
		.derive(({ request, set }) => {
			const role = (request.headers.get('x-user-role') as GuardType | null) ?? GuardType.ANONYMOUS;

			if (!allowedRoles.includes(role)) {
				set.status = 401;
				return {
					role,
					authorized: false,
					error: { code: 'UNAUTHORIZED', message: `Requires role: ${allowedRoles.join(' or ')}` },
				};
			}

			return { role, authorized: true };
		})
		.guard({
			response: t.Union([
				t.Unknown(),
				t.Object({ code: t.String(), message: t.String() }),
			]),
		});
}
