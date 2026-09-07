"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { McqForm } from "@/components/mcq/mcq-form";
import { getAuthUser } from "@/lib/auth-session";
import type { McqWithChoices } from "@/lib/types/mcq";

export default function EditMcqPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [mcq, setMcq] = useState<McqWithChoices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthUser()) {
      router.push("/login");
      return;
    }

    async function loadMcq() {
      try {
        const response = await fetch(`/api/mcq/${params.id}`);
        const body = (await response.json()) as {
          mcq?: McqWithChoices;
          error?: string;
        };

        if (!response.ok || !body.mcq) {
          setError(body.error ?? "Failed to load MCQ");
          return;
        }

        setMcq(body.mcq);
      } catch {
        setError("Failed to load MCQ");
      }
    }

    void loadMcq();
  }, [params.id, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-destructive">{error}</div>
    );
  }

  if (!mcq) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
        Loading question...
      </div>
    );
  }

  return <McqForm mode="edit" mcqId={params.id} initialMcq={mcq} />;
}
