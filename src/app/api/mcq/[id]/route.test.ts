import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/services/mcq-service", () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
  deleteMcq: vi.fn(),
  getMcqById: vi.fn(),
  updateMcq: vi.fn(),
}));

import { deleteMcq, getMcqById, NotFoundError, updateMcq } from "@/lib/services/mcq-service";
import { DELETE, GET, PUT } from "./route";

const sampleMcq = {
  id: "mcq-1",
  name: "Photosynthesis basics",
  question: "Which organelle carries out photosynthesis?",
  choices: [
    { id: "choice-1", choice: "Mitochondria", isCorrect: false },
    { id: "choice-2", choice: "Chloroplast", isCorrect: true },
  ],
  createdAt: "2026-09-04 10:00:00",
  updatedAt: "2026-09-04 10:00:00",
};

const validBody = {
  name: sampleMcq.name,
  question: sampleMcq.question,
  choices: [
    { choice: "Mitochondria", isCorrect: false },
    { choice: "Chloroplast", isCorrect: true },
  ],
};

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function putMcq(id: string, body: unknown) {
  return PUT(
    new Request(`http://localhost/api/mcq/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    routeContext(id)
  );
}

describe("GET /api/mcq/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and the MCQ when found", async () => {
    vi.mocked(getMcqById).mockResolvedValueOnce(sampleMcq);

    const response = await GET(
      new Request("http://localhost/api/mcq/mcq-1"),
      routeContext("mcq-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mcq).toEqual(sampleMcq);
  });

  it("returns 404 when the MCQ is not found", async () => {
    vi.mocked(getMcqById).mockResolvedValueOnce(null);

    const response = await GET(
      new Request("http://localhost/api/mcq/missing"),
      routeContext("missing")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("MCQ not found");
  });
});

describe("PUT /api/mcq/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and the updated MCQ for a valid body", async () => {
    vi.mocked(updateMcq).mockResolvedValueOnce(sampleMcq);

    const response = await putMcq("mcq-1", validBody);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mcq).toEqual(sampleMcq);
    expect(updateMcq).toHaveBeenCalledWith("mcq-1", validBody);
  });

  it("returns 404 when the MCQ is not found", async () => {
    vi.mocked(updateMcq).mockRejectedValueOnce(new NotFoundError("MCQ not found"));

    const response = await putMcq("missing", validBody);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("MCQ not found");
  });

  it("returns 400 for an invalid body", async () => {
    const response = await putMcq("mcq-1", { name: "Only name" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(updateMcq).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/mcq/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when the MCQ is deleted", async () => {
    vi.mocked(deleteMcq).mockResolvedValueOnce(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/mcq/mcq-1", { method: "DELETE" }),
      routeContext("mcq-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("MCQ deleted successfully");
    expect(deleteMcq).toHaveBeenCalledWith("mcq-1");
  });

  it("returns 404 when the MCQ is not found", async () => {
    vi.mocked(deleteMcq).mockRejectedValueOnce(new NotFoundError("MCQ not found"));

    const response = await DELETE(
      new Request("http://localhost/api/mcq/missing", { method: "DELETE" }),
      routeContext("missing")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("MCQ not found");
  });
});
