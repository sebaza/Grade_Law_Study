export type DemoQuestion = {
  sourceReference: string;
  statement: string;
  areaName: string;
  subjectName: string;
  subsubjectName: string;
  professorName: string;
  difficulty: "low" | "medium" | "high";
  estimatedProbability: number;
  priorityScore: number;
  questionType: "definition" | "case" | "comparison" | "application" | "general";
  origin: "real_question";
  expectedAnswer: string;
  rubricNotes: string;
  keyPoints: Array<{
    label: string;
    description: string;
    weight: number;
    isRequired: boolean;
    orderIndex: number;
  }>;
  commonErrors: Array<{
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  metadata: Record<string, unknown>;
};

export type DemoQuestionBank = {
  generatedAt: string;
  generationMethod: string;
  targetQuestionCount: number;
  questionCount: number;
  sourceSummary: Record<string, unknown>;
  questions: DemoQuestion[];
};

export type PracticeFilters = {
  area?: string;
  professor?: string;
  difficulty?: string;
  mode?: "priority" | "random" | "review";
};
