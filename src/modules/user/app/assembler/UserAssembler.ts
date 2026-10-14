/**
 * Assembler — Entity ↔ DTO 转换。
 * 对应 server-apps 的 UserAssembler。
 */

import type { UserEntity } from '../../domain/entity/UserEntity.js';
import type { UserResponseDto } from '../../client/dto/UserDto.js';

export class UserAssembler {
	toResponse(entity: UserEntity): UserResponseDto {
		return {
			id: entity.id,
			username: entity.username,
			email: entity.email,
			status: entity.status,
			allowDeviceCount: entity.allowDeviceCount,
		};
	}

	toResponseList(entities: UserEntity[]): UserResponseDto[] {
		return entities.map(e => this.toResponse(e));
	}
}
