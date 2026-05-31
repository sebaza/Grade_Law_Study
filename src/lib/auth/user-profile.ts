import type { User } from "@supabase/supabase-js";
import { getPrisma } from "@/lib/db/prisma";

export async function ensureUserProfile(user: User) {
  const db = getPrisma();
  const email = user.email ?? null;
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : email?.split("@")[0] ?? "Estudiante";

  return db.userProfile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email,
      fullName,
    },
    update: {
      email,
      fullName,
    },
  });
}
