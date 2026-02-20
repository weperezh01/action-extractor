import { NextRequest, NextResponse } from 'next/server'
import { hashEmailVerificationToken } from '@/lib/auth'
import {
  deleteEmailVerificationTokenByHash,
  deleteEmailVerificationTokensByUserId,
  findEmailVerificationTokenByHash,
  markUserEmailAsVerified,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? ''
  const redirectUrl = new URL('/', resolvePublicBaseUrl(req))

  if (!token) {
    redirectUrl.searchParams.set('email_verification', 'invalid')
    return NextResponse.redirect(redirectUrl)
  }

  try {
    const tokenHash = hashEmailVerificationToken(token)
    const verificationToken = await findEmailVerificationTokenByHash(tokenHash)

    if (!verificationToken) {
      redirectUrl.searchParams.set('email_verification', 'invalid')
      return NextResponse.redirect(redirectUrl)
    }

    if (new Date(verificationToken.expires_at).getTime() <= Date.now()) {
      await deleteEmailVerificationTokenByHash(tokenHash)
      redirectUrl.searchParams.set('email_verification', 'expired')
      return NextResponse.redirect(redirectUrl)
    }

    await markUserEmailAsVerified(verificationToken.user_id)
    await deleteEmailVerificationTokensByUserId(verificationToken.user_id)

    redirectUrl.searchParams.set('email_verification', 'success')
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('[verify-email]', error)
    redirectUrl.searchParams.set('email_verification', 'error')
    return NextResponse.redirect(redirectUrl)
  }
}

function resolvePublicBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    try {
      return new URL(configured)
    } catch {
      // Si NEXT_PUBLIC_APP_URL está mal formateada, usar headers del request
    }
  }

  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? ''
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? ''
  const host = forwardedHost || req.headers.get('host')?.trim() || ''
  const protocol = forwardedProto || 'https'
  if (host) {
    return new URL(`${protocol}://${host}`)
  }

  return new URL(req.url)
}
