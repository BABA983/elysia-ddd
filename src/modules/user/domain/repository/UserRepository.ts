/**
 * UserRepository — Data Mapper 仓储。
 * 封装所有 Drizzle 调用，返回领域实体而非原始行。
 * 对应 server-apps 的 UserRepository，但不继承 MikroORM EntityRepository。
 */

import { eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, type UserRow } from '../schema.js';
import { UserEntity } from '../entity/UserEntity.js';

type Schema = typeof import('../schema.js');
type DB = NodePgDatabase<Schema>;

export class UserRepository {
	constructor(private readonly db: DB) {}

	async findById(id: number): Promise<UserEntity | null> {
		const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
		return row ? UserEntity.fromRecord(row) : null;
	}

	async findByEmail(email: string): Promise<UserEntity | null> {
		const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
		return row ? UserEntity.fromRecord(row) : null;
	}

	async findActive(): Promise<UserEntity[]> {
		const rows = await this.db.select().from(users).where(isNull(users.deletedAt));
		return rows.map(row => UserEntity.fromRecord(row));
	}

	async save(entity: UserEntity): Promise<UserEntity> {
		if (entity.id === 0) {
			const [row] = await this.db.insert(users).values(entity.toRecord()).returning();
			return UserEntity.fromRecord(row as UserRow);
		}
		const [row] = await this.db
			.update(users)
			.set(entity.toUpdateRecord())
			.where(eq(users.id, entity.id))
			.returning();
		return UserEntity.fromRecord(row as UserRow);
	}

	async softDelete(id: number): Promise<void> {
		await this.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
	}
}
