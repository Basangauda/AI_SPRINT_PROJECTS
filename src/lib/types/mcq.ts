export type McqChoice = {
  id: string;
  choice: string;
  isCorrect: boolean;
};

export type McqSummary = {
  id: string;
  name: string;
  question: string;
  createdAt: string;
  updatedAt: string;
};

export type McqWithChoices = McqSummary & {
  choices: McqChoice[];
};

export type McqAttempt = {
  id: string;
  mcqId: string;
  userId: string;
  choiceId: string;
  isCorrect: boolean;
  createdAt: string;
};

export type McqRow = {
  id: string;
  name: string;
  question: string;
  created_at: string;
  updated_at: string;
};

export type McqChoiceRow = {
  id: string;
  mcq_id: string;
  choice: string;
  is_correct: number;
  created_at: string;
  updated_at: string;
};

export type McqAttemptRow = {
  id: string;
  mcq_id: string;
  user_id: string;
  choice_id: string;
  is_correct: number;
  created_at: string;
};

export type CreateMcqInput = {
  name: string;
  question: string;
  choices: {
    choice: string;
    isCorrect: boolean;
  }[];
};

export type UpdateMcqInput = CreateMcqInput;

export type CreateAttemptInput = {
  userId: string;
  choiceId: string;
};
