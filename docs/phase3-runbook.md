# Fase 3 - Banco inicial de preguntas

La Fase 3 convierte las preguntas crudas del DOCX y la matriz del Excel en un banco inicial normalizado.

## Objetivo

Generar preguntas estudiables con:

- enunciado normalizado
- area
- materia
- submateria
- profesor
- dificultad
- probabilidad estimada
- prioridad
- respuesta esperada inicial
- puntos clave
- errores comunes
- referencia trazable a la fuente original

## Importante

Esta fase usa generacion heuristica local, no IA. La idea es construir una base revisable y trazable antes de pedirle a un modelo que refine respuestas o genere variantes. Conceptos primero, magia despues.

## Archivos nuevos

- `scripts/generate/question-bank.ts` - genera el banco local en JSON.
- `scripts/generate/seed-question-bank.ts` - importa el banco generado a Supabase/Postgres.
- `data/processed/question-bank.seed.json` - banco generado por dry-run.
- `supabase/migrations/0002_questions_source_reference_unique.sql` - indice unico para idempotencia.

## Dry-run local sin Supabase

```powershell
npm run phase3:dry-run
```

Esperado:

```txt
Banco generado en ...\data\processed\question-bank.seed.json
Preguntas generadas: 120
Candidatas elegibles: 266/980
```

Distribucion esperada del banco inicial:

| Profesor | Area | Preguntas |
| --- | --- | ---: |
| Felipe Ortiz | Derecho Procesal | 69 |
| Stephanie Merlet | Derecho Civil | 35 |
| Mauricio Figueroa | Derecho Constitucional | 16 |

Esta distribucion se calcula con cuotas ponderadas por `score_prioridad` del Excel, para no caer en aleatorio puro ni dejar Constitucional afuera.

## Modo DB con Supabase/Postgres

Requisitos:

1. `.env` real configurado.
2. Migraciones aplicadas:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_questions_source_reference_unique.sql`
3. Prisma generado:

```powershell
npm run db:generate
```

Luego:

```powershell
npm run phase3:db
```

Ese comando ejecuta:

```powershell
npm run phase2:db
npm run phase3:dry-run
npm run seed:question-bank
```

Esperado:

```txt
Registrados 8 documentos fuente en Supabase/Postgres.
Importadas 28 prioridades desde el Excel.
Importadas 980/981 preguntas candidatas desde el DOCX.
Preguntas generadas: 120
Importadas 120/120 preguntas normalizadas a Supabase/Postgres.
```

## Validacion final de fase

```powershell
npm run phase3:dry-run
npm test
npm run build
```

## Limitaciones conocidas

- Las respuestas esperadas son iniciales; si existe respuesta base en el DOCX, se usa. Si no existe, se genera una pauta minima heuristica.
- Los puntos clave se extraen de oraciones de la respuesta base. Esto requiere revision juridica posterior.
- La clasificacion de submateria usa coincidencia de tokens contra el Excel, no comprension semantica profunda.
- La Fase 4 o una fase de refinamiento con IA deberia mejorar respuestas, puntos clave y errores comunes.
