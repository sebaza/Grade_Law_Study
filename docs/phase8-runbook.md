# Fase 8 - Banco editable y revisión manual

Objetivo: permitir que la estudiante o administradora mantenga el banco de preguntas desde la web, sin volver a ejecutar scripts para cada ajuste menor.

## Entregables

- Vista `GET /admin/questions`.
- API protegida `GET /api/admin/options`.
- API protegida `GET /api/admin/questions`.
- API protegida `POST /api/admin/questions`.
- API protegida `GET /api/admin/questions/:questionId`.
- API protegida `PATCH /api/admin/questions/:questionId`.
- API protegida `DELETE /api/admin/questions/:questionId`.
- Edición de:
  - enunciado;
  - área;
  - materia;
  - submateria;
  - dificultad;
  - probabilidad estimada;
  - prioridad;
  - tipo de pregunta;
  - origen;
  - referencia de fuente;
  - profesores asociados;
  - respuesta esperada;
  - notas de rúbrica;
  - puntos clave;
  - errores comunes;
  - estado activa/archivada.

## Seguridad

Los endpoints de administración requieren sesión Supabase.

Además, soportan una variable opcional:

```env
ADMIN_EMAILS=correo1@dominio.cl,correo2@dominio.cl
```

Reglas:

- Si `ADMIN_EMAILS` está configurado, solo esos correos pueden administrar el banco.
- Si `ADMIN_EMAILS` no está configurado, cualquier usuario autenticado puede administrar. Esto sirve para desarrollo local y MVP temprano, pero no debería usarse así en producción.

## Cómo probar

No ejecutar build salvo instrucción explícita.

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/auth/login
http://localhost:3000/admin/questions
```

Flujo recomendado:

1. Iniciar sesión.
2. Entrar a `/admin/questions`.
3. Filtrar por área o dificultad.
4. Seleccionar una pregunta existente.
5. Editar la respuesta esperada o puntos clave.
6. Guardar.
7. Archivar y reactivar una pregunta de prueba.
8. Crear una pregunta manual pequeña y revisar que aparezca en el listado.

## Validaciones técnicas

```powershell
npm test
npx prisma validate
git diff --check
```

Smoke tests esperados sin sesión:

- `GET /admin/questions` responde `200` porque la página renderiza y muestra aviso.
- `GET /api/admin/options` responde `401`.
- `GET /api/admin/questions` responde `401`.

## Decisión importante

El borrado no elimina físicamente la pregunta: `DELETE /api/admin/questions/:questionId` la archiva con `isActive = false`.

Motivo: preservar historial, intentos, feedback y estadísticas. En una plataforma de estudio, borrar físicamente preguntas usadas es una mala idea salvo que exista una política clara de purga.

## Limitaciones actuales

- No hay roles persistidos en base de datos; se usa `ADMIN_EMAILS`.
- Los puntos clave existentes se editan o se agregan, pero no se eliminan desde la UI para no romper intentos históricos asociados.
- No hay control de versiones avanzado de respuestas esperadas; se actualiza la versión activa.
- No hay revisión por lotes ni importación desde el panel todavía.

## Próxima mejora natural

- Agregar tabla de roles o permisos.
- Agregar historial de cambios de pautas.
- Agregar estado de revisión: `draft`, `reviewed`, `critical`.
- Permitir importación asistida desde Excel/PDF.
- Agregar vista de “preguntas críticas” según probabilidad alta y bajo desempeño.
