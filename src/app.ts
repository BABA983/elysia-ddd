/**
 * App bootstrap — 两阶段初始化。
 * 阶段 1（同步）：创建 ServiceCollection，注册所有服务标识符。
 * 阶段 2（异步）：显式调用需要 IO 的服务的 initialize()。
 * 对应 VS Code 的 createServices() + initServices()。
 */

import { InstantiationService, ServiceCollection, createDecorator, type ServiceIdentifier } from '@/di/index.js';
import { DatabaseService } from './modules/user/domain/DatabaseService.js';
import { registerUserModule } from './modules/user/userModule.js';

// 全局服务标识符
export const IDatabaseService: ServiceIdentifier<DatabaseService> = createDecorator<DatabaseService>('databaseService');

export async function createApp(): Promise<InstantiationService> {
	const dbUrl = Bun.env.DATABASE_URL ?? 'postgres://localhost:5432/elysia_ddd';

	// ── 阶段 1：createServices（同步注册）──
	const services = new ServiceCollection();
	const dbService = new DatabaseService(dbUrl);
	services.set(IDatabaseService, dbService);

	const instantiation = new InstantiationService(services);

	// ── 阶段 2：initServices（异步初始化）──
	await dbService.initialize();
	registerUserModule(services, dbService.db);

	return instantiation;
}
