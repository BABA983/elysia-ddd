/**
 * UserEntity — 充血领域实体（Rich Domain Model）。
 * 不继承 ORM 基类，不知道如何持久化自己。
 * 通过 fromRecord / toRecord 在 DB 行和领域实体之间转换。
 */

import type { UserRow, NewUserRow } from '../schema.js';

export type UserStatus = 'active' | 'inactive' | 'banned';

export class UserEntity {
	private constructor(
		readonly id: number,
		readonly username: string,
		readonly email: string,
		private _status: UserStatus,
		private _allowDeviceCount: number,
		readonly createdAt: Date,
		readonly updatedAt: Date,
	) {}

	// ---- 工厂方法 ----

	static fromRecord(row: UserRow): UserEntity {
		return new UserEntity(
			row.id,
			row.username,
			row.email,
			row.status as UserStatus,
			row.allowDeviceCount,
			row.createdAt,
			row.updatedAt,
		);
	}

	static create(username: string, email: string): UserEntity {
		const now = new Date();
		return new UserEntity(0, username, email, 'active', 1, now, now);
	}

	// ---- 领域行为 ----

	get status(): UserStatus {
		return this._status;
	}

	get allowDeviceCount(): number {
		return this._allowDeviceCount;
	}

	canLogin(): boolean {
		return this._status === 'active';
	}

	deactivate(): void {
		this._status = 'inactive';
	}

	ban(): void {
		this._status = 'banned';
		this._allowDeviceCount = 0;
	}

	incrementDeviceCount(max = 10): void {
		if (this._allowDeviceCount >= max) {
			throw new Error('Device count already at maximum');
		}
		this._allowDeviceCount++;
	}

	// ---- 持久化转换 ----

	toRecord(): NewUserRow {
		return {
			username: this.username,
			email: this.email,
			status: this._status,
			allowDeviceCount: this._allowDeviceCount,
		};
	}

	toUpdateRecord(): Partial<UserRow> {
		return {
			username: this.username,
			email: this.email,
			status: this._status,
			allowDeviceCount: this._allowDeviceCount,
			updatedAt: new Date(),
		};
	}
}
