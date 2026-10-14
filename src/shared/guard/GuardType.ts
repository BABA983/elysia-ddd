/**
 * GuardType — 鉴权角色类型。
 */
export const GuardType = {
	ANONYMOUS: 'ANONYMOUS',
	AUTH_USER: 'AUTH_USER',
	ADMIN: 'ADMIN',
} as const;

export type GuardType = (typeof GuardType)[keyof typeof GuardType];
