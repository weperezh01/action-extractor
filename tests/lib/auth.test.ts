import { afterEach, describe, expect, it } from 'vitest'
import {
  hashPassword,
  hashSessionToken,
  isAdminEmail,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  resolveAdminEmails,
  verifyPassword,
} from '@/lib/auth'

const ORIGINAL_ADMIN_EMAILS = process.env.ACTION_EXTRACTOR_ADMIN_EMAILS
const ORIGINAL_SESSION_SECRET = process.env.ACTION_EXTRACTOR_SESSION_SECRET

afterEach(() => {
  if (ORIGINAL_ADMIN_EMAILS === undefined) {
    delete process.env.ACTION_EXTRACTOR_ADMIN_EMAILS
  } else {
    process.env.ACTION_EXTRACTOR_ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
  }

  if (ORIGINAL_SESSION_SECRET === undefined) {
    delete process.env.ACTION_EXTRACTOR_SESSION_SECRET
  } else {
    process.env.ACTION_EXTRACTOR_SESSION_SECRET = ORIGINAL_SESSION_SECRET
  }
})

describe('lib/auth', () => {
  it('normaliza emails y valida formato', () => {
    expect(normalizeEmail('  USER@Example.COM  ')).toBe('user@example.com')
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('invalid-email')).toBe(false)
  })

  it('valida contraseña mínima de 8 caracteres', () => {
    expect(isValidPassword('12345678')).toBe(true)
    expect(isValidPassword('   12345678   ')).toBe(true)
    expect(isValidPassword('short')).toBe(false)
  })

  it('hashea y verifica contraseña correctamente', async () => {
    const hash = await hashPassword('strong-password')

    expect(hash.split(':')).toHaveLength(2)
    await expect(verifyPassword('strong-password', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
    await expect(verifyPassword('strong-password', 'bad-hash')).resolves.toBe(false)
  })

  it('resuelve admins desde env, normaliza y elimina duplicados', () => {
    process.env.ACTION_EXTRACTOR_ADMIN_EMAILS = 'Admin@Example.com, team@example.com,admin@example.com'

    expect(resolveAdminEmails()).toEqual(['admin@example.com', 'team@example.com'])
    expect(isAdminEmail('ADMIN@example.com')).toBe(true)
    expect(isAdminEmail('nope@example.com')).toBe(false)
  })

  it('hashSessionToken es determinístico para un mismo secret/token', () => {
    process.env.ACTION_EXTRACTOR_SESSION_SECRET = '0123456789abcdef'

    const first = hashSessionToken('session-token')
    const second = hashSessionToken('session-token')

    expect(first).toBe(second)
    expect(first).toHaveLength(64)
  })
})
