import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  listCircleExtractionsForMember,
  listExtractionsSharedViaFoldersForMember,
} from '@/lib/db'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const [directRows, folderRows] = await Promise.all([
      listCircleExtractionsForMember(user.id, 80),
      listExtractionsSharedViaFoldersForMember(user.id, 120),
    ])

    const byExtractionId = new Map<
      string,
      {
        id: string
        orderNumber: number
        shareVisibility: string
        url: string | null
        videoId: string | null
        videoTitle: string | null
        thumbnailUrl: string | null
        mode: ReturnType<typeof normalizeExtractionMode>
        objective: string
        phases: unknown[]
        proTip: string
        metadata: Record<string, unknown>
        createdAt: string
        sourceType: string
        sourceLabel: string | null
        folderId: string | null
        accessRole: 'viewer' | 'editor'
        ownerName: string | null
        ownerEmail: string | null
        shareSource: 'direct' | 'folder' | 'both'
        sharedFolderContext: {
          rootFolderId: string | null
          rootFolderName: string | null
        } | null
      }
    >()

    const upsertSharedExtraction = (input: {
      row: (typeof directRows)[number] | (typeof folderRows)[number]
      shareSource: 'direct' | 'folder'
      rootFolderId: string | null
      rootFolderName: string | null
    }) => {
      const extraction = input.row.extraction
      const key = extraction.id
      const nextAccessRole = input.row.access_role === 'editor' ? 'editor' : 'viewer'
      const existing = byExtractionId.get(key)

      if (!existing) {
        byExtractionId.set(key, {
          id: extraction.id,
          orderNumber: extraction.order_number ?? 0,
          shareVisibility: extraction.share_visibility ?? 'private',
          url: extraction.url,
          videoId: extraction.video_id,
          videoTitle: extraction.video_title,
          thumbnailUrl:
            extraction.thumbnail_url ||
            (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : null),
          mode: normalizeExtractionMode(extraction.extraction_mode),
          objective: extraction.objective,
          phases: safeParse(extraction.phases_json, []),
          proTip: extraction.pro_tip,
          metadata: safeParse(extraction.metadata_json, {
            readingTime: '3 min',
            difficulty: 'Media',
            originalTime: '0m',
            savedTime: '0m',
          }),
          createdAt: extraction.created_at,
          sourceType: extraction.source_type ?? 'youtube',
          sourceLabel: extraction.source_label ?? null,
          folderId: extraction.folder_id ?? null,
          accessRole: nextAccessRole,
          ownerName: input.row.owner_name,
          ownerEmail: input.row.owner_email,
          shareSource: input.shareSource,
          sharedFolderContext:
            input.shareSource === 'folder'
              ? {
                  rootFolderId: input.rootFolderId,
                  rootFolderName: input.rootFolderName,
                }
              : null,
        })
        return
      }

      const mergedAccessRole =
        existing.accessRole === 'editor' || nextAccessRole === 'editor' ? 'editor' : 'viewer'
      const mergedShareSource =
        existing.shareSource === input.shareSource ? existing.shareSource : 'both'

      byExtractionId.set(key, {
        ...existing,
        accessRole: mergedAccessRole,
        shareSource: mergedShareSource,
        sharedFolderContext:
          existing.sharedFolderContext ??
          (input.shareSource === 'folder'
            ? {
                rootFolderId: input.rootFolderId,
                rootFolderName: input.rootFolderName,
              }
            : null),
      })
    }

    directRows.forEach((row) => {
      upsertSharedExtraction({
        row,
        shareSource: 'direct',
        rootFolderId: null,
        rootFolderName: null,
      })
    })
    folderRows.forEach((row) => {
      upsertSharedExtraction({
        row,
        shareSource: 'folder',
        rootFolderId: row.root_folder_id,
        rootFolderName: row.root_folder_name,
      })
    })

    const items = Array.from(byExtractionId.values())
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
          return bTime - aTime
        }
        return b.id.localeCompare(a.id)
      })
      .slice(0, 120)

    return NextResponse.json({ items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los compartidos.'
    console.error('[ActionExtractor] shared-with-me GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar los compartidos.' }, { status: 500 })
  }
}
