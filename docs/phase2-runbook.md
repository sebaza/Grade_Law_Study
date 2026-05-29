# Fase 2 - Runbook de ingesta

La Fase 2 convierte los documentos existentes del proyecto en datos verificables.

## Objetivo

Validar e importar las fuentes disponibles:

- Excel de prioridad y probabilidad por profesor.
- DOCX de preguntas reales recopiladas.
- PDF de rubrica.
- PDF de reglamento.
- PDFs de temarios/cedularios.

## Archivos nuevos de la fase

- `scripts/ingest/source-manifest.ts` - manifiesto unico de fuentes.
- `scripts/ingest/analyze-sources.ts` - analisis local sin base de datos.
- `scripts/ingest/source-documents.ts` - registra documentos fuente en Supabase/Postgres.
- `data/processed/phase2-source-analysis.json` - reporte generado por dry-run.

## Comando local sin Supabase

Usalo para probar que los documentos se leen correctamente:

```powershell
npm run phase2:dry-run
```

Esperado:

```txt
Analisis generado en ...\data\processed\phase2-source-analysis.json
```

El reporte debe mostrar:

- 8 fuentes detectadas.
- 28 filas en el Excel.
- 981 preguntas candidatas desde el DOCX.
- PDFs con conteo de paginas y caracteres.

## Comando con Supabase configurado

Primero debe existir `.env` real con:

```txt
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Despues aplicar la migracion:

```powershell
# opcion manual: pegar supabase/migrations/0001_initial_schema.sql en Supabase SQL Editor
```

Luego correr:

```powershell
npm run db:generate
npm run phase2:db
```

`phase2:db` ejecuta:

```powershell
npm run ingest:documents
npm run ingest:excel
npm run ingest:questions
```

Esperado:

```txt
Registrados 8 documentos fuente en Supabase/Postgres.
Importadas 28 prioridades desde el Excel.
Importadas 981 preguntas candidatas desde Cuestionario Examen de Grado - Jose Espejo.
```

## Validacion final de fase

```powershell
npm test
npm run build
```

Esperado:

- TypeScript sin errores.
- ESLint sin errores.
- Build de Next exitoso.

## Advertencia importante

El parser de DOCX es heuristico. Detecta preguntas por signos `?`, `¿` o lineas que empiezan con `Caso.`. Esto sirve para ingesta inicial, pero antes de generar el banco final hay que revisar y normalizar preguntas ambiguas.
