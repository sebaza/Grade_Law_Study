import { NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminUser } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/db/prisma";

export async function GET() {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const db = getPrisma();
  const [areas, subjects, subsubjects, professors] = await Promise.all([
    db.lawArea.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.subject.findMany({
      orderBy: [{ area: { name: "asc" } }, { name: "asc" }],
      select: { id: true, areaId: true, name: true },
    }),
    db.subsubject.findMany({
      orderBy: [{ subject: { name: "asc" } }, { name: "asc" }],
      select: { id: true, subjectId: true, name: true },
    }),
    db.professor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({
    admin: {
      email: admin.user.email,
      restrictedByEmail: admin.restrictedByEmail,
    },
    areas,
    subjects,
    subsubjects,
    professors,
  });
}
