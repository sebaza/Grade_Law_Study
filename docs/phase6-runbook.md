# Fase 6 - Voz y transcripción

La Fase 6 agrega respuesta oral al flujo de práctica real.

## Objetivo

Permitir que la estudiante:

1. Grabe una respuesta oral desde el navegador.
2. Suba el audio a Supabase Storage.
3. Transcriba el audio con OpenAI.
4. Revise y edite la transcripción.
5. Envíe la transcripción corregida al evaluador.
6. Guarde intento, audio, transcripción, feedback y progreso.

## Rutas usadas

```txt
POST /api/transcriptions
POST /api/evaluations
```

`POST /api/transcriptions` requiere sesión activa. Recibe `multipart/form-data` con:

```txt
audio=<archivo webm/mp3/mp4/wav/ogg>
```

Devuelve:

```json
{
  "audioPath": "...",
  "transcription": "...",
  "editable": true,
  "note": "..."
}
```

## Flujo para probar

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000/auth/login
http://localhost:3000/practice
```

Pasos:

1. Iniciar sesión.
2. Entrar a práctica en modo real.
3. Cambiar respuesta de `Texto` a `Voz`.
4. Presionar `Grabar respuesta`.
5. Hablar en español, claro y con pausas.
6. Presionar `Detener grabación`.
7. Esperar la transcripción.
8. Corregir la transcripción si hace falta.
9. Presionar `Evaluar y guardar intento`.

## Persistencia

Al evaluar una respuesta oral se guarda en:

- `practice_attempts.raw_answer` — texto evaluado.
- `practice_attempts.transcription` — transcripción editable enviada.
- `practice_attempts.audio_path` — ruta del audio en Supabase Storage.
- `attempt_feedback` — retroalimentación.
- `student_question_states` — estado y métricas por pregunta.

## Consideraciones

- La transcripción requiere `OPENAI_API_KEY`.
- El audio se limita a 25 MB.
- El endpoint acepta formatos comunes: webm, mp3, mp4, wav y ogg.
- El audio se sube con service role desde el servidor después de autenticar a la estudiante.
- La estudiante siempre debe revisar la transcripción antes de enviarla a evaluación.

## Validación rápida

```powershell
npm test
npx prisma validate
```

No ejecutar build salvo pedido explícito.
