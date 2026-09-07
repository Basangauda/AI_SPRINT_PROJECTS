import "server-only";

import { getDb } from "@/lib/db";
import { getUserById, NotFoundError } from "@/lib/services/user-service";
import type {
  CreateAttemptInput,
  CreateMcqInput,
  McqAttempt,
  McqAttemptRow,
  McqChoice,
  McqChoiceRow,
  McqRow,
  McqSummary,
  McqWithChoices,
  UpdateMcqInput,
} from "@/lib/types/mcq";

export { NotFoundError };

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

const MCQ_SUMMARY_COLUMNS = "id, name, question, created_at, updated_at";

const CHOICE_COLUMNS =
  "id, mcq_id, choice, is_correct, created_at, updated_at";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function toMcqSummary(row: McqRow): McqSummary {
  return {
    id: row.id,
    name: row.name,
    question: row.question,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMcqChoice(row: McqChoiceRow): McqChoice {
  return {
    id: row.id,
    choice: row.choice,
    isCorrect: row.is_correct === 1,
  };
}

function toMcqAttempt(row: McqAttemptRow): McqAttempt {
  return {
    id: row.id,
    mcqId: row.mcq_id,
    userId: row.user_id,
    choiceId: row.choice_id,
    isCorrect: row.is_correct === 1,
    createdAt: row.created_at,
  };
}

async function getMcqRowById(id: string): Promise<McqRow | null> {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT ${MCQ_SUMMARY_COLUMNS} FROM mcqs WHERE id = ?1`)
    .bind(id)
    .all<McqRow>();

  return results[0] ?? null;
}

async function getChoiceForMcq(
  mcqId: string,
  choiceId: string
): Promise<McqChoiceRow | null> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT ${CHOICE_COLUMNS}
       FROM mcq_choices
       WHERE id = ?1 AND mcq_id = ?2`
    )
    .bind(choiceId, mcqId)
    .all<McqChoiceRow>();

  return results[0] ?? null;
}

async function getChoicesForMcq(mcqId: string): Promise<McqChoiceRow[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT ${CHOICE_COLUMNS}
       FROM mcq_choices
       WHERE mcq_id = ?1
       ORDER BY created_at ASC`
    )
    .bind(mcqId)
    .all<McqChoiceRow>();

  return results;
}

async function insertChoices(
  mcqId: string,
  choices: CreateMcqInput["choices"]
): Promise<void> {
  const db = getDb();

  for (const choice of choices) {
    await db
      .prepare(
        `INSERT INTO mcq_choices (id, mcq_id, choice, is_correct)
         VALUES (?1, ?2, ?3, ?4)`
      )
      .bind(
        generateId(),
        mcqId,
        choice.choice,
        choice.isCorrect ? 1 : 0
      )
      .run();
  }
}

export async function createMcq(input: CreateMcqInput): Promise<McqWithChoices> {
  const db = getDb();
  const mcqId = generateId();

  await db
    .prepare(`INSERT INTO mcqs (id, name, question) VALUES (?1, ?2, ?3)`)
    .bind(mcqId, input.name, input.question)
    .run();

  await insertChoices(mcqId, input.choices);

  const created = await getMcqById(mcqId);
  if (!created) {
    throw new Error("Failed to create MCQ");
  }

  return created;
}

export async function listMcqs(): Promise<McqSummary[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT ${MCQ_SUMMARY_COLUMNS} FROM mcqs ORDER BY created_at ASC`
    )
    .all<McqRow>();

  return results.map(toMcqSummary);
}

export async function getMcqById(id: string): Promise<McqWithChoices | null> {
  const row = await getMcqRowById(id);
  if (!row) {
    return null;
  }

  const choices = await getChoicesForMcq(id);

  return {
    ...toMcqSummary(row),
    choices: choices.map(toMcqChoice),
  };
}

export async function updateMcq(
  id: string,
  input: UpdateMcqInput
): Promise<McqWithChoices> {
  const existing = await getMcqRowById(id);
  if (!existing) {
    throw new NotFoundError("MCQ not found");
  }

  const db = getDb();

  await db
    .prepare(
      `UPDATE mcqs
       SET name = ?1,
           question = ?2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?3`
    )
    .bind(input.name, input.question, id)
    .run();

  await db
    .prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1")
    .bind(id)
    .run();

  await insertChoices(id, input.choices);

  const updated = await getMcqById(id);
  if (!updated) {
    throw new Error("Failed to update MCQ");
  }

  return updated;
}

export async function deleteMcq(id: string): Promise<void> {
  const existing = await getMcqRowById(id);
  if (!existing) {
    throw new NotFoundError("MCQ not found");
  }

  const db = getDb();
  await db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id).run();
}

export async function createAttempt(
  mcqId: string,
  input: CreateAttemptInput
): Promise<McqAttempt> {
  const user = await getUserById(input.userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const mcq = await getMcqRowById(mcqId);
  if (!mcq) {
    throw new NotFoundError("MCQ not found");
  }

  const choice = await getChoiceForMcq(mcqId, input.choiceId);
  if (!choice) {
    throw new BadRequestError("Choice does not belong to this MCQ");
  }

  const attemptId = generateId();
  const isCorrect = choice.is_correct === 1 ? 1 : 0;
  const db = getDb();

  await db
    .prepare(
      `INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, is_correct)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(attemptId, mcqId, input.userId, input.choiceId, isCorrect)
    .run();

  const { results } = await db
    .prepare(
      `SELECT id, mcq_id, user_id, choice_id, is_correct, created_at
       FROM mcq_attempts
       WHERE id = ?1`
    )
    .bind(attemptId)
    .all<McqAttemptRow>();

  const row = results[0];
  if (!row) {
    throw new Error("Failed to create attempt");
  }

  return toMcqAttempt(row);
}
