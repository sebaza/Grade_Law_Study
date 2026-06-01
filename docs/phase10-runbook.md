# Fase 10 - Cierre de MVP y preparación para producción

Objetivo: dejar el proyecto listo para revisión final, despliegue en Vercel y operación mínima con Supabase/OpenAI.

## Entregables

- Endpoint `GET /api/health`.
- Script `npm run env:check`.
- `.env.example` actualizado con variables finales.
- Checklist de Vercel/Supabase/OpenAI.
- Checklist funcional del MVP.
- Documentación de comandos finales sin ejecutar build automáticamente.

## Variables requeridas

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=
OPENAI_EVALUATION_MODEL=
ADMIN_EMAILS=
```

`ADMIN_EMAILS` es opcional en desarrollo, pero recomendable en producción.
Para Supabase Auth se acepta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o, como fallback legacy, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Validar entorno local

```powershell
npm run env:check
```

El comando muestra qué variables existen, pero no imprime secretos.

## Healthcheck

Con servidor local:

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/api/health
```

Respuesta esperada:

- `200` si variables requeridas y PostgreSQL están disponibles.
- `503` si falta una variable requerida o falla la conexión a base de datos.

## Checklist Supabase

1. Confirmar que las migraciones fueron aplicadas.
2. Confirmar que `DATABASE_URL` usa pooler o conexión compatible con serverless.
3. Confirmar que `DIRECT_URL` apunta a conexión directa para Prisma.
4. Confirmar que Supabase Auth permite el dominio de Vercel.
5. Confirmar redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://TU-DOMINIO.vercel.app/auth/callback`
6. Confirmar bucket `answer-audios`.
7. Confirmar que `SUPABASE_SERVICE_ROLE_KEY` existe solo en servidor/Vercel, nunca como `NEXT_PUBLIC_`.

## Checklist Vercel

1. Crear proyecto Vercel conectado al repo.
2. Configurar variables de entorno en Production, Preview y Development según corresponda.
3. Confirmar que `.env` local no se commitea.
4. Ejecutar localmente:

```powershell
npm test
npx prisma validate
npm run env:check
```

5. Recién después, desplegar desde Vercel/GitHub.
6. Revisar `/api/health` en el deployment.
7. Probar login.
8. Probar práctica real.
9. Probar transcripción por voz.
10. Probar simulacro.

## Checklist funcional MVP

- Inicio carga correctamente.
- Login Supabase funciona.
- Banco de preguntas tiene datos.
- `/practice` permite responder por texto.
- `/practice` permite responder por voz.
- La evaluación guarda intentos.
- `/history` muestra progreso.
- `/admin/questions` permite editar preguntas.
- `/exam` permite cerrar un simulacro.
- `/api/health` responde OK en producción.

## Comandos recomendados antes del deploy

No se ejecutan automáticamente porque la regla del repo dice no correr build salvo instrucción explícita.

```powershell
npm run env:check
npm test
npx prisma validate
```

Build manual, solo cuando decidas hacerlo:

```powershell
npm run build
```

## Riesgos conocidos antes de producción

- No hay roles persistidos; `ADMIN_EMAILS` debe configurarse para no dejar el panel abierto a cualquier usuario autenticado.
- No hay rate limiting en APIs de IA; un usuario podría generar costos altos.
- No hay auditoría histórica de cambios del banco de preguntas.
- El healthcheck verifica conexión DB, pero no prueba OpenAI ni Supabase Storage para evitar efectos colaterales.
- El simulacro usa `PracticeSession.mode = random` y marca `filters.examMode = true`; suficiente para MVP, mejorable con una migración futura.

## Próxima versión después del MVP

- Roles reales en base de datos.
- Rate limiting por usuario.
- Exportar historial/simulacro a PDF.
- Panel de costos de IA.
- Control de versiones de pautas.
- Comparador de simulacros.
- Deploy pipeline con preview checks.
