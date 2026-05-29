import fs from "node:fs/promises";
import { getPrisma } from "../../src/lib/db/prisma";
import { SOURCE_MANIFEST, resolveSourcePath } from "./source-manifest";

async function main() {
  const db = getPrisma();
  let imported = 0;

  for (const source of SOURCE_MANIFEST) {
    const absolutePath = resolveSourcePath(source);
    const exists = await fs.access(absolutePath).then(() => true).catch(() => false);

    if (!exists) {
      console.warn(`Omitido: no existe ${source.relativePath}`);
      continue;
    }

    const area = source.areaName
      ? await db.lawArea.upsert({
          where: { name: source.areaName },
          create: { name: source.areaName },
          update: {},
        })
      : null;

    await db.sourceDocument.upsert({
      where: { filePath: source.relativePath },
      create: {
        title: source.title,
        filePath: source.relativePath,
        documentType: source.type,
        areaId: area?.id,
        metadata: {
          key: source.key,
          kind: source.kind,
          notes: source.notes ?? null,
          originalRelativePath: source.relativePath,
        },
        processedAt: null,
      },
      update: {
        title: source.title,
        documentType: source.type,
        areaId: area?.id,
        metadata: {
          key: source.key,
          kind: source.kind,
          notes: source.notes ?? null,
          originalRelativePath: source.relativePath,
        },
      },
    });

    imported += 1;
  }

  console.log(`Registrados ${imported} documentos fuente en Supabase/Postgres.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
