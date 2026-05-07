"use server";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const portfolioSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function createPortfolioAction(formData: FormData): Promise<string> {
  const { userId } = await requireUser();
  const parsed = portfolioSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });
  const inserted = await db
    .insert(schema.portfolios)
    .values({
      userId,
      name: parsed.name,
      description: parsed.description || null,
    })
    .returning({ id: schema.portfolios.id });
  revalidatePath("/dashboard");
  return inserted[0].id;
}
