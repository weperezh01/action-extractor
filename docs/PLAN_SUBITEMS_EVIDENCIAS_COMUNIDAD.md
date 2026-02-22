# Plan de Continuidad: Subitems con Evidencias y Comunidad

Fecha de referencia: 2026-02-22  
Proyecto: `action-extractor`  
Objetivo del archivo: que cualquier agente futuro entienda rapido el contexto funcional y tecnico de esta linea de trabajo.

## 1) Contexto de producto

La aplicacion esta enfocada en emprendedores, vendedores y personas que quieren ejecutar planes concretos a partir de contenido (videos de YouTube).  
El valor no es solo "resumir", sino convertir cada extraccion en un sistema accionable con seguimiento y evidencia real.

## 2) Estado actual (ya implementado)

- Extraccion en varios modos (Plan de Accion, Resumen Ejecutivo, Ideas de Negocio, Frases clave).
- Historial por usuario, con identificador unico y numero de orden.
- Contenido editable:
  - agregar/editar/eliminar items principales.
  - agregar/editar/eliminar subitems.
- Checklist interactivo por subitem (estado, marcado, eventos).
- Visibilidad del contenido (`private` / `public`) con enlaces compartibles solo en modo publico.
- UI de contenido mejorada:
  - controles y acciones reubicados en zona superior.
  - paneles colapsables con animaciones suaves.
  - numeracion jerarquica en subitems (`1.1`, `1.2`, `1.3`, etc.).

## 3) Problema a resolver ahora

Los subitems necesitan soportar trabajo real de ejecucion/documentacion:

- Adjuntar evidencia (PDF, imagen, audio).
- Asociar enlaces externos (ejemplo: video en YouTube con miniatura).
- Mantener orden y claridad visual.
- Habilitar interaccion comunitaria en contenido publico (comentarios y likes), sin dar permisos de edicion estructural.

## 4) Vision funcional del siguiente MVP

Convertir cada subitem en una "unidad de ejecucion" con 3 capas:

1. `Checklist`: estado y avance.
2. `Evidencias`: archivos y enlaces asociados.
3. `Comunidad`: comentarios y likes.

## 5) Alcance MVP recomendado (fase inmediata)

Incluido en MVP:

- Evidencias por subitem:
  - subir `PDF`, `imagen`, `audio`.
  - agregar enlace YouTube (guardando miniatura y metadata basica).
- Visualizacion clara de evidencias dentro del subitem expandido.
- Comentarios por subitem para usuarios autenticados.
- Like por subitem (toggle 1 usuario = 1 like).
- Reglas de permisos:
  - Dueño/editor: puede crear/editar/eliminar estructura y evidencias.
  - Usuario autenticado sin permisos de edicion: puede comentar y dar like en contenido publico.

Fuera de MVP (dejar para despues):

- Subida de video nativo (archivo grande).
- Co-edicion en tiempo real.
- Menciones avanzadas, notificaciones complejas, versionado avanzado.

## 6) Decisiones tecnicas recomendadas

### 6.1 Almacenamiento de archivos

Recomendacion inicial: `Cloudinary`.

Motivos:

- Implementacion rapida.
- Buen manejo de imagen/audio y transformaciones.
- URLs firmadas y delivery confiable.

Estrategia futura:

- Si sube mucho costo/volumen, migrar a `S3/R2` manteniendo contrato de metadatos en DB.

### 6.2 Modelo de datos propuesto

Seguir convencion SQL existente (`snake_case`, timestamps ISO, foreign keys).

Tablas nuevas:

1. `extraction_task_attachments`
- `id` text pk
- `task_id` text fk -> `extraction_tasks.id`
- `extraction_id` text fk -> `extractions.id`
- `user_id` text fk -> `users.id` (quien adjunto)
- `attachment_type` text (`pdf` | `image` | `audio` | `youtube_link`)
- `storage_provider` text (`cloudinary` | `external`)
- `url` text not null
- `thumbnail_url` text null
- `title` text null
- `mime_type` text null
- `size_bytes` bigint null
- `metadata_json` text default `'{}'`
- `created_at` timestamptz
- `updated_at` timestamptz

Indices:
- `(task_id, created_at desc)`
- `(extraction_id)`
- `(user_id)`

2. `extraction_task_comments`
- `id` text pk
- `task_id` text fk -> `extraction_tasks.id`
- `extraction_id` text fk -> `extractions.id`
- `user_id` text fk -> `users.id`
- `content` text not null
- `created_at` timestamptz
- `updated_at` timestamptz
- `deleted_at` timestamptz null (soft delete opcional)

Indices:
- `(task_id, created_at asc)`
- `(extraction_id, created_at desc)`

3. `extraction_task_likes`
- `id` text pk
- `task_id` text fk -> `extraction_tasks.id`
- `extraction_id` text fk -> `extractions.id`
- `user_id` text fk -> `users.id`
- `created_at` timestamptz
- `unique(task_id, user_id)` para evitar likes duplicados

Indice:
- `(task_id)`

Futuro (no MVP inmediato):

4. `extraction_members`
- para colegas y roles (`owner`, `editor`, `viewer`).

## 7) API propuesta (MVP)

Rutas orientativas bajo `/api/extractions/[extractionId]/tasks/[taskId]`:

1. Evidencias
- `GET /attachments`
- `POST /attachments` (crear evidencia)
- `DELETE /attachments/[attachmentId]`

Para subida:
- opcion simple: backend recibe `multipart/form-data` y sube a Cloudinary.
- opcion escalable: backend emite firma/preset y cliente sube directo a Cloudinary, luego guarda metadato.

2. Comentarios
- `GET /comments`
- `POST /comments`
- `DELETE /comments/[commentId]` (solo autor o owner)

3. Likes
- `POST /likes/toggle`
- respuesta incluye `likesCount` y `likedByMe`.

Reglas de autorizacion:
- Si extraccion es privada: solo owner (y futuros miembros autorizados).
- Si extraccion es publica:
  - lectura abierta a usuarios autenticados de la plataforma.
  - comentar/like permitido a usuarios autenticados.
  - editar estructura/evidencias solo owner/editor.

## 8) UI/UX propuesta para claridad

En cada subitem expandido mostrar secciones:

- `Checklist`
- `Evidencias (N)`
- `Comunidad (comentarios + likes)`

Patrones visuales:

- Lista de evidencias con icono por tipo (`PDF`, `IMG`, `AUDIO`, `YOUTUBE`).
- Enlace YouTube con miniatura visible.
- Contadores siempre visibles para reducir confusion.
- CTA claros: `Adjuntar archivo`, `Agregar enlace`, `Comentar`, `Me gusta`.

## 9) Roadmap sugerido por fases

### Fase 1 (prioridad alta)

- Schema DB + migracion.
- CRUD de evidencias (PDF/imagen/audio + YouTube link).
- Integracion Cloudinary.
- UI de evidencias en subitem.

### Fase 2

- Comentarios por subitem.
- Likes por subitem.
- Conteos y estados (`likedByMe`).

### Fase 3

- Sistema de colegas (miembros) y roles.
- Permisos granulares por extraccion.

## 10) Criterios de aceptacion MVP

- Un owner puede adjuntar y eliminar evidencias en subitems sin romper checklist/eventos.
- Se visualizan miniaturas/enlaces correctamente (incluyendo YouTube).
- Usuarios autenticados pueden comentar y dar like en contenido publico.
- Usuarios sin permiso de edicion no pueden modificar estructura ni evidencias de otros.
- UI mantiene claridad en mobile y desktop.
- Typecheck y pruebas basicas de rutas pasan.

## 11) Riesgos y mitigaciones

- Riesgo: abuso de almacenamiento/subidas.
  - Mitigar con limites por tipo/tamano y rate limiting.
- Riesgo: contenido publico sensible.
  - Mitigar con visibilidad clara, defaults privados y controles de moderacion futura.
- Riesgo: complejidad UX.
  - Mitigar con tabs simples y contadores visibles.

## 12) Nota para futuros agentes

Antes de implementar fases nuevas:

1. Revisar contratos actuales de `ResultPanel`, `HistoryPanel`, y rutas `tasks`.
2. Mantener compatibilidad con `share_visibility`.
3. No romper la edicion de items/subitems ya existente.
4. Validar siempre con `npx tsc --noEmit` despues de cambios estructurales.

