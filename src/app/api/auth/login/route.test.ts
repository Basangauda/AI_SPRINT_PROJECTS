import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/services/user-service", () => ({
  getUserByUsername: vi.fn(),
  getUserByEmail: vi.fn(),
}));

import { verifyPassword } from "@/lib/password";
import {
  getUserByEmail,
  getUserByUsername,
} from "@/lib/services/user-service";
import { POST } from "./route";

const sampleUserWithHash = {
  id: "user-1",
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
  passwordHash: "$2a$10$hashed",
};

function postLogin(body: unknown) {
  return POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and user for valid credentials", async () => {
    vi.mocked(getUserByUsername).mockResolvedValueOnce(sampleUserWithHash);
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const response = await postLogin({
      username: "jsmith",
      password: "SecurePass123",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({
      id: "user-1",
      firstName: "Jane",
      lastName: "Smith",
      username: "jsmith",
      email: "jane.smith@school.edu",
      group: "Science",
    });
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 with a generic error for an unknown user", async () => {
    vi.mocked(getUserByUsername).mockResolvedValueOnce(null);
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);

    const response = await postLogin({
      username: "unknown",
      password: "SecurePass123",
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid username or password");
  });

  it("returns 401 with the same generic error for a wrong password", async () => {
    vi.mocked(getUserByUsername).mockResolvedValueOnce(sampleUserWithHash);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const response = await postLogin({
      username: "jsmith",
      password: "WrongPassword",
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid username or password");
  });

  it("returns 400 for an invalid body", async () => {
    const response = await postLogin({ username: "jsmith" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("allows login using an email in the username field", async () => {
    vi.mocked(getUserByUsername).mockResolvedValueOnce(null);
    vi.mocked(getUserByEmail).mockResolvedValueOnce(sampleUserWithHash);
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const response = await postLogin({
      username: "jane.smith@school.edu",
      password: "SecurePass123",
    });

    expect(response.status).toBe(200);
    expect(getUserByEmail).toHaveBeenCalledWith("jane.smith@school.edu");
  });
});
