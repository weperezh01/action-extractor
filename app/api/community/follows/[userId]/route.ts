import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findUserById,
  followCommunityUser,
  isCommunityUserFollowedBy,
  unfollowCommunityUser,
} from '@/lib/db'
import {
  buildCommunityActionRateLimitMessage,
  consumeUserCommunityActionRateLimit,
} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function GET(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const targetUserId = parseId(context.params?.userId)
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId inválido.' }, { status: 400 })
    }

    const targetUser = await findUserById(targetUserId)
    if (!targetUser) {
      return NextResponse.json({ error: 'No se encontró el usuario solicitado.' }, { status: 404 })
    }

    const followed = await isCommunityUserFollowedBy({
      followerUserId: user.id,
      followingUserId: targetUserId,
    })

    return NextResponse.json({
      userId: targetUserId,
      followed,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo consultar el estado de follow.'
    console.error('[ActionExtractor] community follow GET error:', message)
    return NextResponse.json({ error: 'No se pudo consultar el estado de follow.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const rateLimit = await consumeUserCommunityActionRateLimit(user.id, 'follow')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: buildCommunityActionRateLimitMessage('follow', rateLimit.limit),
          rateLimit: {
            limit: rateLimit.limit,
            used: rateLimit.used,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt,
          },
        }
      )
    }

    const targetUserId = parseId(context.params?.userId)
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId inválido.' }, { status: 400 })
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'No puedes seguirte a ti mismo.' }, { status: 400 })
    }

    const targetUser = await findUserById(targetUserId)
    if (!targetUser) {
      return NextResponse.json({ error: 'No se encontró el usuario solicitado.' }, { status: 404 })
    }

    const followed = await followCommunityUser({
      followerUserId: user.id,
      followingUserId: targetUserId,
    })

    if (!followed) {
      return NextResponse.json({ error: 'No se pudo seguir al usuario.' }, { status: 400 })
    }

    return NextResponse.json({
      userId: targetUserId,
      followed: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo seguir al usuario.'
    console.error('[ActionExtractor] community follow POST error:', message)
    return NextResponse.json({ error: 'No se pudo seguir al usuario.' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const rateLimit = await consumeUserCommunityActionRateLimit(user.id, 'follow')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: buildCommunityActionRateLimitMessage('follow', rateLimit.limit),
          rateLimit: {
            limit: rateLimit.limit,
            used: rateLimit.used,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt,
          },
        }
      )
    }

    const targetUserId = parseId(context.params?.userId)
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId inválido.' }, { status: 400 })
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'No puedes dejar de seguirte a ti mismo.' }, { status: 400 })
    }

    const targetUser = await findUserById(targetUserId)
    if (!targetUser) {
      return NextResponse.json({ error: 'No se encontró el usuario solicitado.' }, { status: 404 })
    }

    await unfollowCommunityUser({
      followerUserId: user.id,
      followingUserId: targetUserId,
    })

    return NextResponse.json({
      userId: targetUserId,
      followed: false,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo dejar de seguir al usuario.'
    console.error('[ActionExtractor] community follow DELETE error:', message)
    return NextResponse.json({ error: 'No se pudo dejar de seguir al usuario.' }, { status: 500 })
  }
}
