import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/services/user-service", () => ({
  ConflictError: class ConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConflictError";
    }
  },
  createUser: vi.fn(),
}));

import { ConflictError, createUser } from "@/lib/services/user-service";
import { POST } from "./route";

const sampleUser = {
  id: "user-1",
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
};

const validBody = {
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
  password: "SecurePass123",
};

function postRegister(body: unknown) {
  return POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 and user without password fields for a valid body", async () => {
    vi.mocked(createUser).mockResolvedValueOnce(sampleUser);

    const response = await postRegister(validBody);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user).toEqual(sampleUser);
    expect(body.user).not.toHaveProperty("password");
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(createUser).toHaveBeenCalledWith(validBody);
  });

  it("returns 400 with validation details for an invalid body", async () => {
    const response = await postRegister({ username: "jsmith" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when username or email already exists", async () => {
    vi.mocked(createUser).mockRejectedValueOnce(
      new ConflictError("Username already taken")
    );

    const response = await postRegister(validBody);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("Username already taken");
  });
});
