import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
} from "@/lib/validators/user";

const validRegistration = {
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
  password: "SecurePass123",
};

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse(validRegistration);

    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const incomplete = {
      firstName: validRegistration.firstName,
      lastName: validRegistration.lastName,
      username: validRegistration.username,
      email: validRegistration.email,
      group: validRegistration.group,
    };
    const result = registerSchema.safeParse(incomplete);

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects usernames with invalid characters", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      username: "invalid user!",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts username and password", () => {
    const result = loginSchema.safeParse({
      username: "jsmith",
      password: "SecurePass123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty fields", () => {
    const result = loginSchema.safeParse({
      username: "",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("allows partial updates", () => {
    const result = updateUserSchema.safeParse({
      firstName: "Janet",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters when provided", () => {
    const result = updateUserSchema.safeParse({
      password: "short",
    });

    expect(result.success).toBe(false);
  });
});
