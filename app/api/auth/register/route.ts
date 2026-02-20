import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  createEmailVerificationToken as createRawEmailVerificationToken,
  createEmailVerificationTokenExpirationDate,
  hashEmailVerificationToken,
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from '@/lib/auth'
import {
  createEmailVerificationToken as createEmailVerificationTokenRecord,
  createUser,
  deleteEmailVerificationTokenByHash,
  deleteEmailVerificationTokensByUserId,
  findUserByEmail,
  updateUnverifiedUserRegistration,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REGISTER_SUCCESS_MESSAGE =
  'Cuenta creada. Revisa tu correo para verificar el email antes de iniciar sesión.'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const emailInput = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const email = normalizeEmail(emailInput)

    if (name.length < 2) {
      return NextResponse.json({ error: 'Nombre inválido (mínimo 2 caracteres).' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 })
    }

    if (!isValidPassword(password)) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser?.email_verified_at) {
      return NextResponse.json({ error: 'Este correo ya está registrado.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user =
      existingUser
        ? await updateUnverifiedUserRegistration({
            userId: existingUser.id,
            name,
            passwordHash,
          })
        : await createUser({
            name,
            email,
            passwordHash,
            emailVerifiedAt: null,
          })

    if (!user) {
      return NextResponse.json(
        { error: 'No se pudo actualizar el registro pendiente de verificación.' },
        { status: 409 }
      )
    }

    await deleteEmailVerificationTokensByUserId(user.id)

    const token = createRawEmailVerificationToken()
    const tokenHash = hashEmailVerificationToken(token)
    const expiresAt = createEmailVerificationTokenExpirationDate()
    await createEmailVerificationTokenRecord({ userId: user.id, tokenHash, expiresAt })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roi.welltechnologies.net'
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`

    const resendKey = process.env.RESEND_API_KEY?.trim()
    const resendFrom =
      process.env.RESEND_FROM_EMAIL?.trim() ??
      'ActionExtractor <noreply@roi.welltechnologies.net>'
    const isProduction = process.env.NODE_ENV === 'production'

    if (resendKey) {
      const resend = new Resend(resendKey)
      const { error: resendError } = await resend.emails.send({
        from: resendFrom,
        to: email,
        subject: 'Verifica tu correo — ActionExtractor',
        html: buildVerificationEmailHtml(user.name, verifyUrl),
      })

      if (resendError) {
        await deleteEmailVerificationTokenByHash(tokenHash)
        console.error('[register] Resend error:', resendError)
        return NextResponse.json(
          { error: 'No se pudo enviar el correo de verificación. Intenta de nuevo.' },
          { status: 502 }
        )
      }
    } else {
      if (isProduction) {
        await deleteEmailVerificationTokenByHash(tokenHash)
        console.error('[register] RESEND_API_KEY no configurada en producción.')
        return NextResponse.json(
          { error: 'El servicio de correo no está disponible. Intenta más tarde.' },
          { status: 503 }
        )
      }

      console.log('[VERIFY EMAIL] URL de verificación (dev):', verifyUrl)
    }

    return NextResponse.json(
      {
        ok: true,
        requiresEmailVerification: true,
        message: REGISTER_SUCCESS_MESSAGE,
      },
      { status: existingUser ? 200 : 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildVerificationEmailHtml(name: string, verifyUrl: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#4f46e5;padding:24px 32px;">
      <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">
        ActionExtractor
      </span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:22px;font-weight:700;">Hola, ${name}</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Gracias por registrarte.<br>
        Para activar tu cuenta, confirma tu correo con el siguiente botón.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">
        Verificar correo
      </a>
      <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;line-height:1.6;">
        Este enlace expira en <strong>24 horas</strong>.<br>
        Si no creaste esta cuenta, ignora este mensaje.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">roi.welltechnologies.net — ActionExtractor</p>
    </div>
  </div>
</body>
</html>`
}
