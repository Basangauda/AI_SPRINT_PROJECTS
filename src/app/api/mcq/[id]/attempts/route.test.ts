import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/services/mcq-service", () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BadRequestError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
  createAttempt: vi.fn(),
}));

import {
  BadRequestError,
  createAttempt,
  NotFoundError,
} from "@/lib/services/mcq-service";
import { POST } from "./route";

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postAttempt(mcqId: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/mcq/${mcqId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    routeContext(mcqId)
  );
}

describe("POST /api/mcq/[id]/attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 and isCorrect true for a correct attempt", async () => {
    vi.mocked(createAttempt).mockResolvedValueOnce({
      id: "attempt-1",
      mcqId: "mcq-1",
      userId: "user-1",
      choiceId: "choice-2",
      isCorrect: true,
      createdAt: "2026-09-04 12:00:00",
    });

    const response = await postAttempt("mcq-1", {
      userId: "user-1",
      choiceId: "choice-2",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.attempt.isCorrect).toBe(true);
    expect(createAttempt).toHaveBeenCalledWith("mcq-1", {
      userId: "user-1",
      choiceId: "choice-2",
    });
  });

  it("returns 201 and isCorrect false for an incorrect attempt", async () => {
    vi.mocked(createAttempt).mockResolvedValueOnce({
      id: "attempt-1",
      mcqId: "mcq-1",
      userId: "user-1",
      choiceId: "choice-1",
      isCorrect: false,
      createdAt: "2026-09-04 12:00:00",
    });

    const response = await postAttempt("mcq-1", {
      userId: "user-1",
      choiceId: "choice-1",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.attempt.isCorrect).toBe(false);
  });

  it("returns 400 when the choice does not belong to the MCQ", async () => {
    vi.mocked(createAttempt).mockRejectedValueOnce(
      new BadRequestError("Choice does not belong to this MCQ")
    );

    const response = await postAttempt("mcq-1", {
      userId: "user-1",
      choiceId: "choice-9",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Choice does not belong to this MCQ");
  });

  it("returns 404 when the user is not found", async () => {
    vi.mocked(createAttempt).mockRejectedValueOnce(
      new NotFoundError("User not found")
    );

    const response = await postAttempt("mcq-1", {
      userId: "missing",
      choiceId: "choice-1",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("User not found");
  });

  it("returns 404 when the MCQ is not found", async () => {
    vi.mocked(createAttempt).mockRejectedValueOnce(
      new NotFoundError("MCQ not found")
    );

    const response = await postAttempt("missing", {
      userId: "user-1",
      choiceId: "choice-1",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("MCQ not found");
  });

  it("returns 400 for an invalid body", async () => {
    const response = await postAttempt("mcq-1", { userId: "user-1" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(createAttempt).not.toHaveBeenCalled();
  });
});
