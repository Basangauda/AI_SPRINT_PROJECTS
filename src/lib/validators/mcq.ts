import { z } from "zod";

const choiceInputSchema = z.object({
  choice: z.string().min(1).max(1000),
  isCorrect: z.boolean(),
});

export const mcqInputSchema = z.object({
  name: z.string().min(1).max(200),
  question: z.string().min(1).max(5000),
  choices: z
    .array(choiceInputSchema)
    .min(2)
    .max(6)
    .refine((choices) => choices.filter((choice) => choice.isCorrect).length === 1, {
      message: "Exactly one choice must be marked as correct",
    }),
});

export const createAttemptSchema = z.object({
  userId: z.string().min(1),
  choiceId: z.string().min(1),
});

export type McqInput = z.infer<typeof mcqInputSchema>;
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
