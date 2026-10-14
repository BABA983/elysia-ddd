/**
 * DTO — 请求/响应数据结构。
 * 对应 server-apps 的 CreateUserDto、UserRegisterDto。
 * 用 Elysia 的 t.Object 做运行时验证，替代 class-validator。
 */

import { t } from 'elysia';

export const CreateUserDto = t.Object({
	username: t.String({ minLength: 1, maxLength: 100 }),
	email: t.String({ format: 'email' }),
});

export type CreateUserDto = typeof CreateUserDto.static;

export const UpdateUserDto = t.Object({
	username: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	email: t.Optional(t.String({ format: 'email' })),
});

export type UpdateUserDto = typeof UpdateUserDto.static;

export const UserResponseDto = t.Object({
	id: t.Number(),
	username: t.String(),
	email: t.String(),
	status: t.String(),
	allowDeviceCount: t.Number(),
});

export type UserResponseDto = typeof UserResponseDto.static;
