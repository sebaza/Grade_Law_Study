# Fase 7 - Historial y estadísticas reales

La Fase 7 agrega seguimiento histórico sobre datos persistidos en Supabase/Postgres.

## Objetivo

Permitir que la estudiante revise:

1. Avance general.
2. Promedio de acierto.
3. Cantidad de sesiones e intentos.
4. Tiempo total de estudio.
5. Evolución diaria de porcentaje.
6. Materias fuertes y débiles.
7. Promedio por área y profesor.
8. Preguntas con peor desempeño.
9. Intentos recientes con feedback.

## Rutas agregadas

```txt
GET /history
GET /api/practice/history
GET /api/practice/stats
```

Ambos endpoints requieren sesión Supabase activa.

## Flujo para probar

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/auth/login
http://localhost:3000/history
```

Esperado:

- Sin sesión: la página muestra aviso para iniciar sesión.
- Con sesión: muestra KPIs, ranking de materias, preguntas difíciles e intentos recientes.
- Si la estudiante todavía no tiene intentos, muestra estados vacíos sin romper la página.

## Datos usados

- `practice_attempts`
- `attempt_feedback`
- `practice_sessions`
- `student_question_states`
- `questions`
- `subjects`
- `law_areas`
- `professors`

## Validación rápida

```powershell
npm test
npx prisma validate
```

No ejecutar build salvo pedido explícito.

## Limitaciones conocidas

- Aún no hay exportación PDF/Excel.
- La página no permite abrir el detalle completo de cada intento en una ruta propia.
- La recomendación automática avanzada queda para una fase posterior.
