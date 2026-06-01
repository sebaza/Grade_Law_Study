import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthFailure, requireAdminUser } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/db/prisma";

const difficultySchema = z.enum(["low", "medium", "high"]);
const originSchema = z.enum(["real_question", "generated", "manual"]);

const keyPointUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  weight: z.coerce.number().min(0).max(100).default(1),
  isRequired: z.boolean().default(true),
});

const commonErrorUpdateSchema = z.object({
  description: z.string().trim().min(1),
  severity: z.string().trim().min(1).default("medium"),
});

const questionUpdateSchema = z.object({
  statement: z.string().trim().min(8).optional(),
  areaId: z.string().uuid().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  subsubjectId: z.string().uuid().nullable().optional(),
  difficulty: difficultySchema.optional(),
  estimatedProbability: z.coerce.number().min(0).max(100).optional(),
  priorityScore: z.coerce.number().min(0).max(10000).optional(),
  questionType: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
  origin: originSchema.optional(),
  sourceReference: z.string().trim().nullable().optional(),
  professorIds: z.array(z.string().uuid()).optional(),
  expectedAnswer: z
    .object({
      modelAnswer: z.string().trim().min(1),
      rubricNotes: z.string().trim().nullable().optional(),
    })
    .optional(),
  keyPoints: z.array(keyPointUpdateSchema).optional(),
  commonErrors: z.array(commonErrorUpdateSchema).optional(),
});

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value ?? 0);
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

export async function GET(_request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const { questionId } = await params;
  const question = await getQuestionById(questionId);

  if (!question) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ question: normalizeQuestion(question) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const { questionId } = await params;
  const parsed = questionUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getPrisma();
  const existingQuestion = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });

  if (!existingQuestion) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }

  const data = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          statement: data.statement,
          areaId: data.areaId,
          subjectId: data.subjectId === undefined ? undefined : data.subjectId,
          subsubjectId: data.subsubjectId === undefined ? undefined : data.subsubjectId,
          difficulty: data.difficulty,
          estimatedProbability: data.estimatedProbability,
          priorityScore: data.priorityScore,
          questionType: data.questionType === undefined ? undefined : data.questionType || null,
          isActive: data.isActive,
          origin: data.origin,
          sourceReference: data.sourceReference === undefined ? undefined : data.sourceReference || null,
        },
      });

      if (data.professorIds) {
        await tx.questionProfessor.deleteMany({ where: { questionId } });
        if (data.professorIds.length > 0) {
          await tx.questionProfessor.createMany({
            data: data.professorIds.map((professorId) => ({ questionId, professorId })),
            skipDuplicates: true,
          });
        }
      }

      if (data.expectedAnswer) {
        const activeAnswer = await tx.expectedAnswer.findFirst({
          where: { questionId, isActive: true },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
          select: { id: true },
        });

        if (activeAnswer) {
          await tx.expectedAnswer.update({
            where: { id: activeAnswer.id },
            data: {
              modelAnswer: data.expectedAnswer.modelAnswer,
              rubricNotes: data.expectedAnswer.rubricNotes || null,
            },
          });
        } else {
          await tx.expectedAnswer.create({
            data: {
              questionId,
              modelAnswer: data.expectedAnswer.modelAnswer,
              rubricNotes: data.expectedAnswer.rubricNotes || null,
              isActive: true,
              version: 1,
            },
          });
        }
      }

      if (data.keyPoints) {
        for (const [index, point] of data.keyPoints.entries()) {
          if (point.id) {
            const updatedPoint = await tx.keyPoint.updateMany({
              where: { id: point.id, questionId },
              data: {
                label: point.label,
                description: point.description,
                weight: point.weight,
                isRequired: point.isRequired,
                orderIndex: index,
              },
            });

            if (updatedPoint.count === 0) {
              throw new Error("Punto clave no pertenece a esta pregunta.");
            }
          } else {
            await tx.keyPoint.create({
              data: {
                questionId,
                label: point.label,
                description: point.description,
                weight: point.weight,
                isRequired: point.isRequired,
                orderIndex: index,
              },
            });
          }
        }
      }

      if (data.commonErrors) {
        await tx.commonError.deleteMany({ where: { questionId } });
        if (data.commonErrors.length > 0) {
          await tx.commonError.createMany({
            data: data.commonErrors.map((error) => ({
              questionId,
              description: error.description,
              severity: error.severity,
            })),
          });
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la pregunta." },
      { status: 400 },
    );
  }

  const question = await getQuestionById(questionId);

  return NextResponse.json({ question: normalizeQuestion(question) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const { questionId } = await params;
  const db = getPrisma();
  const question = await db.question.updateMany({
    where: { id: questionId },
    data: { isActive: false },
  });

  if (question.count === 0) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    question: { id: questionId },
    note: "La pregunta fue archivada. No se eliminó físicamente para preservar historial e intentos.",
  });
}
