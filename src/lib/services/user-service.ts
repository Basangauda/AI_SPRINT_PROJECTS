import "server-only";

import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserRow,
  UserWithHash,
} from "@/lib/types/user";
import { userWithoutPassword } from "@/lib/types/user";

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    email: row.email,
    group: row.group_name,
  };
}

function toUserWithHash(row: UserRow): UserWithHash {
  return {
    ...toPublicUser(row),
    passwordHash: row.password_hash,
  };
}

const PUBLIC_USER_COLUMNS =
  "id, first_name, last_name, username, email, group_name";

const USER_WITH_HASH_COLUMNS = `${PUBLIC_USER_COLUMNS}, password_hash`;

export async function createUser(input: CreateUserInput): Promise<User> {
  const existingUsername = await getUserByUsername(input.username);
  if (existingUsername) {
    throw new ConflictError("Username already taken");
  }

  const existingEmail = await getUserByEmail(input.email);
  if (existingEmail) {
    throw new ConflictError("Email already taken");
  }

  const passwordHash = await hashPassword(input.password);
  const db = getDb();

  await db
    .prepare(
      `INSERT INTO users (first_name, last_name, username, email, group_name, password_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(
      input.firstName,
      input.lastName,
      input.username,
      input.email,
      input.group,
      passwordHash
    )
    .run();

  const created = await getUserByUsername(input.username);
  if (!created) {
    throw new Error("Failed to create user");
  }

  return userWithoutPassword(created);
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?1`)
    .bind(id)
    .all<UserRow>();

  const row = results[0];
  return row ? toPublicUser(row) : null;
}

export async function getUserByUsername(
  username: string
): Promise<UserWithHash | null> {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT ${USER_WITH_HASH_COLUMNS} FROM users WHERE username = ?1`)
    .bind(username)
    .all<UserRow>();

  const row = results[0];
  return row ? toUserWithHash(row) : null;
}

export async function getUserByEmail(
  email: string
): Promise<UserWithHash | null> {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT ${USER_WITH_HASH_COLUMNS} FROM users WHERE email = ?1`)
    .bind(email)
    .all<UserRow>();

  const row = results[0];
  return row ? toUserWithHash(row) : null;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<User> {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT ${USER_WITH_HASH_COLUMNS} FROM users WHERE id = ?1`)
    .bind(id)
    .all<UserRow>();

  const existing = results[0];
  if (!existing) {
    throw new NotFoundError("User not found");
  }

  if (input.username && input.username !== existing.username) {
    const duplicate = await getUserByUsername(input.username);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError("Username already taken");
    }
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await getUserByEmail(input.email);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError("Email already taken");
    }
  }

  const firstName = input.firstName ?? existing.first_name;
  const lastName = input.lastName ?? existing.last_name;
  const username = input.username ?? existing.username;
  const email = input.email ?? existing.email;
  const group = input.group ?? existing.group_name;
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : existing.password_hash;

  await db
    .prepare(
      `UPDATE users
       SET first_name = ?1,
           last_name = ?2,
           username = ?3,
           email = ?4,
           group_name = ?5,
           password_hash = ?6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?7`
    )
    .bind(firstName, lastName, username, email, group, passwordHash, id)
    .run();

  const updated = await getUserById(id);
  if (!updated) {
    throw new Error("Failed to update user");
  }

  return updated;
}

export async function deleteUser(id: string): Promise<void> {
  const db = getDb();
  await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
}

export async function listUsers(): Promise<User[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users ORDER BY created_at ASC`
    )
    .all<UserRow>();

  return results.map(toPublicUser);
}
