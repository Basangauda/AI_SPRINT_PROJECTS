import { ConflictError, createUser } from "@/lib/services/user-service";
import { registerSchema } from "@/lib/validators/user";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await createUser(parsed.data);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
