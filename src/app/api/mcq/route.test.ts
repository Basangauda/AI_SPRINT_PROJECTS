import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/services/mcq-service", () => ({
  createMcq: vi.fn(),
  listMcqs: vi.fn(),
}));

import { createMcq, listMcqs } from "@/lib/services/mcq-service";
import { GET, POST } from "./route";

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

function postMcq(body: unknown) {
  return POST(
    new Request("http://localhost/api/mcq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/mcq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 and the created MCQ for a valid body", async () => {
    vi.mocked(createMcq).mockResolvedValueOnce(sampleMcq);

    const response = await postMcq(validBody);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.mcq).toEqual(sampleMcq);
    expect(createMcq).toHaveBeenCalledWith(validBody);
  });

  it("returns 400 with validation details for an invalid body", async () => {
    const response = await postMcq({ name: "Only name" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(createMcq).not.toHaveBeenCalled();
  });
});

describe("GET /api/mcq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and a list of MCQ summaries", async () => {
    vi.mocked(listMcqs).mockResolvedValueOnce([
      {
        id: sampleMcq.id,
        name: sampleMcq.name,
        question: sampleMcq.question,
        createdAt: sampleMcq.createdAt,
        updatedAt: sampleMcq.updatedAt,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mcqs).toHaveLength(1);
    expect(body.mcqs[0]).not.toHaveProperty("choices");
  });
});
