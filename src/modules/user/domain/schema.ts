/**
 * Drizzle schema — 纯数据定义，无装饰器。
 * 对应 server-apps 的 @Entity 装饰器，但 Drizzle 用函数式 schema。
 */

import { pgTable, serial, varchar, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: varchar('username', { length: 100 }).notNull(),
	email: varchar('email', { length: 255 }).notNull(),
	status: varchar('status', { length: 20 }).notNull().default('active'),
	allowDeviceCount: integer('allow_device_count').notNull().default(1),
	deletedAt: timestamp('deleted_at'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** 查询结果类型 */
export type UserRow = typeof users.$inferSelect;

/** 插入参数类型 */
export type NewUserRow = typeof users.$inferInsert;
