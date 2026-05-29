# Grade Law Study

Plataforma web para preparar el examen de grado de Derecho mediante preguntas reales/generadas, respuestas por texto o voz, evaluaciÃƒÂ³n automÃƒÂ¡tica guiada por rÃƒÂºbrica y seguimiento de progreso.

## Stack definido

- Next.js en Vercel
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Prisma ORM
- OpenAI para transcripciÃƒÂ³n, generaciÃƒÂ³n y evaluaciÃƒÂ³n

## Regla del repo

No ejecutar `build` despuÃƒÂ©s de cambios salvo que el usuario lo pida expresamente. En esta sesiÃƒÂ³n el usuario pidiÃƒÂ³ probar build.

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

Ingesta contra Supabase/Postgres, despuÃƒÂ©s de configurar `.env` y aplicar migraciÃƒÂ³n:

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

## Fase 4 - Practica por texto

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
