import type { ShareVisibility } from '@/app/home/lib/types'

export function normalizeShareVisibility(value: unknown): ShareVisibility {
  if (value === 'public') return 'public'
  if (value === 'unlisted') return 'unlisted'
  if (value === 'circle') return 'circle'
  return 'private'
}

export function isShareVisibilityShareable(value: ShareVisibility): boolean {
  return value === 'public' || value === 'unlisted'
}

export function getShareVisibilityLabel(value: ShareVisibility): string {
  if (value === 'public') return 'Público'
  if (value === 'unlisted') return 'Solo con enlace'
  if (value === 'circle') return 'Círculo'
  return 'Privado'
}

export function getShareVisibilityChangeNotice(value: ShareVisibility): string {
  if (value === 'public') return 'Contenido marcado como Público. Ya puedes compartir su enlace.'
  if (value === 'unlisted') return 'Contenido marcado como Solo con enlace. Ya puedes compartir su enlace privado.'
  if (value === 'circle') return 'Contenido marcado como Círculo. Solo tu círculo podrá acceder.'
  return 'Contenido marcado como Privado. El enlace compartido dejará de estar disponible.'
}
