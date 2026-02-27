# Sistema de Carpetas — Documentación técnica detallada

## Índice

1. [Visión general](#1-visión-general)
2. [Esquema de base de datos](#2-esquema-de-base-de-datos)
3. [Tipos de carpetas](#3-tipos-de-carpetas)
4. [IDs y convenciones de nomenclatura](#4-ids-y-convenciones-de-nomenclatura)
5. [API REST](#5-api-rest)
6. [Capa de base de datos (lib/db.ts)](#6-capa-de-base-de-datos-libdbts)
7. [Sistema de carpetas compartidas](#7-sistema-de-carpetas-compartidas)
8. [Frontend — FolderDock](#8-frontend--folderdock)
9. [Hook useFolders](#9-hook-usefolders)
10. [Flujo completo de compartir una carpeta](#10-flujo-completo-de-compartir-una-carpeta)
11. [Flujo completo de cargar carpetas al iniciar sesión](#11-flujo-completo-de-cargar-carpetas-al-iniciar-sesión)
12. [Restricciones y reglas de negocio](#12-restricciones-y-reglas-de-negocio)
13. [Gotchas y errores conocidos](#13-gotchas-y-errores-conocidos)

---

## 1. Visión general

El sistema de carpetas de Action Extractor organiza las extracciones de cada usuario dentro de una estructura jerárquica tipo "playbook". Cada usuario tiene:

- **Carpetas propias**: creadas y administradas por el usuario.
- **Carpetas del sistema**: creadas automáticamente por la aplicación (no se pueden eliminar ni renombrar).
- **Carpetas compartidas conmigo**: carpetas de otros usuarios que les fueron compartidas al usuario autenticado.

La interfaz visual es un dock lateral (FolderDock) estilo cuaderno/playbook, donde se puede navegar por el árbol de carpetas, arrastrar extracciones hacia ellas, y gestionar quién tiene acceso.

---

## 2. Esquema de base de datos

### Tabla `extraction_folders`

```sql
CREATE TABLE extraction_folders (
  id         TEXT        PRIMARY KEY,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT 'indigo',
  parent_id  TEXT        REFERENCES extraction_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Columna     | Descripción |
|-------------|-------------|
| `id`        | Identificador único. Puede ser un UUID generado, el ID corto `'general'`, o un ID de sistema con prefijo `ae-system-folder:`. |
| `user_id`   | Propietario de la carpeta. Siempre apunta al creador/dueño. |
| `name`      | Nombre visible en la UI. |
| `color`     | Color de la pestaña en el playbook. Valores permitidos: `amber`, `indigo`, `emerald`, `rose`, `sky`, `violet`, `orange`. |
| `parent_id` | Referencia a la carpeta padre (NULL si es raíz). Usa `ON DELETE CASCADE`, por lo que eliminar un padre elimina todos los hijos. |

**Índices**:
```sql
CREATE INDEX idx_extraction_folders_user_id   ON extraction_folders(user_id);
CREATE INDEX idx_extraction_folders_parent_id ON extraction_folders(parent_id);
```

---

### Tabla `extraction_folder_members`

Controla qué usuarios tienen acceso a las carpetas compartidas por otros usuarios.

```sql
CREATE TABLE extraction_folder_members (
  folder_id       TEXT NOT NULL REFERENCES extraction_folders(id) ON DELETE CASCADE,
  owner_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'viewer',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (folder_id, member_user_id),
  CONSTRAINT extraction_folder_members_role_check CHECK (role IN ('viewer'))
);
```

| Columna          | Descripción |
|------------------|-------------|
| `folder_id`      | Carpeta que se está compartiendo. Debe existir en `extraction_folders`. |
| `owner_user_id`  | Quién comparte (dueño de la carpeta). **No está en la PK** — el conflicto se resuelve por `(folder_id, member_user_id)`. |
| `member_user_id` | Quién recibe acceso. |
| `role`           | Actualmente solo `'viewer'` (solo lectura). |

> **Importante**: La PRIMARY KEY es `(folder_id, member_user_id)`, no incluye `owner_user_id`. Esto significa que un `member_user_id` solo puede aparecer una vez por carpeta, independientemente de quién sea el dueño.

**Índices**:
```sql
CREATE INDEX idx_extraction_folder_members_owner_user_id  ON extraction_folder_members(owner_user_id);
CREATE INDEX idx_extraction_folder_members_member_user_id ON extraction_folder_members(member_user_id);
CREATE INDEX idx_extraction_folder_members_folder_id      ON extraction_folder_members(folder_id);
```

---

## 3. Tipos de carpetas

### 3.1 Carpetas del sistema (system folders)

Son creadas automáticamente por la aplicación cada vez que el usuario hace una petición que llama a `ensureDefaultExtractionFoldersForUser()`. No pueden eliminarse ni moverse.

Definidas en `lib/extraction-folders.ts`:

| Clave (`key`) | Nombre en UI                         | Color  |
|---------------|--------------------------------------|--------|
| `general`     | General                              | indigo |
| `shared-with-me` | Playbooks compartidos conmigo     | sky    |

Estas carpetas tienen IDs con el formato especial `ae-system-folder:{key}:{userId}` (ver sección 4).

### 3.2 Carpetas de usuario

Carpetas normales creadas por el usuario desde la UI. Su `id` es un UUID v4 generado aleatoriamente (o uno personalizado si el cliente lo envía). Pueden anidarse indefinidamente.

### 3.3 Carpetas compartidas conmigo

Son carpetas de *otro* usuario que han sido compartidas con el usuario autenticado. **No existen físicamente en la tabla `extraction_folders` del receptor** — se cargan dinámicamente desde `extraction_folder_members` y se "montan" bajo la carpeta de sistema `shared-with-me` en el árbol del cliente.

---

## 4. IDs y convenciones de nomenclatura

### IDs de carpetas del sistema

```
ae-system-folder:{key}:{userId}
```

**Ejemplos**:
```
ae-system-folder:general:13273c34-01cd-45df-a9c9-7fe09bfaaaaa
ae-system-folder:shared-with-me:13273c34-01cd-45df-a9c9-7fe09bfaaaaa
```

Funciones relevantes en `lib/extraction-folders.ts`:

```typescript
// Construye el ID de una carpeta de sistema para un usuario específico
buildSystemExtractionFolderIdForUser({ userId, key })

// Detecta si un ID pertenece a una carpeta del sistema
isSystemExtractionFolderId(id)  // → boolean

// Extrae la clave (general | shared-with-me) del ID
resolveSystemExtractionFolderKey(id)  // → SystemExtractionFolderKey | null

// Verifica si el ID es una carpeta protegida (del sistema) del usuario dado
isProtectedExtractionFolderIdForUser({ userId, id })  // → boolean
```

### IDs de carpetas de usuario

UUID v4 estándar generado con `randomUUID()` de Node.js, o el valor personalizado que envíe el cliente (si no contiene el prefijo reservado).

**Excepción**: La carpeta de sistema `general` usa el ID literal `'general'` (sin prefijo), ya que fue creada antes de implementar el formato `ae-system-folder:`.

---

## 5. API REST

### `GET /api/folders`

Retorna todas las carpetas propias del usuario autenticado.

**Respuesta**:
```json
{
  "folders": [
    { "id": "...", "name": "...", "color": "indigo", "parentId": null }
  ]
}
```

Las carpetas del sistema (`general`, `shared-with-me`) se incluyen aquí porque existen en `extraction_folders` con `user_id` del usuario.

---

### `POST /api/folders`

Crea una nueva carpeta para el usuario autenticado.

**Body**:
```json
{
  "name": "Mi carpeta",
  "color": "rose",
  "parentId": "uuid-de-la-carpeta-padre-o-null",
  "id": "uuid-opcional-personalizado"
}
```

**Validaciones**:
- `name`: requerido, máximo 80 caracteres.
- `color`: debe ser uno de los 7 valores permitidos.
- `id`: no puede empezar con `ae-system-folder:` (prefijo reservado).
- `parentId`: si se provee, debe existir y pertenecer al mismo usuario. No puede apuntar a `shared-with-me`.
- Una carpeta no puede ser su propio padre.

**Respuesta exitosa** (`201`):
```json
{ "folder": { "id": "...", "name": "...", "color": "...", "parentId": "..." } }
```

---

### `DELETE /api/folders/[folderId]`

Elimina una carpeta y **toda su descendencia** (recursivo via CTE), y desvincula las extracciones que estuvieran en ellas (las deja con `folder_id = NULL`).

**Protección**: no se puede eliminar una carpeta del sistema (retorna 403).

**Respuesta**:
```json
{ "ok": true, "deletedIds": ["uuid1", "uuid2", ...] }
```

---

### `GET /api/folders/[folderId]/members`

Lista los usuarios con acceso a una carpeta (solo el dueño puede consultar esto).

**Respuesta**:
```json
{
  "folderId": "...",
  "members": [
    {
      "folderId": "...",
      "ownerUserId": "...",
      "memberUserId": "...",
      "role": "viewer",
      "createdAt": "...",
      "userName": "...",
      "userEmail": "..."
    }
  ]
}
```

---

### `POST /api/folders/[folderId]/members`

Comparte una carpeta con otro usuario por email.

**Body**:
```json
{ "email": "destinatario@ejemplo.com" }
```

**Validaciones**:
- El email se normaliza: `trim().toLowerCase()`.
- La carpeta debe existir y pertenecer al usuario autenticado.
- No se puede compartir una carpeta del sistema.
- No se puede compartir con uno mismo.
- El destinatario debe tener cuenta registrada en la aplicación.

Si la carpeta ya está compartida con ese usuario, hace **upsert** (actualiza el rol).

---

### `DELETE /api/folders/[folderId]/members/[memberUserId]`

Revoca el acceso de un miembro a una carpeta.

**Validaciones**:
- Solo el dueño de la carpeta puede revocar.
- No se puede revocar el acceso al propio dueño.

---

### `GET /api/folders/shared-with-me`

Retorna todas las carpetas compartidas con el usuario autenticado, junto con su árbol completo de subcarpetas.

**Respuesta**:
```json
{
  "folders": [
    {
      "id": "uuid-original",
      "name": "Nombre de la carpeta",
      "color": "rose",
      "parentId": "ae-system-folder:shared-with-me:{userId}",
      "ownerUserId": "uuid-del-dueño",
      "ownerName": "Nombre del dueño",
      "ownerEmail": "dueno@ejemplo.com",
      "rootSharedFolderId": "uuid-raíz-compartida"
    }
  ]
}
```

**Lógica de `parentId`**:
- Si la carpeta es la raíz del árbol compartido (`id === rootSharedFolderId`) → su `parentId` se fuerza a `ae-system-folder:shared-with-me:{userId}`.
- Si la carpeta no tiene padre en el conjunto de resultados → también se coloca bajo `shared-with-me`.
- Si la carpeta sí tiene padre conocido dentro del conjunto → conserva su `parent_id` original.

---

## 6. Capa de base de datos (`lib/db.ts`)

### Funciones principales

| Función | Descripción |
|---------|-------------|
| `ensureDefaultExtractionFoldersForUser(userId)` | Crea o actualiza las carpetas del sistema (`general`, `shared-with-me`) del usuario. Idempotente via `ON CONFLICT DO UPDATE`. |
| `listExtractionFoldersByUser(userId)` | Lista todas las carpetas propias del usuario, ordenadas con raíces primero. |
| `findExtractionFolderByIdForUser({ id, userId })` | Busca una carpeta específica del usuario. |
| `createExtractionFolderForUser({userId, name, color, parentId, id?})` | Crea una carpeta. El `INSERT` incluye un `WHERE` que verifica que el padre exista y pertenezca al mismo usuario. |
| `deleteExtractionFolderTreeForUser({ id, userId })` | Elimina recursivamente la carpeta y sus hijos. Desvincula las extracciones afectadas. |
| `updateExtractionFolderForUser({ id, userId, folderId })` | Mueve una extracción a otra carpeta (actualiza `extractions.folder_id`). |

### Funciones de miembros/compartir

| Función | Descripción |
|---------|-------------|
| `listExtractionFolderMembersForOwner({ folderId, ownerUserId })` | Lista los miembros de una carpeta. Solo funciona para el dueño. |
| `upsertExtractionFolderMemberForOwner({ folderId, ownerUserId, memberUserId, role })` | Inserta o actualiza un miembro. El INSERT usa `ON CONFLICT (folder_id, member_user_id) DO UPDATE SET role`. |
| `removeExtractionFolderMemberForOwner({ folderId, ownerUserId, memberUserId })` | Elimina un miembro. Verifica que el dueño sea correcto via `JOIN` con `extraction_folders`. |
| `listSharedExtractionFoldersForMember(userId)` | Carga todas las carpetas compartidas con un usuario usando una CTE recursiva. |

### CTE recursiva de `listSharedExtractionFoldersForMember`

```sql
WITH RECURSIVE
  shared_roots AS (
    -- Paso 1: encuentra las raíces directamente compartidas
    SELECT fm.folder_id AS root_folder_id, fm.owner_user_id
    FROM extraction_folder_members fm
    WHERE fm.member_user_id = $1
  ),
  shared_tree AS (
    -- Paso 2: ancla (las raíces)
    SELECT sr.owner_user_id, sr.root_folder_id, f.*, 0 AS depth
    FROM shared_roots sr
    INNER JOIN extraction_folders f ON f.id = sr.root_folder_id
                                    AND f.user_id = sr.owner_user_id
    UNION ALL
    -- Paso 3: recursión (los hijos)
    SELECT st.owner_user_id, st.root_folder_id, child.*, st.depth + 1
    FROM extraction_folders child
    INNER JOIN shared_tree st ON child.parent_id = st.id
                               AND child.user_id = st.owner_user_id
  ),
  dedup AS (
    -- Evita duplicados si una carpeta se comparte desde múltiples caminos
    SELECT DISTINCT ON (st.owner_user_id, st.id) ...
    FROM shared_tree st
    ORDER BY st.owner_user_id, st.id, st.depth ASC
  )
SELECT d.*, owner.name, owner.email
FROM dedup d
INNER JOIN users owner ON owner.id = d.owner_user_id
```

Esta consulta expande automáticamente todos los hijos y nietos de las carpetas raíz compartidas, sin importar la profundidad del árbol.

---

## 7. Sistema de carpetas compartidas

### Flujo de datos

```
DB: extraction_folder_members
    ↓ (listSharedExtractionFoldersForMember)
GET /api/folders/shared-with-me
    ↓ (normalizeSharedFolder — en page.tsx)
sharedFolders[] en estado de React
    ↓ (allFolders useMemo)
FolderDock recibe folders={allFolders}
    ↓ (childrenByParent useMemo)
Árbol visual con sección "Compartidos conmigo"
```

### Normalización en el cliente (`normalizeSharedFolder`)

Definida en `app/(main)/app/page.tsx`. Transforma la respuesta de la API en un objeto `FolderItem` compatible con el FolderDock:

```typescript
const SHARED_FOLDER_CLIENT_ID_PREFIX = 'ae-shared-folder'

function normalizeSharedFolder(raw): FolderItem {
  return {
    id: `${SHARED_FOLDER_CLIENT_ID_PREFIX}:${raw.ownerUserId}:${raw.id}`,
    name: raw.name,
    color: raw.color,
    parentId: raw.parentId,  // ya viene ajustado desde la API
    isShared: true,
    ownerUserId: raw.ownerUserId,
    ownerName: raw.ownerName,
    ownerEmail: raw.ownerEmail,
    rootSharedFolderId: raw.rootSharedFolderId,
    originalId: raw.id,      // ID real en la DB del dueño
  }
}
```

El `id` en el cliente usa el prefijo `ae-shared-folder:` para evitar colisiones con IDs de carpetas propias del receptor.

---

## 8. Frontend — FolderDock

**Archivo**: `app/home/components/FolderDock.tsx`

### Responsabilidades

- Renderizar el árbol de carpetas como pestañas de un playbook.
- Agrupar las carpetas propias y las compartidas en secciones separadas.
- Permitir crear, renombrar y eliminar carpetas.
- Mostrar quién es el dueño de cada carpeta compartida.
- Manejar la apertura/cierre del drawer lateral.

### Construcción del árbol (`childrenByParent`)

```typescript
const childrenByParent = useMemo(() => {
  const map = new Map<string | null, FolderItem[]>()
  const folderById = new Map(folders.map(f => [f.id, f]))

  folders.forEach((folder) => {
    // Si el parentId existe en el mapa de carpetas conocidas, úsalo.
    // Si no, colócalo en la raíz (null).
    const parentId = folder.parentId && folderById.has(folder.parentId)
      ? folder.parentId
      : null
    // ...agrega al map
  })
  return map
}, [folders])
```

Este mecanismo garantiza que:
- Si una carpeta tiene `parentId` pero el padre no está en la lista (p.ej. el padre fue eliminado), la carpeta aparece como raíz en lugar de desaparecer.
- Las carpetas compartidas cuyo `parentId` es `ae-system-folder:shared-with-me:{userId}` se agrupan correctamente bajo ese nodo.

### Auto-expansión

El FolderDock auto-expande:
1. Todas las carpetas raíz al cargar.
2. La carpeta `shared-with-me` cuando existen carpetas compartidas.
3. La carpeta que contiene la extracción actualmente seleccionada.

---

## 9. Hook `useFolders`

**Archivo**: `app/home/hooks/useFolders.ts`

Maneja la carga y estado de las carpetas propias del usuario:

```typescript
function normalizeFolder(raw): FolderItem {
  return {
    id: raw.id,
    name: raw.name,
    color: raw.color,
    parentId: raw.parentId ?? null,
    isShared: false,
  }
}
```

Las carpetas propias **no incluyen** `ownerUserId`, `ownerName`, ni `ownerEmail` — solo las carpetas compartidas tienen esos campos.

Las carpetas compartidas se cargan por separado con `loadSharedFolders()` en `page.tsx` y se combinan en el `useMemo` de `allFolders`:

```typescript
const allFolders = useMemo(
  () => [...folders, ...sharedFolders],
  [folders, sharedFolders]
)
```

---

## 10. Flujo completo de compartir una carpeta

```
Usuario A (dueño)                    Backend                           DB
     │                                  │                               │
     │  POST /api/folders/:id/members   │                               │
     │  { email: "b@example.com" }      │                               │
     │─────────────────────────────────>│                               │
     │                                  │ findExtractionFolderById(id)  │
     │                                  │──────────────────────────────>│
     │                                  │<──────────────────────────────│
     │                                  │ findUserByEmail(email)        │
     │                                  │──────────────────────────────>│
     │                                  │<── { id, name, email }        │
     │                                  │ upsertExtractionFolderMember  │
     │                                  │──────────────────────────────>│
     │                                  │ INSERT INTO folder_members    │
     │                                  │ ON CONFLICT DO UPDATE role    │
     │                                  │<──────────────────────────────│
     │<─────────────────────────────────│                               │
     │  { folderId, member: {...} }      │                               │
     │                                  │                               │

Usuario B (receptor) abre la app
     │                                  │                               │
     │  GET /api/folders/shared-with-me │                               │
     │─────────────────────────────────>│                               │
     │                                  │ listSharedFolders(user.id)    │
     │                                  │──────────────────────────────>│
     │                                  │ CTE recursiva: raíces + hijos │
     │                                  │<── [{ id, name, color, ... }] │
     │                                  │ Ajusta parentId de raíces     │
     │                                  │ → ae-system-folder:shared-... │
     │<─────────────────────────────────│                               │
     │  { folders: [...] }              │                               │
     │                                  │                               │
     │ normalizeSharedFolder()          │                               │
     │ → id: ae-shared-folder:A:uuid   │                               │
     │ → parentId: ae-system-folder:.. │                               │
     │                                  │                               │
     │ allFolders = [...own, ...shared] │                               │
     │ FolderDock renderiza árbol       │                               │
```

---

## 11. Flujo completo de cargar carpetas al iniciar sesión

```
handleAuthenticated()
  ├── loadFolders()          →  GET /api/folders
  ├── loadHistory()          →  GET /api/history
  └── refreshSharedResources()
        └── loadSharedFolders()  →  GET /api/folders/shared-with-me

Ambos resultados llegan a:
  folders       = propias del usuario   (desde useFolders hook)
  sharedFolders = compartidas conmigo   (estado en page.tsx)

allFolders = useMemo([...folders, ...sharedFolders])
  ↓
FolderDock recibe folders={allFolders}
  ↓
childrenByParent construye el árbol
  ↓
render: rootFolders.map(renderFolderNode)
```

---

## 12. Restricciones y reglas de negocio

| Regla | Dónde se aplica |
|-------|-----------------|
| No se puede eliminar una carpeta del sistema | API DELETE `/api/folders/:id` + `deleteExtractionFolderTreeForUser` |
| No se puede crear una carpeta con ID reservado (`ae-system-folder:`) | API POST `/api/folders` |
| No se puede crear una subcarpeta dentro de `shared-with-me` | API POST `/api/folders` (revisa `resolveSystemExtractionFolderKey`) |
| No se puede compartir una carpeta del sistema | API POST `/api/folders/:id/members` |
| No se puede compartir con uno mismo | API POST `/api/folders/:id/members` |
| El destinatario debe tener cuenta | API POST `/api/folders/:id/members` → `findUserByEmail` |
| Solo el dueño puede ver la lista de miembros | API GET `/api/folders/:id/members` → `findExtractionFolderByIdForUser` |
| Solo el dueño puede revocar acceso | API DELETE `/api/folders/:id/members/:userId` |
| Los colores válidos son un conjunto fijo | API POST/PATCH → `ALLOWED_FOLDER_COLORS` set |
| Nombre máximo 80 caracteres | API POST `/api/folders` |
| Eliminar una carpeta desvincula sus extracciones | `deleteExtractionFolderTreeForUser` → `UPDATE extractions SET folder_id = NULL` |

---

## 13. Gotchas y errores conocidos

### El email debe coincidir exactamente con la cuenta registrada

El sistema normaliza el email con `trim().toLowerCase()` antes de buscarlo. Sin embargo, si el usuario A escribe `WePerezH01@gmail.com` y la cuenta registrada es `weperezh01@gmail.com`, la normalización funciona bien. El problema surge si se confunden letras, por ejemplo `weperezh01` vs `wdperezh01` — son dos cuentas distintas y el sistema no advierte sobre la similitud.

**Recomendación**: Implementar una búsqueda difusa o mostrar el nombre completo del usuario antes de confirmar el compartir.

---

### Las carpetas compartidas no aparecen si el receptor no ha iniciado sesión al menos una vez

`ensureDefaultExtractionFoldersForUser` crea la carpeta `shared-with-me` en la DB cuando el usuario hace la primera petición a `/api/folders/shared-with-me`. Si el receptor nunca ha iniciado sesión, esa carpeta de sistema no existe como nodo padre en el árbol.

Esto no es un problema funcional porque el endpoint siempre llama a `ensureDefaultExtractionFoldersForUser` antes de responder.

---

### La PK de `extraction_folder_members` no incluye `owner_user_id`

La PRIMARY KEY es `(folder_id, member_user_id)`. Esto significa que un mismo `folder_id` solo puede estar compartido con un `member_user_id` una vez, independientemente del dueño. En la práctica esto no es un problema porque un `folder_id` solo tiene un dueño, pero es un detalle a tener en cuenta si en el futuro se transfiere la propiedad de carpetas.

---

### Las carpetas compartidas tienen IDs sintéticos en el cliente

En el cliente, el ID de una carpeta compartida es `ae-shared-folder:{ownerUserId}:{originalId}`, no el ID real de la DB. Esto significa que **no se puede usar el ID del cliente directamente en llamadas a la API**. Siempre hay que usar `folder.originalId` (el ID real) para operaciones como mover extracciones o hacer peticiones de lectura.

---

### Eliminación en cascada

Si el dueño elimina una carpeta que está compartida con otros usuarios:
1. `ON DELETE CASCADE` en `extraction_folder_members.folder_id` elimina automáticamente los registros de compartir.
2. Los receptores dejarán de ver la carpeta en su próxima carga de `shared-with-me`.
3. No hay notificación al receptor sobre la eliminación.
