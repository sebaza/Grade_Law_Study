# Grade Law Study

Plataforma web para preparar el examen de grado de Derecho mediante preguntas reales/generadas, respuestas por texto o voz, evaluación automática guiada por rúbrica y seguimiento de progreso.

## Stack definido

- Next.js en Vercel
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Prisma ORM
- OpenAI para transcripción, generación y evaluación

## Regla del repo

No ejecutar `build` después de cambios salvo que el usuario lo pida expresamente. En esta sesión el usuario pidió probar build.

## Comandos principales

```powershell
npm run db:generate
npm test
npm run build
npm run dev
```

## Fase 2 - Ingesta de fuentes

Dry-run local sin Supabase:

```powershell
npm run phase2:dry-run
```

Ingesta contra Supabase/Postgres, después de configurar `.env` y aplicar migración:

```powershell
npm run phase2:db
```

Ver detalles en `docs/phase2-runbook.md`.

## Fases

Ver `docs/phase-roadmap.md`.

## Fase 3 - Banco inicial de preguntas

Dry-run local sin Supabase:

```powershell
npm run phase3:dry-run
```

Ingesta completa contra Supabase/Postgres:

```powershell
npm run phase3:db
```

Ver detalles en `docs/phase3-runbook.md`.

## Fase 4 - Práctica por texto

Modo demo local:

```powershell
npm run phase3:dry-run
npm run dev
```

Abrir:

```txt
http://localhost:3000/practice
```

Ver detalles en `docs/phase4-runbook.md`.

## Fase 5 - Práctica real con usuario

Modo real con Supabase Auth, sesiones e intentos persistidos:

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/auth/login
http://localhost:3000/practice
```

Ver detalles en `docs/phase5-runbook.md`.
