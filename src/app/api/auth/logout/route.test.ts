import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("returns 200 with a success message", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/logout", { method: "POST" })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Logged out successfully");
  });
});
