# Roadmap por fases

## Fase 1 - Cimientos del producto

Objetivo: dejar preparado el proyecto para Vercel + Supabase + evaluación por rúbrica.

Entregables:

- Scaffold Next.js.
- Modelo de datos Supabase/Postgres.
- Migración SQL inicial.
- Prisma schema.
- Cliente Supabase y Prisma con inicialización lazy.
- Contrato de evaluación automática basado en la rúbrica real.
- Contrato de transcripción de audio.
- Scripts iniciales de ingesta del Excel y DOCX.

## Fase 2 - Ingesta real de fuentes

Objetivo: convertir los documentos actuales en datos operables.

Pasos:

1. Importar `frequency_relevance_matrix.xlsx` a `professor_topic_priorities`.
2. Importar `Cuestionario Examen de Grado - José Espejo.docx` a `raw_questions`.
3. Registrar PDFs de temario y rúbrica como `source_documents`.
4. Normalizar áreas, materias, submaterias y profesores.
5. Revisar preguntas candidatas ambiguas.

## Fase 3 - Banco inicial de preguntas

Objetivo: generar preguntas estudiables desde el material real.

Reglas:

- La probabilidad inicial sale del `score_prioridad` del Excel.
- Las preguntas reales tienen prioridad sobre preguntas inventadas.
- Cada pregunta debe tener respuesta esperada, puntos clave y errores comunes.
- Las variantes se generan solo para subáreas con prioridad alta o media.

## Fase 4 - Práctica por texto

Objetivo: que la estudiante pueda practicar y recibir evaluación.

Incluye:

- Listado de preguntas.
- Filtros por área, materia, profesor, dificultad y estado.
- Sesión de práctica.
- Respuesta escrita.
- Evaluación automática por rúbrica.
- Registro de intento y actualización de progreso.

## Fase 5 - Voz y transcripción

Objetivo: acercar la experiencia al examen oral.

Flujo:

1. Grabar audio.
2. Guardar en Supabase Storage.
3. Transcribir con OpenAI.
4. Mostrar transcripción editable.
5. Confirmar texto.
6. Evaluar con la misma rúbrica.

## Fase 6 - Estadísticas y mejora

Objetivo: convertir los intentos en decisiones de estudio.

Incluye:

- Materias débiles.
- Materias fuertes.
- Promedio por profesor.
- Preguntas más falladas.
- Preguntas críticas no practicadas.
- Recomendación de próxima sesión.

## Fase 7 - Modo simulacro

Objetivo: simular el examen real.

Incluye:

- Tres áreas obligatorias.
- Temporizador.
- Respuesta oral.
- Evaluación final por puntaje de rúbrica.
- Resultado tipo competente/no competente.

## Fase 8 - Banco editable y revisión manual

Objetivo: mantener el banco de preguntas sin depender de scripts.

Incluye:

- Panel protegido para preguntas.
- Edición de enunciados y metadata.
- Edición de respuesta esperada.
- Edición de puntos clave.
- Edición de errores comunes.
- Asociación de profesores.
- Archivo/reactivación sin borrar historial.

## Fase 9 - Modo simulacro

Objetivo: entrenar una ronda tipo examen con presión de tiempo y veredicto final.

Incluye:

- Selección de preguntas por estrategia.
- Temporizador por pregunta.
- Respuesta escrita u oral.
- Evaluación automática por rúbrica.
- Cierre de sesión de simulacro.
- Resultado tipo competente/no competente.
- Recomendación de repaso según desempeño.

## Fase 10 - Cierre de MVP y producción

Objetivo: dejar la plataforma lista para revisión final y despliegue.

Incluye:

- Validación de variables de entorno.
- Healthcheck de entorno y base de datos.
- Checklist Vercel.
- Checklist Supabase.
- Checklist funcional del MVP.
- Riesgos conocidos antes de producción.
- Recomendaciones para la siguiente versión.
