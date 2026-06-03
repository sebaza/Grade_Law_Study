import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthFailure, requireAdminUser } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/db/prisma";

const difficultySchema = z.enum(["low", "medium", "high"]);
const originSchema = z.enum(["real_question", "generated", "manual"]);

const keyPointInputSchema = z.object({
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  weight: z.coerce.number().min(0).max(100).default(1),
  isRequired: z.boolean().default(true),
});

const commonErrorInputSchema = z.object({
  description: z.string().trim().min(1),
  severity: z.string().trim().min(1).default("medium"),
});

const questionCreateSchema = z.object({
  statement: z.string().trim().min(8),
  areaId: z.string().uuid(),
  subjectId: z.string().uuid().nullable().optional(),
  subsubjectId: z.string().uuid().nullable().optional(),
  difficulty: difficultySchema.default("medium"),
  estimatedProbability: z.coerce.number().min(0).max(100).default(0),
  priorityScore: z.coerce.number().min(0).max(10000).default(0),
  questionType: z.string().trim().nullable().optional(),
  origin: originSchema.default("manual"),
  sourceReference: z.string().trim().nullable().optional(),
  professorIds: z.array(z.string().uuid()).default([]),
  expectedAnswer: z
    .object({
      modelAnswer: z.string().trim().min(1),
      rubricNotes: z.string().trim().nullable().optional(),
    })
    .optional(),
  keyPoints: z.array(keyPointInputSchema).default([]),
  commonErrors: z.array(commonErrorInputSchema).default([]),
});

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

function normalizeQuestion(question: Awaited<ReturnType<typeof getQuestionById>>) {
  if (!question) return null;

  const activeAnswer = question.expectedAnswers[0] ?? null;

  return {
    id: question.id,
    statement: question.statement,
    areaId: question.areaId,
    areaName: question.area.name,
    subjectId: question.subjectId,
    subjectName: question.subject?.name ?? "Sin materia",
    subsubjectId: question.subsubjectId,
    subsubjectName: question.subsubject?.name ?? "Sin submateria",
    difficulty: question.difficulty,
    estimatedProbability: toNumber(question.estimatedProbability),
    priorityScore: toNumber(question.priorityScore),
    questionType: question.questionType ?? "",
    isActive: question.isActive,
    origin: question.origin,
    sourceReference: question.sourceReference ?? "",
    expectedAnswer: activeAnswer
      ? {
          id: activeAnswer.id,
          modelAnswer: activeAnswer.modelAnswer,
          rubricNotes: activeAnswer.rubricNotes ?? "",
          version: activeAnswer.version,
        }
      : null,
    keyPoints: question.keyPoints.map((point) => ({
      id: point.id,
      label: point.label,
      description: point.description,
      weight: toNumber(point.weight),
      isRequired: point.isRequired,
      orderIndex: point.orderIndex,
    })),
    commonErrors: question.commonErrors.map((error) => ({
      id: error.id,
      description: error.description,
      severity: error.severity,
    })),
    professorIds: question.professors.map((link) => link.professorId),
    professorNames: question.professors.map((link) => link.professor.name),
    updatedAt: question.updatedAt,
  };
}

async function getQuestionById(id: string) {
  const db = getPrisma();

  return db.question.findUnique({
    where: { id },
    include: {
      area: true,
      subject: true,
      subsubject: true,
      expectedAnswers: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      keyPoints: { orderBy: { orderIndex: "asc" } },
      commonErrors: true,
      professors: { include: { professor: true }, orderBy: { professorId: "asc" } },
    },
  });
}

export async function GET(request: Request) {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const db = getPrisma();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const areaId = searchParams.get("areaId") || undefined;
  const subjectId = searchParams.get("subjectId") || undefined;
  const subsubjectId = searchParams.get("subsubjectId") || undefined;
  const professorId = searchParams.get("professorId") || undefined;
  const difficulty = difficultySchema.safeParse(searchParams.get("difficulty")).success
    ? (searchParams.get("difficulty") as "low" | "medium" | "high")
    : undefined;
  const active = searchParams.get("active") ?? "all";
  const take = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100);

  const questions = await db.question.findMany({
    where: {
      statement: q ? { contains: q, mode: "insensitive" } : undefined,
      areaId,
      subjectId,
      subsubjectId,
      difficulty,
      isActive: active === "active" ? true : active === "inactive" ? false : undefined,
      professors: professorId ? { some: { professorId } } : undefined,
    },
    include: {
      area: true,
      subject: true,
      subsubject: true,
      expectedAnswers: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      keyPoints: { orderBy: { orderIndex: "asc" } },
      commonErrors: true,
      professors: { include: { professor: true }, orderBy: { professorId: "asc" } },
    },
    orderBy: [{ isActive: "desc" }, { priorityScore: "desc" }, { estimatedProbability: "desc" }],
    take,
  });

  return NextResponse.json({
    admin: {
      email: admin.user.email,
      restrictedByEmail: admin.restrictedByEmail,
    },
    questions: questions.map(normalizeQuestion),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const parsed = questionCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getPrisma();
  const data = parsed.data;

  const question = await db.question.create({
    data: {
      statement: data.statement,
      areaId: data.areaId,
      subjectId: data.subjectId ?? null,
      subsubjectId: data.subsubjectId ?? null,
      difficulty: data.difficulty,
      estimatedProbability: data.estimatedProbability,
      priorityScore: data.priorityScore,
      questionType: data.questionType || null,
      origin: data.origin,
      sourceReference: data.sourceReference || null,
      expectedAnswers: data.expectedAnswer
        ? {
            create: {
              modelAnswer: data.expectedAnswer.modelAnswer,
              rubricNotes: data.expectedAnswer.rubricNotes || null,
              isActive: true,
              version: 1,
            },
          }
        : undefined,
      keyPoints: {
        create: data.keyPoints.map((point, index) => ({
          label: point.label,
          description: point.description,
          weight: point.weight,
          isRequired: point.isRequired,
          orderIndex: index,
        })),
      },
      commonErrors: {
        create: data.commonErrors.map((error) => ({
          description: error.description,
          severity: error.severity,
        })),
      },
      professors: {
        create: data.professorIds.map((professorId) => ({ professorId })),
      },
    },
    select: { id: true },
  });

  const created = await getQuestionById(question.id);

  return NextResponse.json({ question: normalizeQuestion(created) }, { status: 201 });
}
