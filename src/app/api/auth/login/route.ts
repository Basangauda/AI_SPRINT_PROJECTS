import { verifyPassword } from "@/lib/password";
import {
  getUserByEmail,
  getUserByUsername,
} from "@/lib/services/user-service";
import { loginSchema } from "@/lib/validators/user";

const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const user =
      (await getUserByUsername(username)) ??
      (await getUserByEmail(username));

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return Response.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 }
      );
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return Response.json({ user: publicUser }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
