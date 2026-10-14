/**
 * DatabaseService — 两阶段初始化模式。
 * 构造函数同步（只存配置），initialize() 异步（建连接池）。
 * 对应 server-apps 的 ConfigurationService.initialize()。
 */

import { Disposable } from '@/base/lifecycle.js';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export class DatabaseService extends Disposable {
	declare readonly _serviceBrand: undefined;

	private _db: Database | null = null;
	private _pool: Pool | null = null;

	constructor(
		private readonly url: string,
	) {
		super();
	}

	async initialize(): Promise<void> {
		this._pool = new Pool({ connectionString: this.url });
		this._db = drizzle(this._pool, { schema });
	}

	get db(): Database {
		if (!this._db) {
			throw new Error('DatabaseService not initialized. Call initialize() first.');
		}
		return this._db;
	}

	dispose(): void {
		this._pool?.end();
		super.dispose();
	}
}
