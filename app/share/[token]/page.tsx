import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  findSharedExtractionByToken,
  listExtractionTaskAttachmentsForSharedExtraction,
  listExtractionTasksWithEventsForSharedExtraction,
} from '@/lib/db'
import type { InteractiveTask, InteractiveTaskAttachment } from '@/app/home/lib/types'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'
import { SharePageContent } from './SharePageContent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_APP_URL = 'https://notesaide.com'
const DEFAULT_SHARE_DESCRIPTION =
  'Shared Result – Notes Aide Action Extractor. Convierte videos de YouTube en planes accionables.'
const DEFAULT_SOCIAL_IMAGE = '/notes-aide-logo.png'

// React cache deduplica la consulta DB entre generateMetadata y el componente
const getSharedExtraction = cache((token: string) => findSharedExtractionByToken(token))
const getSharedTasks = cache((extractionId: string) =>
  listExtractionTasksWithEventsForSharedExtraction(extractionId)
)
const getSharedAttachments = cache((extractionId: string) =>
  listExtractionTaskAttachmentsForSharedExtraction(extractionId)
)

function resolveAppUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.ACTION_EXTRACTOR_APP_URL ?? DEFAULT_APP_URL
  const trimmed = candidate.trim()
  if (!trimmed) return DEFAULT_APP_URL
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function toAbsoluteUrl(value: string, appUrl: string) {
  if (!value) return null
  try {
    return new URL(value, `${appUrl}/`).toString()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { token: string }
}): Promise<Metadata> {
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  if (!token) return {}

  const extraction = await getSharedExtraction(token)
  if (!extraction) return {}

  const appUrl = resolveAppUrl()
  const shareUrl = `${appUrl}/share/${token}`
  const modeLabel = getExtractionModeLabel(normalizeExtractionMode(extraction.extraction_mode))
  const title = extraction.video_title
    ? `${modeLabel} | ${extraction.video_title} | Shared Result – Notes Aide Action Extractor`
    : `${modeLabel} | Shared Result – Notes Aide Action Extractor`
  const description = extraction.objective
    ? truncateText(extraction.objective, 220)
    : DEFAULT_SHARE_DESCRIPTION
  const rawImageUrl =
    extraction.thumbnail_url ||
    (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : '')
  const imageUrl = toAbsoluteUrl(rawImageUrl || DEFAULT_SOCIAL_IMAGE, appUrl)

  return {
    title,
    description,
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      title,
      description,
      url: shareUrl,
      type: 'website',
      siteName: 'Notes Aide Action Extractor',
      locale: 'es_ES',
      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                alt: extraction.video_title
                  ? `Miniatura del video: ${extraction.video_title}`
                  : 'Notes Aide Action Extractor shared result',
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }
}

function mapSharedTasksToInteractiveTasks(
  tasks: Awaited<ReturnType<typeof listExtractionTasksWithEventsForSharedExtraction>>
): InteractiveTask[] {
  return tasks.map((task) => ({
    id: task.id,
    extractionId: task.extraction_id,
    phaseId: task.phase_id,
    phaseTitle: task.phase_title,
    itemIndex: task.item_index,
    itemText: task.item_text,
    nodeId: task.node_id,
    parentNodeId: task.parent_node_id,
    depth: task.depth,
    positionPath: task.position_path,
    checked: task.checked,
    status: task.status,
    dueAt: task.due_at,
    completedAt: task.completed_at,
    scheduledStartAt: task.scheduled_start_at,
    scheduledEndAt: task.scheduled_end_at,
    durationDays: task.duration_days,
    predecessorIds: [],
    flowNodeType: (task.flow_node_type ?? 'process') as 'process' | 'decision',
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    events: task.events.map((event) => ({
      id: event.id,
      taskId: event.task_id,
      eventType: event.event_type,
      content: event.content,
      metadataJson: event.metadata_json,
      createdAt: event.created_at,
      userName: event.user_name ?? null,
      userEmail: event.user_email ?? null,
    })),
  }))
}

function mapSharedAttachmentsToInteractiveAttachments(
  attachments: Awaited<ReturnType<typeof listExtractionTaskAttachmentsForSharedExtraction>>
): InteractiveTaskAttachment[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    taskId: attachment.task_id,
    extractionId: attachment.extraction_id,
    attachmentType: attachment.attachment_type,
    storageProvider: attachment.storage_provider,
    url: attachment.url,
    thumbnailUrl: attachment.thumbnail_url,
    title: attachment.title,
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size_bytes,
    metadataJson: attachment.metadata_json,
    createdAt: attachment.created_at,
    updatedAt: attachment.updated_at,
    userName: attachment.user_name ?? null,
    userEmail: attachment.user_email ?? null,
  }))
}

export default async function SharePage({
  params,
}: {
  params: { token: string }
}) {
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  if (!token) {
    notFound()
  }

  const extraction = await getSharedExtraction(token)
  if (!extraction) {
    notFound()
  }

  const tasks = await getSharedTasks(extraction.id)
  const attachments = await getSharedAttachments(extraction.id)
  const interactiveTasks = mapSharedTasksToInteractiveTasks(tasks)
  const interactiveAttachments = mapSharedAttachmentsToInteractiveAttachments(attachments)

  return (
    <SharePageContent
      extraction={extraction}
      token={token}
      tasks={interactiveTasks}
      attachments={interactiveAttachments}
    />
  )
}
