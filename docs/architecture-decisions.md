# Decisiones de arquitectura

## Decisión 1 - Vercel + Supabase

Se usará Vercel para hospedar la aplicación Next.js y Supabase para Postgres, Auth y Storage.

Motivo:

- Vercel simplifica deploy del frontend/backend Next.js.
- Supabase da Postgres real, Auth, Storage y RLS.
- El proyecto necesita persistencia relacional fuerte más que búsqueda vectorial en el MVP.

## Decisión 2 - No pgvector en MVP

Se descartó pgvector para la primera versión porque la confusión era con Vercel. Puede agregarse más adelante si se necesita búsqueda semántica sobre temarios o respuestas.

## Decisión 3 - Excel como fuente estratégica

El archivo `frequency_relevance_matrix.xlsx` es fuente primaria para prioridad y probabilidad inicial.

Campos usados:

- `professor`
- `area`
- `subarea`
- `frecuencia`
- `% profesor`
- `alineacion_temario`
- `relevancia`
- `score_prioridad`

## Decisión 4 - Evaluación por rúbrica real

La evaluación automática debe reflejar los 4 criterios del PDF de rúbrica:

1. Detección y manejo de normas jurídicas aplicables.
2. Manejo de teorías y conceptos técnico-jurídicos.
3. Aplicación de conceptos y normas a planteamientos prácticos.
4. Fundamentación y orden de las respuestas.

Cada criterio usa escala institucional: 10, 8, 6, 4, 2.

## Decisión 5 - Transcripción editable

La respuesta oral no se evalúa directamente desde audio. Primero se transcribe, luego la estudiante puede revisar/corregir y recién ahí se evalúa.

Motivo: evitar castigar errores de transcripción como si fueran errores jurídicos.
