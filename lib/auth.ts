import {
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import {
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  findSessionWithUserByTokenHash,
  mapSessionUserForClient,
} from '@/lib/db'

const scrypt = promisify(nodeScrypt)
const SESSION_COOKIE_NAME = 'ae_session'
const SESSION_DURATION_DAYS = 30
const PASSWORD_KEY_LENGTH = 64
const RESET_TOKEN_EXPIRY_HOURS = 1
const EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = 24
const DEFAULT_ADMIN_EMAILS = ['wdperezh@gmail.com']

interface SessionUser {
  id: string
  name: string
  email: string
}

function getSessionSecret() {
  const configured = process.env.ACTION_EXTRACTOR_SESSION_SECRET
  if (configured && configured.trim().length >= 16) {
    return configured
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ACTION_EXTRACTOR_SESSION_SECRET no está configurado. Debe tener al menos 16 caracteres.'
    )
  }

  return 'action-extractor-dev-only-secret'
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function resolveAdminEmails() {
  const configured = (process.env.ACTION_EXTRACTOR_ADMIN_EMAILS || '').trim()
  const rawValues = configured
    ? configured.split(',').map((item) => item.trim())
    : DEFAULT_ADMIN_EMAILS

  const normalized = rawValues
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0)

  return Array.from(new Set(normalized))
}

export function isAdminEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  return resolveAdminEmails().includes(normalizedEmail)
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPassword(password: string) {
  return password.trim().length >= 8
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(':')
  if (!salt || !expectedHex) return false

  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer
  const expectedBuffer = Buffer.from(expectedHex, 'hex')
  if (expectedBuffer.length !== derived.length) return false
  return timingSafeEqual(expectedBuffer, derived)
}

export function createSessionToken() {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string) {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex')
}

export function createSessionExpirationDate() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)
  return expiresAt
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export function getSessionTokenFromRequest(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
}

export async function getUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  await deleteExpiredSessions()

  const token = getSessionTokenFromRequest(req)
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const session = await findSessionWithUserByTokenHash(tokenHash)
  if (!session) return null

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await deleteSessionByTokenHash(tokenHash)
    return null
  }

  if (session.user_blocked_at) {
    await deleteSessionByTokenHash(tokenHash)
    return null
  }

  return mapSessionUserForClient(session)
}

export async function deleteSessionForRequest(req: NextRequest) {
  const token = getSessionTokenFromRequest(req)
  if (!token) return
  await deleteSessionByTokenHash(hashSessionToken(token))
}

export function createResetToken() {
  return randomBytes(32).toString('hex')
}

export function hashResetToken(token: string) {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex')
}

export function createResetTokenExpirationDate() {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS)
  return expiresAt
}

export function createEmailVerificationToken() {
  return randomBytes(32).toString('hex')
}

export function hashEmailVerificationToken(token: string) {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex')
}

export function createEmailVerificationTokenExpirationDate() {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS)
  return expiresAt
}
