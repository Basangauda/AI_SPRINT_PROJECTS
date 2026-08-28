import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Quiz Maker</CardTitle>
          <CardDescription>
            Collaborate with other teachers to build a shared MCQ test bank.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "default" }), "flex-1")}
          >
            Register
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
          >
            Log in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
