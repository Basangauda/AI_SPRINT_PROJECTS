import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("returns a bcrypt hash different from the plaintext", async () => {
    const plain = "SecurePass123";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("produces a hash that verifyPassword accepts for the same plaintext", async () => {
    const plain = "SecurePass123";
    const hash = await hashPassword(plain);

    expect(await verifyPassword(plain, hash)).toBe(true);
  });
});

describe("verifyPassword", () => {
  it("returns false for a wrong password", async () => {
    const hash = await hashPassword("SecurePass123");

    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });
});
