/**
 * Elysia HTTP 层 + DI 桥接。
 * 通过 decorate 把 InstantiationService 放入 Elysia context。
 */

import { Elysia } from 'elysia';
import { createApp } from './app.js';
import { userRoutes } from './modules/user/app/adapter/UserController.js';

async function main() {
	const instantiation = await createApp();

	const app = new Elysia()
		.decorate('instantiation', instantiation)
		.use(userRoutes(instantiation))
		.get('/health', () => ({ status: 'ok' }))
		.onStart(({ server }) => {
			console.log(`🚀 Running at http://${server?.hostname}:${server?.port}`);
		})
		.listen(3000);

	const shutdown = () => {
		console.log('\n🛑 Shutting down...');
		app.stop();
		instantiation.dispose();
		process.exit(0);
	};

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
}

main();
