import {
  BadRequestError,
  createAttempt,
  NotFoundError,
} from "@/lib/services/mcq-service";
import { createAttemptSchema } from "@/lib/validators/mcq";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = createAttemptSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const attempt = await createAttempt(id, parsed.data);
    return Response.json({ attempt }, { status: 201 });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
