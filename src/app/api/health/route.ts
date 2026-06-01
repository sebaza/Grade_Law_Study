import { NextResponse } from "next/server";
import { createEnvReport } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  const db = getPrisma();

  try {
    await db.$queryRaw`SELECT 1`;
    return {
      ok: true,
      message: "Conexión PostgreSQL disponible.",
    };
  } catch {
    return {
      ok: false,
      message: "No se pudo conectar a PostgreSQL.",
    };
  }
}

export async function GET() {
  const env = createEnvReport();
  const database = await checkDatabase();
  const ok = env.ok && database.ok;

  return NextResponse.json(
    {
      ok,
      service: "grade-law-study",
      checkedAt: new Date().toISOString(),
      environment: {
        ok: env.ok,
        missingRequired: env.missingRequired,
        variables: env.variables.map((variable) => ({
          name: variable.name,
          scope: variable.scope,
          required: variable.required,
          configured: variable.configured,
          purpose: variable.purpose,
        })),
      },
      database,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
