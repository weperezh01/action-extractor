import { Resend } from 'resend'
import {
  getExtractionNotificationContext,
  getNotificationPreferences,
  getTaskFollowersForNotification,
} from './db'

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  blocked: 'Bloqueado',
  completed: 'Completado',
}

// ─── Send helpers ──────────────────────────────────────────────────────────────

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ??
    'ActionExtractor <noreply@notesaide.com>'

  if (!resendKey) {
    console.log('[email-notifications] DEV — email no enviado:')
    console.log('  Para:', params.to)
    console.log('  Asunto:', params.subject)
    return
  }

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
  if (error) {
    console.error('[email-notifications] Resend error:', error)
  }
}

async function sendIfPreferred(
  userId: string,
  type: 'task_status_change' | 'new_comment',
  send: () => Promise<void>
): Promise<void> {
  try {
    const prefs = await getNotificationPreferences(userId)
    const enabled =
      type === 'task_status_change' ? prefs.notifyTaskStatusChange : prefs.notifyNewComment
    if (enabled) await send()
  } catch (err) {
    console.error('[email-notifications] Error al enviar notificación:', err)
  }
}

// ─── Collect unique recipients ─────────────────────────────────────────────────

interface Recipient {
  userId: string
  email: string
  name: string
}

async function collectRecipients(
  extractionId: string,
  taskId: string,
  actorUserId: string
): Promise<{
  recipients: Recipient[]
  extractionTitle: string
  taskText: string
  ownerUserId: string
}> {
  const [context, followers] = await Promise.all([
    getExtractionNotificationContext(extractionId, taskId),
    getTaskFollowersForNotification(taskId, actorUserId),
  ])

  const recipientMap = new Map<string, Recipient>()

  if (context.extraction && context.extraction.ownerUserId !== actorUserId) {
    recipientMap.set(context.extraction.ownerUserId, {
      userId: context.extraction.ownerUserId,
      email: context.extraction.ownerEmail,
      name: context.extraction.ownerName,
    })
  }

  for (const f of followers) {
    if (!recipientMap.has(f.userId)) {
      recipientMap.set(f.userId, f)
    }
  }

  return {
    recipients: Array.from(recipientMap.values()),
    extractionTitle: context.extraction?.extractionTitle ?? 'Sin título',
    taskText: context.taskText ?? '(tarea)',
    ownerUserId: context.extraction?.ownerUserId ?? '',
  }
}

// ─── Task status change notification ──────────────────────────────────────────

export async function notifyTaskStatusChange(params: {
  extractionId: string
  taskId: string
  actorUserId: string
  actorName: string
  previousStatus: string
  newStatus: string
}): Promise<void> {
  const { extractionId, taskId, actorUserId, actorName, previousStatus, newStatus } = params

  const { recipients, extractionTitle, taskText } = await collectRecipients(
    extractionId,
    taskId,
    actorUserId
  )
  if (recipients.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notesaide.com'
  const playbookUrl = `${appUrl}/app/${extractionId}`
  const prevLabel = TASK_STATUS_LABELS[previousStatus] ?? previousStatus
  const nextLabel = TASK_STATUS_LABELS[newStatus] ?? newStatus

  await Promise.allSettled(
    recipients.map((r) =>
      sendIfPreferred(r.userId, 'task_status_change', () =>
        sendEmail({
          to: r.email,
          subject: `${actorName} actualizó una tarea en "${extractionTitle}"`,
          html: buildTaskStatusChangeEmailHtml({
            recipientName: r.name,
            actorName,
            taskText,
            extractionTitle,
            previousStatus: prevLabel,
            newStatus: nextLabel,
            playbookUrl,
          }),
        })
      )
    )
  )
}

// ─── New comment notification ──────────────────────────────────────────────────

export async function notifyNewComment(params: {
  extractionId: string
  taskId: string
  actorUserId: string
  actorName: string
  commentContent: string
}): Promise<void> {
  const { extractionId, taskId, actorUserId, actorName, commentContent } = params

  const { recipients, extractionTitle, taskText } = await collectRecipients(
    extractionId,
    taskId,
    actorUserId
  )
  if (recipients.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notesaide.com'
  const playbookUrl = `${appUrl}/app/${extractionId}`
  const snippet =
    commentContent.length > 200 ? commentContent.slice(0, 197) + '...' : commentContent

  await Promise.allSettled(
    recipients.map((r) =>
      sendIfPreferred(r.userId, 'new_comment', () =>
        sendEmail({
          to: r.email,
          subject: `${actorName} comentó en "${extractionTitle}"`,
          html: buildNewCommentEmailHtml({
            recipientName: r.name,
            actorName,
            taskText,
            extractionTitle,
            commentSnippet: snippet,
            playbookUrl,
          }),
        })
      )
    )
  )
}

// ─── Email templates ───────────────────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#4f46e5;padding:20px 32px;">
      <span style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;">⚡ ActionExtractor</span>
    </div>
    <div style="padding:28px 32px;">
      ${content}
    </div>
    <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        notesaide.com ·
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://notesaide.com'}/settings" style="color:#94a3b8;">Gestionar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildTaskStatusChangeEmailHtml(params: {
  recipientName: string
  actorName: string
  taskText: string
  extractionTitle: string
  previousStatus: string
  newStatus: string
  playbookUrl: string
}) {
  const { recipientName, actorName, taskText, extractionTitle, previousStatus, newStatus, playbookUrl } = params
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">Hola, ${escHtml(recipientName)}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      <strong>${escHtml(actorName)}</strong> actualizó el estado de una tarea en tu playbook
      <strong>"${escHtml(extractionTitle)}"</strong>.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">Tarea</p>
      <p style="margin:0 0 14px;color:#1e293b;font-size:15px;font-weight:500;">${escHtml(taskText)}</p>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="background:#e2e8f0;color:#64748b;padding:4px 10px;border-radius:99px;font-size:13px;">${escHtml(previousStatus)}</span>
        <span style="color:#94a3b8;font-size:14px;">→</span>
        <span style="background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:99px;font-size:13px;font-weight:600;">${escHtml(newStatus)}</span>
      </div>
    </div>

    <a href="${playbookUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">
      Ver playbook
    </a>
  `)
}

function buildNewCommentEmailHtml(params: {
  recipientName: string
  actorName: string
  taskText: string
  extractionTitle: string
  commentSnippet: string
  playbookUrl: string
}) {
  const { recipientName, actorName, taskText, extractionTitle, commentSnippet, playbookUrl } = params
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">Hola, ${escHtml(recipientName)}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      <strong>${escHtml(actorName)}</strong> comentó en una tarea de tu playbook
      <strong>"${escHtml(extractionTitle)}"</strong>.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">Tarea</p>
      <p style="margin:0 0 14px;color:#1e293b;font-size:15px;font-weight:500;">${escHtml(taskText)}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">Comentario</p>
      <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;border-left:3px solid #818cf8;padding-left:12px;">${escHtml(commentSnippet)}</p>
    </div>

    <a href="${playbookUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">
      Ver playbook
    </a>
  `)
}

// ─── Workspace invitation email ────────────────────────────────────────────

export async function sendWorkspaceInvitationEmail(params: {
  toEmail: string
  invitedByName: string
  workspaceName: string
  role: string
  inviteToken: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notesaide.com'
  const inviteUrl = `${appUrl}/workspace/invite/${params.inviteToken}`

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    member: 'Miembro',
    viewer: 'Observador',
  }
  const roleLabel = roleLabels[params.role] ?? params.role

  try {
    await sendEmail({
      to: params.toEmail,
      subject: `${params.invitedByName} te invitó al workspace "${params.workspaceName}"`,
      html: buildWorkspaceInvitationEmailHtml({
        toEmail: params.toEmail,
        invitedByName: params.invitedByName,
        workspaceName: params.workspaceName,
        roleLabel,
        inviteUrl,
      }),
    })
  } catch (err) {
    console.error('[email-notifications] Error al enviar invitación de workspace:', err)
  }
}

function buildWorkspaceInvitationEmailHtml(params: {
  toEmail: string
  invitedByName: string
  workspaceName: string
  roleLabel: string
  inviteUrl: string
}) {
  const { invitedByName, workspaceName, roleLabel, inviteUrl } = params
  return emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">Invitación al workspace</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      <strong>${escHtml(invitedByName)}</strong> te ha invitado a unirte al workspace
      <strong>"${escHtml(workspaceName)}"</strong> como <strong>${escHtml(roleLabel)}</strong>.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">Workspace</p>
      <p style="margin:0 0 14px;color:#1e293b;font-size:16px;font-weight:600;">${escHtml(workspaceName)}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">Tu rol</p>
      <span style="background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:99px;font-size:13px;font-weight:600;">${escHtml(roleLabel)}</span>
    </div>

    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Esta invitación expira en 7 días.</p>

    <a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">
      Aceptar invitación
    </a>
  `)
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
