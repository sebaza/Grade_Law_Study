# Fase 4 - Práctica por texto

La Fase 4 habilita el primer flujo usable de práctica escrita.

## Objetivo

Permitir que la estudiante:

1. Abra un módulo de práctica.
2. Vea preguntas del banco generado en Fase 3.
3. Filtre por area, profesor y dificultad.
4. Escriba una respuesta.
5. Reciba una evaluación por rúbrica.
6. Vea puntos correctos, puntos faltantes y respuesta modelo inicial.

## Importante sobre el `.env`

Conviene empezar el `.env` ahora, no al final.

Motivo: Fase 4 puede probarse en modo demo sin Supabase, pero la práctica real necesita persistencia, usuarios, intentos y evaluación definitiva. Si se posterga la integración hasta el final, se acumula riesgo técnico.

## Modo demo sin Supabase

Este modo usa:

- `data/processed/question-bank.seed.json`
- `/api/practice/demo`
- `/api/evaluations/demo`

Comandos:

```powershell
npm run phase3:dry-run
npm run dev
```

Abrir:

```txt
http://localhost:3000/practice
```

Esperado:

- Se muestran preguntas del banco inicial.
- Funcionan filtros.
- Se puede escribir respuesta.
- Se muestra evaluación demo por los 4 criterios de rúbrica.

## Modo real con Supabase/OpenAI

Requiere `.env` real:

```txt
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY= # opcional legacy
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_EVALUATION_MODEL=gpt-4.1-mini
```

Luego:

```powershell
npm run db:generate
npm run phase3:db
npm run dev
```

El endpoint real de evaluación ya existe en:

```txt
POST /api/evaluations
```

Pero la UI de esta fase usa demo para no bloquear por Auth/Supabase. En la siguiente fase se conecta la UI a sesiones reales y persistencia.

## Validacion de cierre

```powershell
npm run phase3:dry-run
npm test
npm run build
```

## Limitaciones conocidas

- La evaluación demo es heurística local. No reemplaza la evaluación con OpenAI.
- No persiste intentos todavia.
- No requiere login.
- La siguiente fase debe conectar práctica real con usuario, sesiones e historial.
