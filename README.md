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
npm run env:check
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

## Fase 6 - Voz y transcripción

Respuesta oral con grabación en navegador, Supabase Storage y transcripción OpenAI:

```powershell
npm run dev
```

Abrir práctica real, cambiar a modo `Voz`, grabar, revisar transcripción y evaluar.

Ver detalles en `docs/phase6-runbook.md`.

## Fase 7 - Historial y estadísticas

Dashboard histórico con avance, promedio, materias débiles, preguntas difíciles e intentos recientes:

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/history
```

Ver detalles en `docs/phase7-runbook.md`.

## Fase 8 - Banco editable y revisión manual

Panel protegido para mantener preguntas, pautas, puntos clave, errores comunes, profesores y estado activo/archivado:

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/admin/questions
```

Para restringir el panel en despliegue:

```env
ADMIN_EMAILS=correo1@dominio.cl,correo2@dominio.cl
```

Ver detalles en `docs/phase8-runbook.md`.

## Fase 9 - Modo simulacro

Simulacro de examen con temporizador, respuestas por texto o voz, evaluación por rúbrica y veredicto final:

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/exam
```

Ver detalles en `docs/phase9-runbook.md`.

## Fase 10 - Cierre de MVP y producción

Checklist final para Vercel + Supabase + OpenAI, validación de entorno y healthcheck:

```powershell
npm run env:check
npm test
npx prisma validate
```

Healthcheck:

```txt
http://localhost:3000/api/health
```

Ver detalles en `docs/phase10-runbook.md`.
