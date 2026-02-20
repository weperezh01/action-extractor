import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  createResetToken,
  createResetTokenExpirationDate,
  hashResetToken,
  isValidEmail,
  normalizeEmail,
} from '@/lib/auth'
import {
  createPasswordResetToken,
  deletePasswordResetTokenByHash,
  deletePasswordResetTokensByUserId,
  findUserByEmail,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const emailInput = typeof body?.email === 'string' ? body.email : ''
    const email = normalizeEmail(emailInput)

    // Siempre retornar 200 para no revelar si el correo existe
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: true })
    }

    const user = await findUserByEmail(email)

    if (user) {
      // Eliminar tokens anteriores del usuario (solo uno activo a la vez)
      await deletePasswordResetTokensByUserId(user.id)

      const token = createResetToken()
      const tokenHash = hashResetToken(token)
      const expiresAt = createResetTokenExpirationDate()
      await createPasswordResetToken({ userId: user.id, tokenHash, expiresAt })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roi.welltechnologies.net'
      const resetUrl = `${appUrl}/?token=${token}`

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
          subject: 'Restablecer contraseña — ActionExtractor',
          html: buildResetEmailHtml(user.name, resetUrl),
        })

        if (resendError) {
          // Limpiar token no entregado para evitar enlaces "huérfanos"
          await deletePasswordResetTokenByHash(tokenHash)
          console.error('[forgot-password] Resend error:', resendError)
          return NextResponse.json(
            { error: 'No se pudo enviar el correo de recuperación. Intenta de nuevo.' },
            { status: 502 }
          )
        }
      } else {
        if (isProduction) {
          await deletePasswordResetTokenByHash(tokenHash)
          console.error(
            '[forgot-password] RESEND_API_KEY no configurada en producción. No se envió correo.'
          )
          return NextResponse.json(
            { error: 'El servicio de correo no está disponible. Intenta más tarde.' },
            { status: 503 }
          )
        }

        // Dev: imprimir en consola cuando no hay clave de Resend configurada
        console.log('[RESET PASSWORD] URL de restablecimiento (dev):', resetUrl)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[forgot-password]', error)
    return NextResponse.json({ error: 'No se pudo procesar la solicitud.' }, { status: 500 })
  }
}

function buildResetEmailHtml(name: string, resetUrl: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#4f46e5;padding:24px 32px;">
      <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">
        ⚡ ActionExtractor
      </span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:22px;font-weight:700;">Hola, ${name}</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br>
        Haz clic en el botón para crear una nueva contraseña.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">
        Restablecer contraseña
      </a>
      <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;line-height:1.6;">
        Este enlace expira en <strong>1 hora</strong>.<br>
        Si no solicitaste este cambio, puedes ignorar este correo con seguridad.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">roi.welltechnologies.net — ActionExtractor</p>
    </div>
  </div>
</body>
</html>`
}
