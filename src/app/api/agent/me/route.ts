import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, userId) });
  return NextResponse.json({ id: userId, email: u?.email, name: u?.name });
}
