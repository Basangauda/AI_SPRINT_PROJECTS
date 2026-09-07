"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { McqForm } from "@/components/mcq/mcq-form";
import { getAuthUser } from "@/lib/auth-session";

export default function NewMcqPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getAuthUser()) {
      router.push("/login");
    }
  }, [router]);

  return <McqForm mode="create" />;
}
