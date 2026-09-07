import {
  deleteMcq,
  getMcqById,
  NotFoundError,
  updateMcq,
} from "@/lib/services/mcq-service";
import { mcqInputSchema } from "@/lib/validators/mcq";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const mcq = await getMcqById(id);

    if (!mcq) {
      return Response.json({ error: "MCQ not found" }, { status: 404 });
    }

    return Response.json({ mcq }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = mcqInputSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const mcq = await updateMcq(id, parsed.data);
    return Response.json({ mcq }, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteMcq(id);
    return Response.json(
      { message: "MCQ deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
