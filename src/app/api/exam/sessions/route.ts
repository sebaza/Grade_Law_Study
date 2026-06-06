import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const examSessionRequestSchema = z.object({
  limit: z.number().int().min(1).max(30).default(3),
  perQuestionSeconds: z.number().int().min(60).max(900).default(900),
  strategy: z.enum(["balanced", "priority", "weak"]).default("balanced"),
  topicOrder: z.array(z.string().trim().min(1)).min(1).max(3).optional(),
  questionsPerTopic: z.number().int().min(10).max(10).default(10),
  filters: z
    .object({
      difficulty: z.enum(["low", "medium", "high"]).optional(),
      professor: z.string().optional(),
    })
    .default({}),
});

const difficultyRank = {
  low: 0,
  medium: 1,
  high: 2,
} as const;

const examDifficultyPlan = [
  "low",
  "low",
  "low",
  "medium",
  "medium",
  "medium",
  "medium",
  "high",
  "high",
  "high",
] as const;

type ExamCandidate = {
  id: string;
  areaId: string;
  area: { name: string };
  subject: { name: string } | null;
  subsubject: { name: string } | null;
  difficulty: "low" | "medium" | "high";
  priorityScore: unknown;
  estimatedProbability: unknown;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function groupBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function questionPriority(question: ExamCandidate) {
  return toNumber(question.priorityScore) + toNumber(question.estimatedProbability) / 100;
}

function sortForExamProgression<T extends ExamCandidate>(questions: T[]) {
  return questions.slice().sort((a, b) => {
    const difficultyDelta = difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
    if (difficultyDelta !== 0) return difficultyDelta;
    return questionPriority(b) - questionPriority(a);
  });
}

function pickBestGroup<T extends ExamCandidate>(groups: Map<string, T[]>) {
  return Array.from(groups.values()).sort((a, b) => {
    const sizeDelta = b.length - a.length;
    if (sizeDelta !== 0) return sizeDelta;
    const aPriority = a.reduce((sum, question) => sum + questionPriority(question), 0);
    const bPriority = b.reduce((sum, question) => sum + questionPriority(question), 0);
    return bPriority - aPriority;
  })[0];
}

function buildFocusedPool<T extends ExamCandidate>(candidates: T[]) {
  const primarySubsubject = pickBestGroup(groupBy(candidates, (question) => question.subsubject?.name));

  if (!primarySubsubject) {
    return {
      focusSubsubjectName: "Submaterias combinadas",
      questions: sortForExamProgression(candidates),
    };
  }

  const focusSubsubjectName = primarySubsubject[0]?.subsubject?.name ?? "Submaterias combinadas";
  const focusSubjectName = primarySubsubject[0]?.subject?.name;
  const sameSubject = focusSubjectName
    ? candidates.filter((question) => question.subject?.name === focusSubjectName)
    : [];

  return {
    focusSubsubjectName,
    questions: sortForExamProgression(uniqueById([...primarySubsubject, ...sameSubject, ...candidates])),
  };
}

function pickIncrementalQuestions<T extends ExamCandidate>(candidates: T[], count: number) {
  const focused = buildFocusedPool(candidates);
  const selected: T[] = [];
  const selectedIds = new Set<string>();

  for (const targetDifficulty of examDifficultyPlan.slice(0, count)) {
    const exactCandidate = focused.questions.find(
      (question) => question.difficulty === targetDifficulty && !selectedIds.has(question.id),
    );
    const fallbackCandidate = focused.questions.find((question) => !selectedIds.has(question.id));
    const nextQuestion = exactCandidate ?? fallbackCandidate;

    if (!nextQuestion) break;

    selected.push(nextQuestion);
    selectedIds.add(nextQuestion.id);
  }

  return {
    focusSubsubjectName: focused.focusSubsubjectName,
    questions: sortForExamProgression(selected),
  };
}

function pickBalancedByArea<T extends { areaId: string }>(questions: T[], limit: number) {
  const byArea = new Map<string, T[]>();

  for (const question of questions) {
    const group = byArea.get(question.areaId) ?? [];
    group.push(question);
    byArea.set(question.areaId, group);
  }

  const selected: T[] = [];

  for (const group of byArea.values()) {
    if (selected.length >= limit) break;
    const question = group.shift();
    if (question) selected.push(question);
  }

  for (const question of questions) {
    if (selected.length >= limit) break;
    if (!selected.some((selectedQuestion) => selectedQuestion === question)) {
      selected.push(question);
    }
  }

  return selected.slice(0, limit);
}

export async function GET() {
  const db = getPrisma();

  const [areas, professors] = await Promise.all([
    db.lawArea.findMany({
      where: { questions: { some: { isActive: true } } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    db.professor.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return NextResponse.json({
    facets: {
      areas: areas.map((area) => area.name),
      professors: professors.map((professor) => professor.name),
      difficulties: ["low", "medium", "high"],
    },
  });
}

export async function POST(request: Request) {
  const parsed = examSessionRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const db = getPrisma();
  const { filters, perQuestionSeconds, questionsPerTopic, strategy } = parsed.data;
  const topicOrder = parsed.data.topicOrder?.map((topic) => topic.trim()).filter(Boolean) ?? [];
  const uniqueTopicOrder = Array.from(new Set(topicOrder));

  if (topicOrder.length > 0 && topicOrder.length !== 3) {
    return NextResponse.json(
      { error: "El simulacro de grado necesita exactamente 3 materias ordenadas." },
      { status: 400 },
    );
  }

  if (uniqueTopicOrder.length !== topicOrder.length) {
    return NextResponse.json(
      { error: "No podés repetir materias en el orden del simulacro." },
      { status: 400 },
    );
  }

  const limit = topicOrder.length > 0 ? topicOrder.length * questionsPerTopic : parsed.data.limit;
  const candidateLimit = Math.min(limit * 8, 360);
  const baseQuestionWhere = {
    isActive: true,
    difficulty: filters.difficulty,
    professors: filters.professor ? { some: { professor: { name: filters.professor } } } : undefined,
    NOT: {
      states: {
        some: {
          userId: data.user.id,
          isExcluded: true,
        },
      },
    },
    states:
      strategy === "weak"
        ? { some: { userId: data.user.id, averageScore: { lt: 65 }, attemptCount: { gt: 0 } } }
        : undefined,
  };

  const questionInclude = {
    area: true,
    subject: true,
    subsubject: true,
    professors: { include: { professor: true } },
    states: { where: { userId: data.user.id }, take: 1 },
    _count: { select: { keyPoints: true } },
  };

  const candidates =
    topicOrder.length > 0
      ? (
          await Promise.all(
            topicOrder.map((topicName) =>
              db.question.findMany({
                where: {
                  ...baseQuestionWhere,
                  area: { name: topicName },
                },
                include: questionInclude,
                orderBy: [{ priorityScore: "desc" }, { estimatedProbability: "desc" }],
                take: Math.max(questionsPerTopic * 12, 120),
              }),
            ),
          )
        ).flat()
      : await db.question.findMany({
          where: baseQuestionWhere,
          include: questionInclude,
          orderBy: [{ priorityScore: "desc" }, { estimatedProbability: "desc" }],
          take: candidateLimit,
        });

  const selectedSections = topicOrder.map((topicName, sectionIndex) => {
    const topicCandidates = candidates.filter((question) => question.area.name === topicName);
    const picked = pickIncrementalQuestions(topicCandidates, questionsPerTopic);

    return {
      sectionIndex,
      topicName,
      focusSubsubjectName: picked.focusSubsubjectName,
      questions: picked.questions,
    };
  });

  const incompleteSection = selectedSections.find((section) => section.questions.length < questionsPerTopic);

  if (incompleteSection) {
    return NextResponse.json(
      {
        error: `No hay ${questionsPerTopic} preguntas disponibles para ${incompleteSection.topicName} con esos filtros.`,
      },
      { status: 404 },
    );
  }

  const selected =
    topicOrder.length > 0
      ? selectedSections.flatMap((section) => section.questions)
      : strategy === "balanced"
        ? pickBalancedByArea(candidates, limit)
        : candidates.slice(0, limit);

  const sectionByQuestionId = new Map(
    selectedSections.flatMap((section) =>
      section.questions.map((question, questionIndex) => [
        question.id,
        {
          sectionIndex: section.sectionIndex,
          sectionQuestionNumber: questionIndex + 1,
          sectionTitle: section.topicName,
          focusSubsubjectName: section.focusSubsubjectName,
        },
      ]),
    ),
  );

  if (selected.length === 0) {
    return NextResponse.json(
      { error: "No hay preguntas disponibles para iniciar el simulacro con esos filtros." },
      { status: 404 },
    );
  }

  const session = await db.practiceSession.create({
    data: {
      userId: data.user.id,
      mode: "random",
      filters: {
        examMode: true,
        strategy,
        perQuestionSeconds,
        questionsPerTopic: topicOrder.length > 0 ? questionsPerTopic : null,
        topicOrder,
        selectedQuestions: selected.map((question) => ({
          id: question.id,
          ...(sectionByQuestionId.get(question.id) ?? {}),
        })),
        difficulty: filters.difficulty ?? null,
        professor: filters.professor ?? null,
      },
      totalQuestions: selected.length,
    },
  });

  for (const question of selected) {
    await db.studentQuestionState.upsert({
      where: {
        userId_questionId: {
          userId: data.user.id,
          questionId: question.id,
        },
      },
      create: {
        userId: data.user.id,
        questionId: question.id,
        status: "in_practice",
      },
      update: question.states[0]?.status === "pending" ? { status: "in_practice" } : {},
    });
  }

  const [professors] = await Promise.all([
    db.professor.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return NextResponse.json({
    sessionId: session.id,
    mode: "exam",
    config: {
      limit: selected.length,
      perQuestionSeconds,
      totalSeconds: selected.length * perQuestionSeconds,
      strategy,
      topics: topicOrder,
      questionsPerTopic: topicOrder.length > 0 ? questionsPerTopic : null,
    },
    facets: {
      areas: topicOrder,
      professors: professors.map((professor) => professor.name),
      difficulties: ["low", "medium", "high"],
    },
    questions: selected.map((question) => ({
      id: question.id,
      statement: question.statement,
      areaName: question.area.name,
      subjectName: question.subject?.name ?? "Sin materia",
      subsubjectName: question.subsubject?.name ?? "Sin submateria",
      professorName: question.professors.map((link) => link.professor.name).join(", ") || "Sin profesor",
      difficulty: question.difficulty,
      estimatedProbability: Number(question.estimatedProbability),
      priorityScore: Number(question.priorityScore),
      keyPointCount: question._count.keyPoints,
      attemptCount: question.states[0]?.attemptCount ?? 0,
      bestScore: Number(question.states[0]?.bestScore ?? 0),
      ...(sectionByQuestionId.get(question.id) ?? {}),
    })),
  });
}
