import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { upsertTodoistConnection } from '@/lib/db'
import { getAppBaseUrl } from '@/lib/notion'
import {
  exchangeTodoistAuthorizationCode,
  getTodoistProjects,
  verifyTodoistOauthState,
} from '@/lib/todoist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('todoist', status)
  return url
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(buildAppRedirect('auth_required'))
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const todoistError = req.nextUrl.searchParams.get('error')

  if (todoistError) {
    return NextResponse.redirect(buildAppRedirect('connect_denied'))
  }

  if (!code || !state || !verifyTodoistOauthState(state, user.id)) {
    return NextResponse.redirect(buildAppRedirect('invalid_state'))
  }

  try {
    const oauth = await exchangeTodoistAuthorizationCode(code)
    const projects = await getTodoistProjects(oauth.access_token).catch(() => [])
    const fallbackProject =
      projects.find((project) => project?.id && project.is_inbox_project)?.id ??
      projects.find((project) => project?.id)?.id ??
      null

    await upsertTodoistConnection({
      userId: user.id,
      accessToken: oauth.access_token,
      projectId: fallbackProject,
      userEmail: null,
      userName: null,
    })

    return NextResponse.redirect(buildAppRedirect('connected'))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[ActionExtractor] todoist callback error:', message)
    return NextResponse.redirect(buildAppRedirect('error'))
  }
}
