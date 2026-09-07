import {
  createMcq,
  listMcqs,
} from "@/lib/services/mcq-service";
import { mcqInputSchema } from "@/lib/validators/mcq";

export async function GET() {
  try {
    const mcqs = await listMcqs();
    return Response.json({ mcqs }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = mcqInputSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const mcq = await createMcq(parsed.data);
    return Response.json({ mcq }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
