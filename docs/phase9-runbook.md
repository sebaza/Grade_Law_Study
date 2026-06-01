# Fase 9 - Modo simulacro de examen

Objetivo: simular una ronda de examen de grado con preguntas reales del banco, tiempo por pregunta, respuesta escrita u oral, evaluación automática y veredicto final.

## Entregables

- Vista `GET /exam`.
- API protegida `POST /api/exam/sessions`.
- API protegida `POST /api/exam/sessions/:sessionId/finish`.
- Selección de preguntas para simulacro:
  - estrategia balanceada por áreas;
  - estrategia por prioridad/probabilidad;
  - estrategia por materias débiles.
- Temporizador por pregunta.
- Respuesta por texto.
- Respuesta por voz con transcripción reutilizando `POST /api/transcriptions`.
- Evaluación por rúbrica reutilizando `POST /api/evaluations`.
- Resultado final:
  - promedio;
  - puntaje más bajo;
  - preguntas respondidas;
  - tiempo usado;
  - veredicto tipo `Competente`, `Necesita refuerzo` o `Simulacro incompleto`.

## Decisión técnica

El simulacro reutiliza `PracticeSession` y `PracticeAttempt`.

Esto evita crear tablas nuevas antes de necesitar reportes más finos y mantiene un solo historial de intentos para práctica, voz, feedback y estadísticas.

La sesión se marca como simulacro mediante `filters.examMode = true`.

## Regla de veredicto MVP

Una sesión queda como `Competente` si:

- todas las preguntas fueron respondidas;
- el promedio es mayor o igual a `70%`;
- ningún puntaje individual queda bajo `50%`.

Si faltan preguntas, el resultado es `Simulacro incompleto`.

En los demás casos, el resultado es `Necesita refuerzo`.

## Cómo probar

No ejecutar build salvo instrucción explícita.

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/auth/login
http://localhost:3000/exam
```

Flujo recomendado:

1. Iniciar sesión.
2. Entrar a `/exam`.
3. Configurar 3 preguntas y 5 minutos por pregunta.
4. Iniciar simulacro.
5. Responder por texto o voz.
6. Enviar cada respuesta.
7. Cerrar simulacro.
8. Revisar veredicto y preguntas con menor puntaje.

## Smoke tests esperados sin sesión

- `GET /exam` responde `200`.
- `POST /api/exam/sessions` responde `401`.
- `POST /api/exam/sessions/:sessionId/finish` responde `401`.

## Limitaciones actuales

- No hay rúbrica separada por modalidad simulacro; se usa la misma rúbrica general.
- No hay bloqueo estricto cuando se agota el tiempo; se muestra advertencia y la estudiante debe enviar.
- No hay panel comparativo entre simulacros todavía.
- `PracticeSession.mode` queda como `random`; el carácter de simulacro vive en `filters.examMode`.

## Próxima mejora natural

- Crear tipo de sesión `exam` en Prisma.
- Agregar reportes comparativos entre simulacros.
- Agregar modo “última semana antes del examen”.
- Agregar simulacro con estructura por comisión/profesor.
- Exportar resultado del simulacro a PDF.
