# Fase 5 - Práctica real con usuario y progreso

La Fase 5 conecta el módulo de práctica con Supabase Auth y PostgreSQL.

## Objetivo

Permitir que la estudiante:

1. Inicie sesión o cree una cuenta.
2. Abra una sesión de práctica real.
3. Reciba preguntas desde la base de datos.
4. Envíe respuestas escritas para evaluación real.
5. Guarde intentos, feedback y porcentaje obtenido.
6. Actualice el estado de cada pregunta: dominada, necesita repaso o excluida.

## Rutas agregadas

```txt
GET  /auth/login
GET  /auth/callback
POST /api/practice/sessions
GET  /api/practice/progress
PATCH /api/questions/:questionId/state
```

También se extendió:

```txt
POST /api/evaluations
```

Ahora acepta `sessionId` y guarda el intento asociado a la sesión.

## Flujo para probar

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/auth/login
```

Crear cuenta o iniciar sesión con Supabase Auth.

Luego:

```txt
http://localhost:3000/practice
```

Esperado:

- En modo real, si no hay sesión activa, muestra aviso para iniciar sesión.
- En modo demo, funciona sin login.
- En modo real con login, crea una sesión en `practice_sessions`.
- Al evaluar, crea un registro en `practice_attempts`.
- También crea feedback en `attempt_feedback`.
- Actualiza `student_question_states`.

## Validación rápida

```powershell
npm test
npx prisma validate
```

No ejecutar build salvo que se pida explícitamente.

## Limitaciones conocidas

- La evaluación real usa OpenAI y requiere `OPENAI_API_KEY`.
- La autenticación depende de la configuración de Supabase Auth del proyecto.
- Aún no existe dashboard histórico completo.
- La práctica por voz queda para la siguiente fase.
