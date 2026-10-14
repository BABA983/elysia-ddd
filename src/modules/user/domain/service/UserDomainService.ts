/**
 * 领域服务 — 原子业务操作，不含编排逻辑。
 * 对应 server-apps 的 FindUserByIdService 等。
 * 只有有实际业务逻辑的才建类；薄包装直接用 Repository。
 */
import { ExceptionFactory } from '@/shared/exception/index.js';
import { UserEntity } from '../entity/UserEntity.js';
import type { UserRepository } from '../repository/UserRepository.js';

/** 获取用户或抛异常 */
export class FindUserOrFailService {
	constructor(private readonly repo: UserRepository) {}

	async byId(id: number): Promise<UserEntity> {
		const user = await this.repo.findById(id);
		if (!user) {
			throw ExceptionFactory.bizException('User not found', 'USER_NOT_FOUND');
		}
		return user;
	}

	async byEmail(email: string): Promise<UserEntity> {
		const user = await this.repo.findByEmail(email);
		if (!user) {
			throw ExceptionFactory.bizException('User not found', 'USER_NOT_FOUND');
		}
		return user;
	}
}

/** 注册领域服务 — 包含业务规则校验 */
export class RegisterUserService {
	constructor(private readonly repo: UserRepository) {}

	async execute(username: string, email: string): Promise<UserEntity> {
		const existing = await this.repo.findByEmail(email);
		if (existing) {
			throw ExceptionFactory.bizException('Email already registered', 'EMAIL_DUPLICATE');
		}
		const entity = UserEntity.create(username, email);
		return this.repo.save(entity);
	}
}
