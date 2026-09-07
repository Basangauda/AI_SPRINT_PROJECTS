"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clearAuthUser, getAuthUser } from "@/lib/auth-session";
import type { McqSummary, McqWithChoices } from "@/lib/types/mcq";

function subscribeToAuthUser() {
  return () => {};
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function truncateText(value: string, maxLength = 80) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export function McqManagement() {
  const router = useRouter();
  const user = useSyncExternalStore(
    subscribeToAuthUser,
    getAuthUser,
    () => null
  );
  const [mcqs, setMcqs] = useState<McqSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<McqSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [previewTarget, setPreviewTarget] = useState<McqSummary | null>(null);
  const [previewMcq, setPreviewMcq] = useState<McqWithChoices | null>(null);
  const [previewChoiceId, setPreviewChoiceId] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false);

  const loadMcqs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mcq");
      const body = (await response.json()) as {
        mcqs?: McqSummary[];
        error?: string;
      };

      if (!response.ok) {
        setError(body.error ?? "Failed to load MCQs");
        return;
      }

      setMcqs(body.mcqs ?? []);
    } catch {
      setError("Failed to load MCQs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Data fetch on auth is intentional for initial table load.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadMcqs updates loading/error state after fetch
    void loadMcqs();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router mock is unstable in tests
  }, [loadMcqs, user]);

  useEffect(() => {
    const target = previewTarget;
    if (!target) {
      return;
    }

    const targetId = target.id;

    async function loadPreviewMcq() {
      setIsPreviewLoading(true);
      setPreviewResult(null);
      setPreviewChoiceId("");

      try {
        const response = await fetch(`/api/mcq/${targetId}`);
        const body = (await response.json()) as {
          mcq?: McqWithChoices;
          error?: string;
        };

        if (!response.ok || !body.mcq) {
          setPreviewResult(body.error ?? "Failed to load question");
          return;
        }

        setPreviewMcq(body.mcq);
      } catch {
        setPreviewResult("Failed to load question");
      } finally {
        setIsPreviewLoading(false);
      }
    }

    void loadPreviewMcq();
  }, [previewTarget]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearAuthUser();
      router.push("/login");
      setIsLoggingOut(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/mcq/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Failed to delete MCQ");
        return;
      }

      setDeleteTarget(null);
      await loadMcqs();
    } catch {
      setError("Failed to delete MCQ");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSubmitAttempt() {
    if (!previewTarget || !previewMcq || !previewChoiceId || !user) {
      return;
    }

    setIsSubmittingAttempt(true);

    try {
      const response = await fetch(`/api/mcq/${previewTarget.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          choiceId: previewChoiceId,
        }),
      });

      const body = (await response.json()) as {
        attempt?: { isCorrect: boolean };
        error?: string;
      };

      if (!response.ok || !body.attempt) {
        setPreviewResult(body.error ?? "Failed to submit answer");
        return;
      }

      setPreviewResult(body.attempt.isCorrect ? "Correct!" : "Incorrect.");
    } catch {
      setPreviewResult("Failed to submit answer");
    } finally {
      setIsSubmittingAttempt(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 bg-background p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">MCQ Test Bank</h1>
          {user ? (
            <p className="text-sm text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">
                {user.firstName} {user.lastName}
              </span>{" "}
              ({user.username})
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={() => router.push("/mcq/new")}>
            Create Question
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            Log out
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading questions...</p>
      ) : mcqs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No questions yet. Create your first MCQ to get started.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => router.push("/mcq/new")}
          >
            Create Question
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mcqs.map((mcq) => (
              <TableRow key={mcq.id}>
                <TableCell className="font-medium">{mcq.name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {truncateText(mcq.question)}
                </TableCell>
                <TableCell>{formatTimestamp(mcq.createdAt)}</TableCell>
                <TableCell>{formatTimestamp(mcq.updatedAt)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Actions for ${mcq.name}`}
                        />
                      }
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/mcq/${mcq.id}/edit`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPreviewTarget(mcq)}>
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(mcq)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete question</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTarget(null);
            setPreviewMcq(null);
            setPreviewChoiceId("");
            setPreviewResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewTarget?.name}</DialogTitle>
            <DialogDescription>Preview this question and submit an answer.</DialogDescription>
          </DialogHeader>

          {isPreviewLoading ? (
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          ) : previewMcq ? (
            <div className="space-y-4">
              <p className="text-sm">{previewMcq.question}</p>
              <Field>
                <FieldLabel>Select an answer</FieldLabel>
                <RadioGroup
                  value={previewChoiceId}
                  onValueChange={setPreviewChoiceId}
                  className="gap-3"
                >
                  {previewMcq.choices.map((choice) => (
                    <label
                      key={choice.id}
                      className="flex items-center gap-3 rounded-lg border border-input p-3"
                    >
                      <RadioGroupItem
                        value={choice.id}
                        aria-label={choice.choice}
                      />
                      <span>{choice.choice}</span>
                    </label>
                  ))}
                </RadioGroup>
              </Field>
              {previewResult ? (
                <p className="text-sm font-medium">{previewResult}</p>
              ) : null}
            </div>
          ) : previewResult ? (
            <p className="text-sm text-destructive">{previewResult}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewTarget(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSubmitAttempt}
              disabled={!previewChoiceId || isSubmittingAttempt || Boolean(previewResult)}
            >
              Submit answer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
