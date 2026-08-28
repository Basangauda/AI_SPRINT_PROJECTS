import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRow } from "@/lib/types/user";

vi.mock("server-only", () => ({}));

const mockRun = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn(() => ({ run: mockRun, all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, all: mockAll }));
const mockDb = { prepare: mockPrepare };

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (password: string) => `$2a$10$hashed_${password}`),
  verifyPassword: vi.fn(),
}));

import {
  ConflictError,
  createUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  listUsers,
  updateUser,
} from "@/lib/services/user-service";

const sampleRow: UserRow = {
  id: "user-1",
  first_name: "Jane",
  last_name: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group_name: "Science",
  password_hash: "$2a$10$hashed_SecurePass123",
};

const createInput = {
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
  password: "SecurePass123",
};

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a user and returns a public user without password_hash", async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [sampleRow] });
    mockRun.mockResolvedValueOnce({ success: true });

    const user = await createUser(createInput);

    expect(user).toEqual({
      id: "user-1",
      firstName: "Jane",
      lastName: "Smith",
      username: "jsmith",
      email: "jane.smith@school.edu",
      group: "Science",
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(mockRun).toHaveBeenCalled();
  });

  it("throws ConflictError when username already exists", async () => {
    mockAll.mockResolvedValueOnce({ results: [sampleRow] });

    await expect(createUser(createInput)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConflictError &&
        error.message === "Username already taken"
    );
  });

  it("throws ConflictError when email already exists", async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [sampleRow] });

    await expect(createUser(createInput)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConflictError && error.message === "Email already taken"
    );
  });
});

describe("getUserById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a public user when found", async () => {
    mockAll.mockResolvedValueOnce({ results: [sampleRow] });

    const user = await getUserById("user-1");

    expect(user?.username).toBe("jsmith");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("returns null when not found", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    expect(await getUserById("missing")).toBeNull();
  });
});

describe("getUserByUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a user with password hash for login lookup", async () => {
    mockAll.mockResolvedValueOnce({ results: [sampleRow] });

    const user = await getUserByUsername("jsmith");

    expect(user?.passwordHash).toBe("$2a$10$hashed_SecurePass123");
  });
});

describe("getUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a user with password hash for login lookup", async () => {
    mockAll.mockResolvedValueOnce({ results: [sampleRow] });

    const user = await getUserByEmail("jane.smith@school.edu");

    expect(user?.passwordHash).toBe("$2a$10$hashed_SecurePass123");
  });
});

describe("updateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates fields and returns a public user", async () => {
    const updatedRow: UserRow = {
      ...sampleRow,
      first_name: "Janet",
    };

    mockAll
      .mockResolvedValueOnce({ results: [sampleRow] })
      .mockResolvedValueOnce({ results: [updatedRow] });
    mockRun.mockResolvedValueOnce({ success: true });

    const user = await updateUser("user-1", { firstName: "Janet" });

    expect(user.firstName).toBe("Janet");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("re-hashes the password when a new password is provided", async () => {
    const updatedRow: UserRow = {
      ...sampleRow,
      password_hash: "$2a$10$hashed_NewPass12345",
    };

    mockAll
      .mockResolvedValueOnce({ results: [sampleRow] })
      .mockResolvedValueOnce({ results: [updatedRow] });
    mockRun.mockResolvedValueOnce({ success: true });

    await updateUser("user-1", { password: "NewPass12345" });

    expect(mockBind).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      "$2a$10$hashed_NewPass12345",
      "user-1"
    );
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the user row", async () => {
    mockRun.mockResolvedValueOnce({ success: true });

    await deleteUser("user-1");

    expect(mockPrepare).toHaveBeenCalledWith(
      "DELETE FROM users WHERE id = ?1"
    );
    expect(mockBind).toHaveBeenCalledWith("user-1");
  });
});

describe("listUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns users without password hashes", async () => {
    mockAll.mockResolvedValueOnce({ results: [sampleRow] });

    const users = await listUsers();

    expect(users).toHaveLength(1);
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(users[0].username).toBe("jsmith");
  });
});
