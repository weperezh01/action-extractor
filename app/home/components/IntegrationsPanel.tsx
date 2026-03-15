import { useLang } from '@/app/home/hooks/useLang'

interface IntegrationsPanelProps {
  notionConfigured: boolean
  notionConnected: boolean
  notionWorkspaceName: string | null
  notionLoading: boolean
  notionDisconnectLoading: boolean
  onConnectNotion: () => void
  onDisconnectNotion: () => void

  trelloConfigured: boolean
  trelloConnected: boolean
  trelloUsername: string | null
  trelloLoading: boolean
  trelloDisconnectLoading: boolean
  onConnectTrello: () => void
  onDisconnectTrello: () => void

  todoistConfigured: boolean
  todoistConnected: boolean
  todoistUserLabel: string | null
  todoistLoading: boolean
  todoistDisconnectLoading: boolean
  onConnectTodoist: () => void
  onDisconnectTodoist: () => void

  googleDocsConfigured: boolean
  googleDocsConnected: boolean
  googleDocsUserEmail: string | null
  googleDocsLoading: boolean
  googleDocsDisconnectLoading: boolean
  onConnectGoogleDocs: () => void
  onDisconnectGoogleDocs: () => void
}

const INTEGRATIONS_COPY = {
  en: {
    title: 'Export connections',
    subtitle: 'Switch accounts without signing out of the platform.',
    connected: 'Connected',
    activeWorkspace: 'Active workspace',
    activeUser: 'active user',
    activeAccount: 'active account',
    disconnected: 'Not connected',
    notConfigured: 'Not configured on the server',
    connecting: 'Connecting...',
    connect: 'Connect',
    disconnecting: 'Disconnecting...',
    disconnect: 'Disconnect',
  },
  es: {
    title: 'Conexiones de exportación',
    subtitle: 'Cambia cuentas sin cerrar sesión de la plataforma.',
    connected: 'Conectado',
    activeWorkspace: 'Workspace activo',
    activeUser: 'usuario activo',
    activeAccount: 'cuenta activa',
    disconnected: 'Sin conexión',
    notConfigured: 'No configurado en servidor',
    connecting: 'Conectando...',
    connect: 'Conectar',
    disconnecting: 'Desconectando...',
    disconnect: 'Desconectar',
  },
} as const

export function IntegrationsPanel({
  notionConfigured,
  notionConnected,
  notionWorkspaceName,
  notionLoading,
  notionDisconnectLoading,
  onConnectNotion,
  onDisconnectNotion,

  trelloConfigured,
  trelloConnected,
  trelloUsername,
  trelloLoading,
  trelloDisconnectLoading,
  onConnectTrello,
  onDisconnectTrello,

  todoistConfigured,
  todoistConnected,
  todoistUserLabel,
  todoistLoading,
  todoistDisconnectLoading,
  onConnectTodoist,
  onDisconnectTodoist,

  googleDocsConfigured,
  googleDocsConnected,
  googleDocsUserEmail,
  googleDocsLoading,
  googleDocsDisconnectLoading,
  onConnectGoogleDocs,
  onDisconnectGoogleDocs,
}: IntegrationsPanelProps) {
  const { lang } = useLang()
  const ui = INTEGRATIONS_COPY[lang]

  return (
    <div className="max-w-4xl mx-auto mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-md shadow-slate-100 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{ui.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {ui.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-900 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-slate-300">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notion</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {notionConnected
              ? `${ui.connected}: ${notionWorkspaceName ?? ui.activeWorkspace}`
              : notionConfigured
                ? ui.disconnected
                : ui.notConfigured}
          </p>
          <div className="flex gap-2 mt-3">
            {!notionConnected ? (
              <button
                type="button"
                onClick={onConnectNotion}
                disabled={notionLoading || !notionConfigured}
                className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {notionLoading ? ui.connecting : ui.connect}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectNotion}
                disabled={notionDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {notionDisconnectLoading ? ui.disconnecting : ui.disconnect}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-sky-500 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-sky-500">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Trello</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {trelloConnected
              ? `${ui.connected}: @${trelloUsername ?? ui.activeUser}`
              : trelloConfigured
                ? ui.disconnected
                : ui.notConfigured}
          </p>
          <div className="flex gap-2 mt-3">
            {!trelloConnected ? (
              <button
                type="button"
                onClick={onConnectTrello}
                disabled={trelloLoading || !trelloConfigured}
                className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {trelloLoading ? ui.connecting : ui.connect}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectTrello}
                disabled={trelloDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {trelloDisconnectLoading ? ui.disconnecting : ui.disconnect}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-rose-500 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-rose-500">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Todoist</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {todoistConnected
              ? `${ui.connected}: ${todoistUserLabel ?? ui.activeUser}`
              : todoistConfigured
                ? ui.disconnected
                : ui.notConfigured}
          </p>
          <div className="flex gap-2 mt-3">
            {!todoistConnected ? (
              <button
                type="button"
                onClick={onConnectTodoist}
                disabled={todoistLoading || !todoistConfigured}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {todoistLoading ? ui.connecting : ui.connect}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectTodoist}
                disabled={todoistDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {todoistDisconnectLoading ? ui.disconnecting : ui.disconnect}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-blue-500">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Google Docs</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {googleDocsConnected
              ? `${ui.connected}: ${googleDocsUserEmail ?? ui.activeAccount}`
              : googleDocsConfigured
                ? ui.disconnected
                : ui.notConfigured}
          </p>
          <div className="flex gap-2 mt-3">
            {!googleDocsConnected ? (
              <button
                type="button"
                onClick={onConnectGoogleDocs}
                disabled={googleDocsLoading || !googleDocsConfigured}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {googleDocsLoading ? ui.connecting : ui.connect}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectGoogleDocs}
                disabled={googleDocsDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {googleDocsDisconnectLoading ? ui.disconnecting : ui.disconnect}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
