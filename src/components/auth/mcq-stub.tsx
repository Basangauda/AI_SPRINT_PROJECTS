"use client";

import { useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clearAuthUser, getAuthUser } from "@/lib/auth-session";

function subscribeToAuthUser() {
  return () => {};
}

export function McqStub() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const user = useSyncExternalStore(
    subscribeToAuthUser,
    getAuthUser,
    () => null
  );

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>MCQ Test Bank</CardTitle>
          <CardDescription>
            Question creation and management is coming in the next sprint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {user ? (
            <>
              <p>
                Signed in as{" "}
                <span className="font-medium">
                  {user.firstName} {user.lastName}
                </span>
              </p>
              <p className="text-muted-foreground">Username: {user.username}</p>
              <p className="text-muted-foreground">Group: {user.group}</p>
            </>
          ) : (
            <p className="text-muted-foreground">
              No user information found. Session support arrives in a later
              sprint.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            Log out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
