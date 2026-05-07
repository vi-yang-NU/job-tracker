import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  return { session: session!, userId };
}
