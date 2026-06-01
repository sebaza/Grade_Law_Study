export type EnvVarName =
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "OPENAI_API_KEY"
  | "OPENAI_TRANSCRIPTION_MODEL"
  | "OPENAI_EVALUATION_MODEL"
  | "ADMIN_EMAILS";

export type EnvRequirement = {
  name: EnvVarName;
  scope: "server" | "public";
  required: boolean;
  purpose: string;
};

export const envRequirements: EnvRequirement[] = [
  {
    name: "DATABASE_URL",
    scope: "server",
    required: true,
    purpose: "Conexión Prisma vía pooler para APIs y consultas de la app.",
  },
  {
    name: "DIRECT_URL",
    scope: "server",
    required: true,
    purpose: "Conexión directa usada por Prisma para migraciones.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    scope: "public",
    required: true,
    purpose: "URL pública del proyecto Supabase.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    scope: "public",
    required: false,
    purpose: "Clave pública publishable/anon para Supabase Auth en navegador y servidor.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    scope: "public",
    required: false,
    purpose: "Clave pública anon legacy; sirve como fallback si no existe publishable key.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    scope: "server",
    required: true,
    purpose: "Clave server-only para subir audios a Supabase Storage.",
  },
  {
    name: "OPENAI_API_KEY",
    scope: "server",
    required: true,
    purpose: "Clave server-only para transcripción y evaluación automática.",
  },
  {
    name: "OPENAI_TRANSCRIPTION_MODEL",
    scope: "server",
    required: true,
    purpose: "Modelo de transcripción de respuestas orales.",
  },
  {
    name: "OPENAI_EVALUATION_MODEL",
    scope: "server",
    required: true,
    purpose: "Modelo usado para evaluar respuestas contra la rúbrica.",
  },
  {
    name: "ADMIN_EMAILS",
    scope: "server",
    required: false,
    purpose: "Allowlist opcional para restringir el panel administrativo.",
  },
];

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function createEnvReport(env: NodeJS.ProcessEnv = process.env) {
  const variables = envRequirements.map((requirement) => ({
    ...requirement,
    configured: hasValue(env[requirement.name]),
  }));
  const hasSupabasePublicKey =
    hasValue(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || hasValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const missingRequired = [
    ...variables
    .filter((variable) => variable.required && !variable.configured)
      .map((variable) => variable.name),
    ...(hasSupabasePublicKey ? [] : ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  ];

  return {
    ok: missingRequired.length === 0,
    missingRequired,
    variables,
  };
}
