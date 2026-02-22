import { createHash } from 'node:crypto'

export interface CloudinaryUploadResult {
  secureUrl: string
  publicId: string
  resourceType: string
  bytes: number | null
  format: string | null
  width: number | null
  height: number | null
  duration: number | null
}

interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
}

function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim()
  const apiKey = (process.env.CLOUDINARY_API_KEY ?? '').trim()
  const apiSecret = (process.env.CLOUDINARY_API_SECRET ?? '').trim()
  const folder = (process.env.CLOUDINARY_FOLDER ?? 'action-extractor/subitems').trim()

  if (!cloudName || !apiKey || !apiSecret) {
    return null
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: folder || 'action-extractor/subitems',
  }
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function buildCloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string
) {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return createHash('sha1')
    .update(`${canonical}${apiSecret}`)
    .digest('hex')
}

export function isCloudinaryConfigured() {
  return getCloudinaryConfig() !== null
}

export async function uploadFileToCloudinary(input: {
  fileBuffer: Buffer
  filename: string
  mimeType: string
}) {
  const config = getCloudinaryConfig()
  if (!config) {
    throw new Error(
      'Cloudinary no está configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.'
    )
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const signPayload = {
    folder: config.folder,
    timestamp,
  }
  const signature = buildCloudinarySignature(signPayload, config.apiSecret)

  const formData = new FormData()
  formData.set('api_key', config.apiKey)
  formData.set('timestamp', String(timestamp))
  formData.set('folder', config.folder)
  formData.set('signature', signature)
  formData.set('file', new Blob([input.fileBuffer], { type: input.mimeType }), input.filename)

  const uploadEndpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`
  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as
    | {
        secure_url?: unknown
        public_id?: unknown
        resource_type?: unknown
        bytes?: unknown
        format?: unknown
        width?: unknown
        height?: unknown
        duration?: unknown
        error?: { message?: unknown } | null
      }
    | null

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === 'string' && payload.error.message.trim()
        ? payload.error.message
        : 'Cloudinary rechazó la carga del archivo.'
    throw new Error(message)
  }

  const secureUrl =
    typeof payload?.secure_url === 'string' && payload.secure_url.trim() ? payload.secure_url : ''
  const publicId =
    typeof payload?.public_id === 'string' && payload.public_id.trim() ? payload.public_id : ''
  const resourceType =
    typeof payload?.resource_type === 'string' && payload.resource_type.trim()
      ? payload.resource_type
      : 'raw'

  if (!secureUrl || !publicId) {
    throw new Error('Cloudinary devolvió una respuesta incompleta al subir el archivo.')
  }

  return {
    secureUrl,
    publicId,
    resourceType,
    bytes: parseOptionalNumber(payload?.bytes),
    format: typeof payload?.format === 'string' ? payload.format : null,
    width: parseOptionalNumber(payload?.width),
    height: parseOptionalNumber(payload?.height),
    duration: parseOptionalNumber(payload?.duration),
  } satisfies CloudinaryUploadResult
}

export async function deleteCloudinaryAsset(input: {
  publicId: string
  resourceType?: string | null
}) {
  const config = getCloudinaryConfig()
  if (!config) return false

  const publicId = input.publicId.trim()
  if (!publicId) return false

  const resourceType = (input.resourceType ?? 'raw').trim() || 'raw'
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildCloudinarySignature(
    {
      public_id: publicId,
      timestamp,
    },
    config.apiSecret
  )

  const formData = new FormData()
  formData.set('public_id', publicId)
  formData.set('api_key', config.apiKey)
  formData.set('timestamp', String(timestamp))
  formData.set('signature', signature)

  const destroyEndpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/destroy`
  const response = await fetch(destroyEndpoint, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  })

  if (!response.ok) return false

  const payload = (await response.json().catch(() => null)) as { result?: unknown } | null
  return payload?.result === 'ok' || payload?.result === 'not found'
}
