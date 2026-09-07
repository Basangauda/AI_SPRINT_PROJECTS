import { describe, expect, it } from "vitest";
import {
  createAttemptSchema,
  mcqInputSchema,
} from "@/lib/validators/mcq";

const validMcq = {
  name: "Photosynthesis basics",
  question: "Which organelle carries out photosynthesis?",
  choices: [
    { choice: "Mitochondria", isCorrect: false },
    { choice: "Chloroplast", isCorrect: true },
  ],
};

describe("mcqInputSchema", () => {
  it("accepts a valid MCQ payload with two choices and one correct answer", () => {
    const result = mcqInputSchema.safeParse(validMcq);

    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      name: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing question", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      question: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects fewer than two choices", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      choices: [{ choice: "Only one", isCorrect: true }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than six choices", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      choices: [
        { choice: "A", isCorrect: false },
        { choice: "B", isCorrect: false },
        { choice: "C", isCorrect: false },
        { choice: "D", isCorrect: false },
        { choice: "E", isCorrect: false },
        { choice: "F", isCorrect: false },
        { choice: "G", isCorrect: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty choice text", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      choices: [
        { choice: "", isCorrect: false },
        { choice: "Chloroplast", isCorrect: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects when no choice is marked correct", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      choices: [
        { choice: "Mitochondria", isCorrect: false },
        { choice: "Chloroplast", isCorrect: false },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects when more than one choice is marked correct", () => {
    const result = mcqInputSchema.safeParse({
      ...validMcq,
      choices: [
        { choice: "Mitochondria", isCorrect: true },
        { choice: "Chloroplast", isCorrect: true },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("createAttemptSchema", () => {
  it("accepts a valid attempt payload", () => {
    const result = createAttemptSchema.safeParse({
      userId: "user-1",
      choiceId: "choice-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing userId", () => {
    const result = createAttemptSchema.safeParse({
      userId: "",
      choiceId: "choice-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing choiceId", () => {
    const result = createAttemptSchema.safeParse({
      userId: "user-1",
      choiceId: "",
    });

    expect(result.success).toBe(false);
  });
});
