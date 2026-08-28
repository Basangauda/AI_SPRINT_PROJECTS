import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "username",
  "email",
  "group_name",
  "password_hash",
] as const;

function readUsersMigrationSql(): string {
  const migrationsDir = join(process.cwd(), "migrations");
  const migrationFile = readdirSync(migrationsDir).find(
    (file) => file.endsWith(".sql") && !file.includes(".test.")
  );

  if (!migrationFile) {
    throw new Error("No migration SQL file found in migrations/");
  }

  return readFileSync(join(migrationsDir, migrationFile), "utf8");
}

describe("users table migration schema", () => {
  it("creates a users table with required columns", () => {
    const sql = readUsersMigrationSql();

    expect(sql).toMatch(/CREATE TABLE\s+users\s*\(/i);

    for (const column of REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }
  });

  it("enforces unique username and email", () => {
    const sql = readUsersMigrationSql();

    expect(sql).toMatch(/username\s+\w+\s+NOT NULL UNIQUE/i);
    expect(sql).toMatch(/email\s+\w+\s+NOT NULL UNIQUE/i);
  });
});
