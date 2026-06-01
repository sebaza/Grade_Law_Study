import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAuthSuccess = {
  user: User;
  restrictedByEmail: boolean;
};

type AdminAuthFailure = {
  response: NextResponse;
};

function getAllowedAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminUser(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return {
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const allowedEmails = getAllowedAdminEmails();
  const userEmail = data.user.email?.toLowerCase() ?? "";

  if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
    return {
      response: NextResponse.json(
        {
          error: "No tenés permisos para administrar el banco de preguntas.",
        },
        { status: 403 },
      ),
    };
  }

  await ensureUserProfile(data.user);

  return {
    user: data.user,
    restrictedByEmail: allowedEmails.length > 0,
  };
}

export function isAdminAuthFailure(
  result: AdminAuthSuccess | AdminAuthFailure,
): result is AdminAuthFailure {
  return "response" in result;
}
