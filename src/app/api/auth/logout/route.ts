export async function POST() {
  return Response.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );
}
