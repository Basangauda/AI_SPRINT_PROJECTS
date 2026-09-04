import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const USERS_REQUIRED_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "username",
  "email",
  "group_name",
  "password_hash",
] as const;

const MCQS_REQUIRED_COLUMNS = [
  "id",
  "name",
  "question",
  "created_at",
  "updated_at",
] as const;

const MCQ_CHOICES_REQUIRED_COLUMNS = [
  "id",
  "mcq_id",
  "choice",
  "is_correct",
  "created_at",
  "updated_at",
] as const;

const MCQ_ATTEMPTS_REQUIRED_COLUMNS = [
  "id",
  "mcq_id",
  "user_id",
  "choice_id",
  "is_correct",
  "created_at",
] as const;

function readMigrationSql(matcher: (filename: string) => boolean): string {
  const migrationsDir = join(process.cwd(), "migrations");
  const migrationFile = readdirSync(migrationsDir).find(
    (file) => file.endsWith(".sql") && matcher(file)
  );

  if (!migrationFile) {
    throw new Error("No matching migration SQL file found in migrations/");
  }

  return readFileSync(join(migrationsDir, migrationFile), "utf8");
}

function readUsersMigrationSql(): string {
  return readMigrationSql((file) => file.includes("users"));
}

function readMcqMigrationSql(): string {
  return readMigrationSql((file) => file.includes("mcq"));
}

describe("users table migration schema", () => {
  it("creates a users table with required columns", () => {
    const sql = readUsersMigrationSql();

    expect(sql).toMatch(/CREATE TABLE\s+users\s*\(/i);

    for (const column of USERS_REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }
  });

  it("enforces unique username and email", () => {
    const sql = readUsersMigrationSql();

    expect(sql).toMatch(/username\s+\w+\s+NOT NULL UNIQUE/i);
    expect(sql).toMatch(/email\s+\w+\s+NOT NULL UNIQUE/i);
  });
});

describe("mcq tables migration schema", () => {
  it("creates mcqs table with required columns", () => {
    const sql = readMcqMigrationSql();

    expect(sql).toMatch(/CREATE TABLE\s+mcqs\s*\(/i);

    for (const column of MCQS_REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }
  });

  it("creates mcq_choices table with required columns and foreign key", () => {
    const sql = readMcqMigrationSql();

    expect(sql).toMatch(/CREATE TABLE\s+mcq_choices\s*\(/i);

    for (const column of MCQ_CHOICES_REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }

    expect(sql).toMatch(
      /FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)/i
    );
    expect(sql).toMatch(/ON DELETE CASCADE/i);
  });

  it("creates mcq_attempts table with required columns and foreign keys", () => {
    const sql = readMcqMigrationSql();

    expect(sql).toMatch(/CREATE TABLE\s+mcq_attempts\s*\(/i);

    for (const column of MCQ_ATTEMPTS_REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }

    expect(sql).toMatch(
      /FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)/i
    );
    expect(sql).toMatch(
      /FOREIGN KEY\s*\(\s*user_id\s*\)\s*REFERENCES\s+users\s*\(\s*id\s*\)/i
    );
    expect(sql).toMatch(
      /FOREIGN KEY\s*\(\s*choice_id\s*\)\s*REFERENCES\s+mcq_choices\s*\(\s*id\s*\)/i
    );
  });

  it("creates indexes on mcq_id and user_id", () => {
    const sql = readMcqMigrationSql();

    expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_choices_mcq_id/i);
    expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_attempts_mcq_id/i);
    expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_attempts_user_id/i);
  });
});
