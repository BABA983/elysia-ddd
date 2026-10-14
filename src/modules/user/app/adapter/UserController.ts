/**
 * Adapter — HTTP 路由，Elysia route handler。
 * 对应 server-apps 的 UserController，但用 Elysia 链式 API 替代 @Controller 装饰器。
 */

import { Elysia } from 'elysia';
import { RequestState } from '@/shared/guard/requestState.js';
import type { InstantiationService } from '@/di/instantiationService.js';
import { IUserRepository } from '../../userModule.js';
import { FindUserOrFailService, RegisterUserService } from '../../domain/service/UserDomainService.js';
import { UserAssembler } from '../assembler/UserAssembler.js';
import { GetUserUsecase, ListUsersUsecase, RegisterUserUsecase } from '../usecase/UserUsecase.js';
import { CreateUserDto } from '../../client/dto/UserDto.js';

function extractRequestState(headers: Headers): RequestState {
	const userId = Number(headers.get('x-user-id') ?? '0');
	const requestId = headers.get('x-request-id') ?? crypto.randomUUID();
	const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
	return new RequestState(userId, requestId, ip);
}

export function userRoutes(instantiation: InstantiationService) {
	const repo = instantiation.invokeFunction(a => a.get(IUserRepository));
	const findUserOrFail = new FindUserOrFailService(repo);
	const registerService = new RegisterUserService(repo);
	const assembler = new UserAssembler();
	const getUserUsecase = new GetUserUsecase(findUserOrFail, assembler);
	const listUsersUsecase = new ListUsersUsecase(repo, assembler);
	const registerUserUsecase = new RegisterUserUsecase(registerService, assembler);

	return new Elysia({ name: 'routes.user' })
		.get('/users', () => listUsersUsecase.execute())
		.get('/users/me', ({ request }) => {
			const requestState = extractRequestState(request.headers);
			return getUserUsecase.me(requestState);
		})
		.get('/users/:id', ({ request, params }) => {
			const requestState = extractRequestState(request.headers);
			return getUserUsecase.byId(requestState, Number(params.id));
		})
		.post('/users', ({ body }) => registerUserUsecase.execute(body), {
			body: CreateUserDto,
		});
}
