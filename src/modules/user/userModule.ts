/**
 * UserModule — 模块注册中心。
 * 对应 server-apps 的 UserModule.ts，但用 VS Code DI 的 ServiceCollection 替代 NestJS DynamicModule。
 * 只注册需要暴露给其他模块的服务（domainService + repository），usecase/assembler 留在模块内部。
 */

import { createDecorator, type ServiceIdentifier, type ServiceCollection } from '@/di/index.js';
import { UserRepository } from './domain/repository/UserRepository.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './domain/schema.js';

type DB = NodePgDatabase<typeof schema>;

// 服务标识符（同时兼作构造函数参数装饰器）
export const IUserRepository: ServiceIdentifier<UserRepository> = createDecorator<UserRepository>('userRepository');

/**
 * 注册 User 模块的所有服务到 ServiceCollection。
 * 类似 server-apps 的 UserModule.forRoot()。
 */
export function registerUserModule(services: ServiceCollection, db: DB): void {
	services.set(IUserRepository, new UserRepository(db));
}
