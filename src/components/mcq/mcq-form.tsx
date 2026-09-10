"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { McqWithChoices } from "@/lib/types/mcq";
import { mcqInputSchema } from "@/lib/validators/mcq";

type ChoiceField = {
  key: string;
  choice: string;
};

type McqFormProps = {
  mode: "create" | "edit";
  mcqId?: string;
  initialMcq?: McqWithChoices;
};

function createEmptyChoice(): ChoiceField {
  return { key: crypto.randomUUID(), choice: "" };
}

function buildInitialChoices(initialMcq?: McqWithChoices): ChoiceField[] {
  if (initialMcq) {
    return initialMcq.choices.map((choice) => ({
      key: choice.id,
      choice: choice.choice,
    }));
  }

  return [createEmptyChoice(), createEmptyChoice()];
}

function getInitialCorrectIndex(initialMcq?: McqWithChoices): string {
  if (!initialMcq) {
    return "";
  }

  const correctIndex = initialMcq.choices.findIndex((choice) => choice.isCorrect);
  return correctIndex === -1 ? "" : String(correctIndex);
}

export function McqForm({ mode, mcqId, initialMcq }: McqFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialMcq?.name ?? "");
  const [question, setQuestion] = useState(initialMcq?.question ?? "");
  const [choices, setChoices] = useState<ChoiceField[]>(() =>
    buildInitialChoices(initialMcq)
  );
  const [correctIndex, setCorrectIndex] = useState(() =>
    getInitialCorrectIndex(initialMcq)
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(
    () => (mode === "create" ? "Create Question" : "Edit Question"),
    [mode]
  );

  function addChoice() {
    if (choices.length >= 6) {
      return;
    }

    setChoices((current) => [...current, createEmptyChoice()]);
  }

  function removeChoice(index: number) {
    if (choices.length <= 2) {
      return;
    }

    setChoices((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setCorrectIndex((current) => {
      if (current === "") {
        return current;
      }

      const currentIndex = Number(current);
      if (currentIndex === index) {
        return "";
      }
      if (currentIndex > index) {
        return String(currentIndex - 1);
      }
      return current;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (correctIndex === "") {
      setError("Select which choice is the correct answer");
      return;
    }

    const payload = {
      name,
      question,
      choices: choices.map((choice, index) => ({
        choice: choice.choice,
        isCorrect: String(index) === correctIndex,
      })),
    };

    const parsed = mcqInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError("Validation failed");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create" ? "/api/mcq" : `/api/mcq/${mcqId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );

      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Failed to save MCQ");
        return;
      }

      router.push("/mcq");
    } catch {
      setError("Failed to save MCQ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "create"
            ? "Add a new multiple-choice question to the test bank."
            : "Update this question and its answer choices."}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="question">Question</FieldLabel>
            <Textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Choices</FieldLabel>
            <p className="text-sm text-muted-foreground">
              Enter the answer choices, then use the radio button to mark the correct answer.
            </p>
            <RadioGroup
              value={correctIndex}
              onValueChange={setCorrectIndex}
              className="gap-4"
            >
              {choices.map((choice, index) => (
                <div
                  key={choice.key}
                  className="flex items-start gap-3 rounded-lg border border-input p-3"
                >
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <RadioGroupItem
                      value={String(index)}
                      aria-label={`Mark choice ${index + 1} as correct`}
                    />
                    <span className="text-xs text-muted-foreground">Correct</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <FieldLabel htmlFor={`choice-${index}`}>
                      Choice {index + 1}
                    </FieldLabel>
                    <Input
                      id={`choice-${index}`}
                      aria-label="Choice text"
                      value={choice.choice}
                      onChange={(event) =>
                        setChoices((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index
                              ? { ...item, choice: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeChoice(index)}
                    disabled={choices.length <= 2}
                  >
                    Remove choice
                  </Button>
                </div>
              ))}
            </RadioGroup>
          </Field>

          <Button
            type="button"
            variant="outline"
            onClick={addChoice}
            disabled={choices.length >= 6}
          >
            Add choice
          </Button>

          {error ? <FieldError errors={[{ message: error }]} /> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/mcq")}
            >
              Cancel
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}
