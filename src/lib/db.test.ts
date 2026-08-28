import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockDb = { prepare: vi.fn() };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: { DB: mockDb },
  })),
}));

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";

describe("getDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the D1 binding from getCloudflareContext", () => {
    const db = getDb();

    expect(getCloudflareContext).toHaveBeenCalled();
    expect(db).toBe(mockDb);
  });

  it("throws when the DB binding is missing", () => {
    vi.mocked(getCloudflareContext).mockReturnValueOnce({
      env: {},
    } as ReturnType<typeof getCloudflareContext>);

    expect(() => getDb()).toThrow("DB binding is not configured");
  });
});
