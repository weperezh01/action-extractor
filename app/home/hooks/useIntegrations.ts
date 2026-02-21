import { useCallback, useEffect, useState } from 'react'
import type { SessionUser } from '@/app/home/lib/types'

interface UseIntegrationsParams {
  user: SessionUser | null
  onUnauthorized: () => void
  setError: (message: string | null) => void
  setNotice: (message: string | null) => void
}

export function useIntegrations({ user, onUnauthorized, setError, setNotice }: UseIntegrationsParams) {
  const [notionConfigured, setNotionConfigured] = useState(false)
  const [notionConnected, setNotionConnected] = useState(false)
  const [notionWorkspaceName, setNotionWorkspaceName] = useState<string | null>(null)
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionExportLoading, setNotionExportLoading] = useState(false)
  const [notionDisconnectLoading, setNotionDisconnectLoading] = useState(false)

  const [trelloConfigured, setTrelloConfigured] = useState(false)
  const [trelloConnected, setTrelloConnected] = useState(false)
  const [trelloUsername, setTrelloUsername] = useState<string | null>(null)
  const [trelloLoading, setTrelloLoading] = useState(false)
  const [trelloExportLoading, setTrelloExportLoading] = useState(false)
  const [trelloDisconnectLoading, setTrelloDisconnectLoading] = useState(false)

  const [todoistConfigured, setTodoistConfigured] = useState(false)
  const [todoistConnected, setTodoistConnected] = useState(false)
  const [todoistUserLabel, setTodoistUserLabel] = useState<string | null>(null)
  const [todoistLoading, setTodoistLoading] = useState(false)
  const [todoistExportLoading, setTodoistExportLoading] = useState(false)
  const [todoistDisconnectLoading, setTodoistDisconnectLoading] = useState(false)

  const [googleDocsConfigured, setGoogleDocsConfigured] = useState(false)
  const [googleDocsConnected, setGoogleDocsConnected] = useState(false)
  const [googleDocsUserEmail, setGoogleDocsUserEmail] = useState<string | null>(null)
  const [googleDocsLoading, setGoogleDocsLoading] = useState(false)
  const [googleDocsExportLoading, setGoogleDocsExportLoading] = useState(false)
  const [googleDocsDisconnectLoading, setGoogleDocsDisconnectLoading] = useState(false)

  const resetIntegrations = useCallback(() => {
    setNotionConfigured(false)
    setNotionConnected(false)
    setNotionWorkspaceName(null)
    setNotionLoading(false)
    setNotionExportLoading(false)
    setNotionDisconnectLoading(false)

    setTrelloConfigured(false)
    setTrelloConnected(false)
    setTrelloUsername(null)
    setTrelloLoading(false)
    setTrelloExportLoading(false)
    setTrelloDisconnectLoading(false)

    setTodoistConfigured(false)
    setTodoistConnected(false)
    setTodoistUserLabel(null)
    setTodoistLoading(false)
    setTodoistExportLoading(false)
    setTodoistDisconnectLoading(false)

    setGoogleDocsConfigured(false)
    setGoogleDocsConnected(false)
    setGoogleDocsUserEmail(null)
    setGoogleDocsLoading(false)
    setGoogleDocsExportLoading(false)
    setGoogleDocsDisconnectLoading(false)
  }, [])

  const loadNotionStatus = useCallback(async () => {
    if (!user) {
      setNotionConfigured(false)
      setNotionConnected(false)
      setNotionWorkspaceName(null)
      return
    }

    try {
      const res = await fetch('/api/notion/status', { cache: 'no-store' })
      if (res.status === 401) {
        setNotionConfigured(false)
        setNotionConnected(false)
        setNotionWorkspaceName(null)
        onUnauthorized()
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            workspaceName?: unknown
          }
        | null

      if (!res.ok) {
        setNotionConfigured(false)
        setNotionConnected(false)
        setNotionWorkspaceName(null)
        return
      }

      setNotionConfigured(data?.configured === true)
      setNotionConnected(data?.connected === true)
      setNotionWorkspaceName(
        typeof data?.workspaceName === 'string' && data.workspaceName.trim()
          ? data.workspaceName
          : null
      )
    } catch {
      setNotionConfigured(false)
      setNotionConnected(false)
      setNotionWorkspaceName(null)
    }
  }, [onUnauthorized, user])

  const loadTrelloStatus = useCallback(async () => {
    if (!user) {
      setTrelloConfigured(false)
      setTrelloConnected(false)
      setTrelloUsername(null)
      return
    }

    try {
      const res = await fetch('/api/trello/status', { cache: 'no-store' })
      if (res.status === 401) {
        setTrelloConfigured(false)
        setTrelloConnected(false)
        setTrelloUsername(null)
        onUnauthorized()
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            username?: unknown
          }
        | null

      if (!res.ok) {
        setTrelloConfigured(false)
        setTrelloConnected(false)
        setTrelloUsername(null)
        return
      }

      setTrelloConfigured(data?.configured === true)
      setTrelloConnected(data?.connected === true)
      setTrelloUsername(
        typeof data?.username === 'string' && data.username.trim()
          ? data.username
          : null
      )
    } catch {
      setTrelloConfigured(false)
      setTrelloConnected(false)
      setTrelloUsername(null)
    }
  }, [onUnauthorized, user])

  const loadTodoistStatus = useCallback(async () => {
    if (!user) {
      setTodoistConfigured(false)
      setTodoistConnected(false)
      setTodoistUserLabel(null)
      return
    }

    try {
      const res = await fetch('/api/todoist/status', { cache: 'no-store' })
      if (res.status === 401) {
        setTodoistConfigured(false)
        setTodoistConnected(false)
        setTodoistUserLabel(null)
        onUnauthorized()
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            userEmail?: unknown
            userName?: unknown
          }
        | null

      if (!res.ok) {
        setTodoistConfigured(false)
        setTodoistConnected(false)
        setTodoistUserLabel(null)
        return
      }

      setTodoistConfigured(data?.configured === true)
      setTodoistConnected(data?.connected === true)

      const email =
        typeof data?.userEmail === 'string' && data.userEmail.trim()
          ? data.userEmail
          : null
      const name =
        typeof data?.userName === 'string' && data.userName.trim()
          ? data.userName
          : null
      setTodoistUserLabel(email ?? name)
    } catch {
      setTodoistConfigured(false)
      setTodoistConnected(false)
      setTodoistUserLabel(null)
    }
  }, [onUnauthorized, user])

  const loadGoogleDocsStatus = useCallback(async () => {
    if (!user) {
      setGoogleDocsConfigured(false)
      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
      return
    }

    try {
      const res = await fetch('/api/google-docs/status', { cache: 'no-store' })
      if (res.status === 401) {
        setGoogleDocsConfigured(false)
        setGoogleDocsConnected(false)
        setGoogleDocsUserEmail(null)
        onUnauthorized()
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            userEmail?: unknown
          }
        | null

      if (!res.ok) {
        setGoogleDocsConfigured(false)
        setGoogleDocsConnected(false)
        setGoogleDocsUserEmail(null)
        return
      }

      setGoogleDocsConfigured(data?.configured === true)
      setGoogleDocsConnected(data?.connected === true)
      setGoogleDocsUserEmail(
        typeof data?.userEmail === 'string' && data.userEmail.trim()
          ? data.userEmail
          : null
      )
    } catch {
      setGoogleDocsConfigured(false)
      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
    }
  }, [onUnauthorized, user])

  useEffect(() => {
    if (!user) {
      resetIntegrations()
      return
    }

    void Promise.all([
      loadNotionStatus(),
      loadTrelloStatus(),
      loadTodoistStatus(),
      loadGoogleDocsStatus(),
    ])
  }, [
    loadGoogleDocsStatus,
    loadNotionStatus,
    loadTodoistStatus,
    loadTrelloStatus,
    resetIntegrations,
    user,
  ])

  const handleConnectNotion = useCallback(() => {
    if (notionLoading) return
    setNotionLoading(true)
    window.location.href = '/api/notion/connect'
  }, [notionLoading])

  const handleDisconnectNotion = useCallback(async () => {
    if (notionDisconnectLoading) return
    setNotionDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/notion/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        onUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Notion.'
        setError(message)
        return
      }

      setNotionConnected(false)
      setNotionWorkspaceName(null)
      setNotice('Notion desconectado. Ya puedes conectar otra cuenta.')
      void loadNotionStatus()
    } catch {
      setError('Error de conexión al desconectar Notion.')
    } finally {
      setNotionDisconnectLoading(false)
    }
  }, [loadNotionStatus, notionDisconnectLoading, onUnauthorized, setError, setNotice])

  const handleExportToNotion = useCallback(
    async (extractionId?: string) => {
      if (!extractionId || notionExportLoading) return

      setNotionExportLoading(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch('/api/notion/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionId }),
        })

        if (res.status === 401) {
          onUnauthorized()
          setNotionConnected(false)
          setNotionWorkspaceName(null)
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return
        }

        const data = (await res.json().catch(() => null)) as
          | { error?: unknown; pageUrl?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo exportar a Notion.'
          setError(message)
          void loadNotionStatus()
          return
        }

        const pageUrl = typeof data?.pageUrl === 'string' ? data.pageUrl : ''
        if (pageUrl) {
          window.open(pageUrl, '_blank', 'noopener,noreferrer')
        }

        setNotice('Exportación completada en Notion.')
        void loadNotionStatus()
      } catch {
        setError('Error de conexión al exportar a Notion.')
      } finally {
        setNotionExportLoading(false)
      }
    },
    [loadNotionStatus, notionExportLoading, onUnauthorized, setError, setNotice]
  )

  const handleConnectTrello = useCallback(() => {
    if (trelloLoading) return
    setTrelloLoading(true)
    window.location.href = '/api/trello/connect'
  }, [trelloLoading])

  const handleDisconnectTrello = useCallback(async () => {
    if (trelloDisconnectLoading) return
    setTrelloDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/trello/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        onUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Trello.'
        setError(message)
        return
      }

      setTrelloConnected(false)
      setTrelloUsername(null)
      setNotice('Trello desconectado. Ya puedes conectar otra cuenta.')
      void loadTrelloStatus()
    } catch {
      setError('Error de conexión al desconectar Trello.')
    } finally {
      setTrelloDisconnectLoading(false)
    }
  }, [loadTrelloStatus, onUnauthorized, setError, setNotice, trelloDisconnectLoading])

  const handleExportToTrello = useCallback(
    async (extractionId?: string) => {
      if (!extractionId || trelloExportLoading) return

      setTrelloExportLoading(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch('/api/trello/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionId }),
        })

        if (res.status === 401) {
          onUnauthorized()
          setTrelloConnected(false)
          setTrelloUsername(null)
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return
        }

        const data = (await res.json().catch(() => null)) as
          | {
              error?: unknown
              cardUrl?: unknown
              boardName?: unknown
              listName?: unknown
            }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo exportar a Trello.'
          setError(message)
          void loadTrelloStatus()
          return
        }

        const cardUrl = typeof data?.cardUrl === 'string' ? data.cardUrl : ''
        if (cardUrl) {
          const opened = window.open(cardUrl, '_blank', 'noopener,noreferrer')
          if (!opened) {
            window.location.href = cardUrl
          }
        }

        const boardName =
          typeof data?.boardName === 'string' && data.boardName.trim()
            ? data.boardName
            : null
        const listName =
          typeof data?.listName === 'string' && data.listName.trim()
            ? data.listName
            : null
        const locationText =
          boardName && listName
            ? ` Tablero: ${boardName} | Lista: ${listName}.`
            : ''

        setNotice(`Exportación completada en Trello.${locationText}`)
        void loadTrelloStatus()
      } catch {
        setError('Error de conexión al exportar a Trello.')
      } finally {
        setTrelloExportLoading(false)
      }
    },
    [loadTrelloStatus, onUnauthorized, setError, setNotice, trelloExportLoading]
  )

  const handleConnectTodoist = useCallback(() => {
    if (todoistLoading) return
    setTodoistLoading(true)
    window.location.href = '/api/todoist/connect'
  }, [todoistLoading])

  const handleDisconnectTodoist = useCallback(async () => {
    if (todoistDisconnectLoading) return
    setTodoistDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/todoist/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        onUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Todoist.'
        setError(message)
        return
      }

      setTodoistConnected(false)
      setTodoistUserLabel(null)
      setNotice('Todoist desconectado. Ya puedes conectar otra cuenta.')
      void loadTodoistStatus()
    } catch {
      setError('Error de conexión al desconectar Todoist.')
    } finally {
      setTodoistDisconnectLoading(false)
    }
  }, [loadTodoistStatus, onUnauthorized, setError, setNotice, todoistDisconnectLoading])

  const handleExportToTodoist = useCallback(
    async (extractionId?: string) => {
      if (!extractionId || todoistExportLoading) return

      setTodoistExportLoading(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch('/api/todoist/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionId }),
        })

        if (res.status === 401) {
          onUnauthorized()
          setTodoistConnected(false)
          setTodoistUserLabel(null)
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return
        }

        const data = (await res.json().catch(() => null)) as
          | { error?: unknown; taskUrl?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo exportar a Todoist.'
          setError(message)
          void loadTodoistStatus()
          return
        }

        const taskUrl = typeof data?.taskUrl === 'string' ? data.taskUrl : ''
        if (taskUrl) {
          window.open(taskUrl, '_blank', 'noopener,noreferrer')
        }

        setNotice('Exportación completada en Todoist.')
        void loadTodoistStatus()
      } catch {
        setError('Error de conexión al exportar a Todoist.')
      } finally {
        setTodoistExportLoading(false)
      }
    },
    [loadTodoistStatus, onUnauthorized, setError, setNotice, todoistExportLoading]
  )

  const handleConnectGoogleDocs = useCallback(() => {
    if (googleDocsLoading) return
    setGoogleDocsLoading(true)
    window.location.href = '/api/google-docs/connect'
  }, [googleDocsLoading])

  const handleDisconnectGoogleDocs = useCallback(async () => {
    if (googleDocsDisconnectLoading) return
    setGoogleDocsDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/google-docs/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        onUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Google Docs.'
        setError(message)
        return
      }

      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
      setNotice('Google Docs desconectado. Ya puedes conectar otra cuenta.')
      void loadGoogleDocsStatus()
    } catch {
      setError('Error de conexión al desconectar Google Docs.')
    } finally {
      setGoogleDocsDisconnectLoading(false)
    }
  }, [googleDocsDisconnectLoading, loadGoogleDocsStatus, onUnauthorized, setError, setNotice])

  const handleExportToGoogleDocs = useCallback(
    async (extractionId?: string) => {
      if (!extractionId || googleDocsExportLoading) return

      setGoogleDocsExportLoading(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch('/api/google-docs/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionId }),
        })

        if (res.status === 401) {
          onUnauthorized()
          setGoogleDocsConnected(false)
          setGoogleDocsUserEmail(null)
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return
        }

        const data = (await res.json().catch(() => null)) as
          | { error?: unknown; documentUrl?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo exportar a Google Docs.'
          setError(message)
          void loadGoogleDocsStatus()
          return
        }

        const documentUrl =
          typeof data?.documentUrl === 'string' ? data.documentUrl : ''
        if (documentUrl) {
          window.open(documentUrl, '_blank', 'noopener,noreferrer')
        }

        setNotice('Exportación completada en Google Docs.')
        void loadGoogleDocsStatus()
      } catch {
        setError('Error de conexión al exportar a Google Docs.')
      } finally {
        setGoogleDocsExportLoading(false)
      }
    },
    [googleDocsExportLoading, loadGoogleDocsStatus, onUnauthorized, setError, setNotice]
  )

  return {
    notionConfigured,
    notionConnected,
    notionWorkspaceName,
    notionLoading,
    notionExportLoading,
    notionDisconnectLoading,

    trelloConfigured,
    trelloConnected,
    trelloUsername,
    trelloLoading,
    trelloExportLoading,
    trelloDisconnectLoading,
    setTrelloLoading,

    todoistConfigured,
    todoistConnected,
    todoistUserLabel,
    todoistLoading,
    todoistExportLoading,
    todoistDisconnectLoading,

    googleDocsConfigured,
    googleDocsConnected,
    googleDocsUserEmail,
    googleDocsLoading,
    googleDocsExportLoading,
    googleDocsDisconnectLoading,

    loadNotionStatus,
    loadTrelloStatus,
    loadTodoistStatus,
    loadGoogleDocsStatus,
    resetIntegrations,

    handleConnectNotion,
    handleDisconnectNotion,
    handleExportToNotion,

    handleConnectTrello,
    handleDisconnectTrello,
    handleExportToTrello,

    handleConnectTodoist,
    handleDisconnectTodoist,
    handleExportToTodoist,

    handleConnectGoogleDocs,
    handleDisconnectGoogleDocs,
    handleExportToGoogleDocs,
  }
}
