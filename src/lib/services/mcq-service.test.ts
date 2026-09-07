import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  McqChoiceRow,
  McqRow,
} from "@/lib/types/mcq";

vi.mock("server-only", () => ({}));

const mockRun = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn(() => ({ run: mockRun, all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, all: mockAll }));
const mockDb = { prepare: mockPrepare };

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

const mockGetUserById = vi.fn();

vi.mock("@/lib/services/user-service", () => ({
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
}));

import {
  BadRequestError,
  createAttempt,
  createMcq,
  deleteMcq,
  getMcqById,
  listMcqs,
  NotFoundError,
  updateMcq,
} from "@/lib/services/mcq-service";

const mcqRow: McqRow = {
  id: "mcq-1",
  name: "Photosynthesis basics",
  question: "Which organelle carries out photosynthesis?",
  created_at: "2026-09-04 10:00:00",
  updated_at: "2026-09-04 10:00:00",
};

const choiceRows: McqChoiceRow[] = [
  {
    id: "choice-1",
    mcq_id: "mcq-1",
    choice: "Mitochondria",
    is_correct: 0,
    created_at: "2026-09-04 10:00:00",
    updated_at: "2026-09-04 10:00:00",
  },
  {
    id: "choice-2",
    mcq_id: "mcq-1",
    choice: "Chloroplast",
    is_correct: 1,
    created_at: "2026-09-04 10:00:01",
    updated_at: "2026-09-04 10:00:01",
  },
];

const createInput = {
  name: mcqRow.name,
  question: mcqRow.question,
  choices: [
    { choice: "Mitochondria", isCorrect: false },
    { choice: "Chloroplast", isCorrect: true },
  ],
};

describe("createMcq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an MCQ with choices and returns the created record", async () => {
    mockRun.mockResolvedValue({ success: true });
    mockAll
      .mockResolvedValueOnce({ results: [mcqRow] })
      .mockResolvedValueOnce({ results: choiceRows });

    const mcq = await createMcq(createInput);

    expect(mcq.name).toBe(mcqRow.name);
    expect(mcq.question).toBe(mcqRow.question);
    expect(mcq.choices).toHaveLength(2);
    expect(mcq.choices[1]?.isCorrect).toBe(true);
    expect(mockRun).toHaveBeenCalled();
  });
});

describe("listMcqs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns MCQ summaries without choices", async () => {
    mockAll.mockResolvedValueOnce({ results: [mcqRow] });

    const mcqs = await listMcqs();

    expect(mcqs).toHaveLength(1);
    expect(mcqs[0]).toEqual({
      id: "mcq-1",
      name: mcqRow.name,
      question: mcqRow.question,
      createdAt: mcqRow.created_at,
      updatedAt: mcqRow.updated_at,
    });
    expect(mcqs[0]).not.toHaveProperty("choices");
  });
});

describe("getMcqById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an MCQ with choices when found", async () => {
    mockAll
      .mockResolvedValueOnce({ results: [mcqRow] })
      .mockResolvedValueOnce({ results: choiceRows });

    const mcq = await getMcqById("mcq-1");

    expect(mcq?.choices).toHaveLength(2);
    expect(mcq?.choices[1]?.choice).toBe("Chloroplast");
  });

  it("returns null when not found", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    expect(await getMcqById("missing")).toBeNull();
  });
});

describe("updateMcq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates an existing MCQ and replaces its choices", async () => {
    const updatedRow: McqRow = {
      ...mcqRow,
      name: "Updated name",
      updated_at: "2026-09-04 11:00:00",
    };

    mockAll
      .mockResolvedValueOnce({ results: [mcqRow] })
      .mockResolvedValueOnce({ results: [updatedRow] })
      .mockResolvedValueOnce({ results: choiceRows });
    mockRun.mockResolvedValue({ success: true });

    const mcq = await updateMcq("mcq-1", {
      ...createInput,
      name: "Updated name",
    });

    expect(mcq.name).toBe("Updated name");
    expect(mockRun).toHaveBeenCalled();
  });

  it("throws NotFoundError when the MCQ does not exist", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    await expect(
      updateMcq("missing", createInput)
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof NotFoundError && error.message === "MCQ not found"
    );
  });
});

describe("deleteMcq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes an existing MCQ", async () => {
    mockAll.mockResolvedValueOnce({ results: [mcqRow] });
    mockRun.mockResolvedValueOnce({ success: true });

    await deleteMcq("mcq-1");

    expect(mockPrepare).toHaveBeenCalledWith("DELETE FROM mcqs WHERE id = ?1");
    expect(mockBind).toHaveBeenCalledWith("mcq-1");
  });

  it("throws NotFoundError when the MCQ does not exist", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    await expect(deleteMcq("missing")).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof NotFoundError && error.message === "MCQ not found"
    );
  });
});

describe("createAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a correct attempt based on the selected choice", async () => {
    mockGetUserById.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Jane",
      lastName: "Smith",
      username: "jsmith",
      email: "jane.smith@school.edu",
      group: "Science",
    });
    mockAll
      .mockResolvedValueOnce({ results: [mcqRow] })
      .mockResolvedValueOnce({ results: [choiceRows[1]] });
    mockRun.mockResolvedValueOnce({ success: true });
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: "attempt-1",
          mcq_id: "mcq-1",
          user_id: "user-1",
          choice_id: "choice-2",
          is_correct: 1,
          created_at: "2026-09-04 12:00:00",
        },
      ],
    });

    const attempt = await createAttempt("mcq-1", {
      userId: "user-1",
      choiceId: "choice-2",
    });

    expect(attempt.isCorrect).toBe(true);
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String),
      "mcq-1",
      "user-1",
      "choice-2",
      1
    );
  });

  it("records an incorrect attempt based on the selected choice", async () => {
    mockGetUserById.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Jane",
      lastName: "Smith",
      username: "jsmith",
      email: "jane.smith@school.edu",
      group: "Science",
    });
    mockAll
      .mockResolvedValueOnce({ results: [mcqRow] })
      .mockResolvedValueOnce({ results: [choiceRows[0]] });
    mockRun.mockResolvedValueOnce({ success: true });
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: "attempt-1",
          mcq_id: "mcq-1",
          user_id: "user-1",
          choice_id: "choice-1",
          is_correct: 0,
          created_at: "2026-09-04 12:00:00",
        },
      ],
    });

    const attempt = await createAttempt("mcq-1", {
      userId: "user-1",
      choiceId: "choice-1",
    });

    expect(attempt.isCorrect).toBe(false);
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String),
      "mcq-1",
      "user-1",
      "choice-1",
      0
    );
  });

  it("throws BadRequestError when the choice does not belong to the MCQ", async () => {
    mockGetUserById.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Jane",
      lastName: "Smith",
      username: "jsmith",
      email: "jane.smith@school.edu",
      group: "Science",
    });
    mockAll
      .mockResolvedValueOnce({ results: [mcqRow] })
      .mockResolvedValueOnce({ results: [] });

    await expect(
      createAttempt("mcq-1", { userId: "user-1", choiceId: "choice-9" })
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof BadRequestError &&
        error.message === "Choice does not belong to this MCQ"
    );
  });

  it("throws NotFoundError when the user does not exist", async () => {
    mockGetUserById.mockResolvedValueOnce(null);

    await expect(
      createAttempt("mcq-1", { userId: "missing", choiceId: "choice-1" })
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof NotFoundError && error.message === "User not found"
    );
  });

  it("throws NotFoundError when the MCQ does not exist", async () => {
    mockGetUserById.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Jane",
      lastName: "Smith",
      username: "jsmith",
      email: "jane.smith@school.edu",
      group: "Science",
    });
    mockAll.mockResolvedValueOnce({ results: [] });

    await expect(
      createAttempt("missing", { userId: "user-1", choiceId: "choice-1" })
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof NotFoundError && error.message === "MCQ not found"
    );
  });
});
