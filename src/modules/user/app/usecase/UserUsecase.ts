/**
 * Usecase — 应用层编排，调用领域服务，组装响应。
 * 对应 server-apps 的 GetCurrentUserUsecase 等。
 */

import type { RequestState } from '@/shared/guard/requestState.js';
import { Response, type SingleResponse, type MultiResponse } from '@/shared/dto/index.js';
import type { UserResponseDto, CreateUserDto } from '../../client/dto/UserDto.js';
import type { UserRepository } from '../../domain/repository/UserRepository.js';
import type { FindUserOrFailService, RegisterUserService } from '../../domain/service/UserDomainService.js';
import type { UserAssembler } from '../assembler/UserAssembler.js';

export class GetUserUsecase {
	constructor(
		private readonly findUserOrFail: FindUserOrFailService,
		private readonly assembler: UserAssembler,
	) {}

	async byId(requestState: RequestState, id: number): Promise<SingleResponse<UserResponseDto>> {
		const entity = await this.findUserOrFail.byId(id);
		return Response.ok(this.assembler.toResponse(entity));
	}

	async me(requestState: RequestState): Promise<SingleResponse<UserResponseDto>> {
		const entity = await this.findUserOrFail.byId(requestState.userId);
		return Response.ok(this.assembler.toResponse(entity));
	}
}

export class ListUsersUsecase {
	constructor(
		private readonly repo: UserRepository,
		private readonly assembler: UserAssembler,
	) {}

	async execute(): Promise<MultiResponse<UserResponseDto>> {
		const entities = await this.repo.findActive();
		return Response.okList(this.assembler.toResponseList(entities));
	}
}

export class RegisterUserUsecase {
	constructor(
		private readonly registerService: RegisterUserService,
		private readonly assembler: UserAssembler,
	) {}

	async execute(dto: CreateUserDto): Promise<SingleResponse<UserResponseDto>> {
		const entity = await this.registerService.execute(dto.username, dto.email);
		return Response.ok(this.assembler.toResponse(entity));
	}
}
