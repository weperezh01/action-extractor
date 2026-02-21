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
  return (
    <div className="max-w-4xl mx-auto mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-md shadow-slate-100 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Conexiones de Exportación</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cambia cuentas sin cerrar sesión de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-900 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-slate-300">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notion</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {notionConnected
              ? `Conectado: ${notionWorkspaceName ?? 'Workspace activo'}`
              : notionConfigured
                ? 'Sin conexión'
                : 'No configurado en servidor'}
          </p>
          <div className="flex gap-2 mt-3">
            {!notionConnected ? (
              <button
                type="button"
                onClick={onConnectNotion}
                disabled={notionLoading || !notionConfigured}
                className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {notionLoading ? 'Conectando...' : 'Conectar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectNotion}
                disabled={notionDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {notionDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-sky-500 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-sky-500">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Trello</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {trelloConnected
              ? `Conectado: @${trelloUsername ?? 'usuario'}`
              : trelloConfigured
                ? 'Sin conexión'
                : 'No configurado en servidor'}
          </p>
          <div className="flex gap-2 mt-3">
            {!trelloConnected ? (
              <button
                type="button"
                onClick={onConnectTrello}
                disabled={trelloLoading || !trelloConfigured}
                className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {trelloLoading ? 'Conectando...' : 'Conectar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectTrello}
                disabled={trelloDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {trelloDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-rose-500 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-rose-500">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Todoist</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {todoistConnected
              ? `Conectado: ${todoistUserLabel ?? 'usuario activo'}`
              : todoistConfigured
                ? 'Sin conexión'
                : 'No configurado en servidor'}
          </p>
          <div className="flex gap-2 mt-3">
            {!todoistConnected ? (
              <button
                type="button"
                onClick={onConnectTodoist}
                disabled={todoistLoading || !todoistConfigured}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {todoistLoading ? 'Conectando...' : 'Conectar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectTodoist}
                disabled={todoistDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {todoistDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-slate-50 p-3 dark:bg-slate-800 dark:border-slate-700 dark:border-l-blue-500">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Google Docs</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {googleDocsConnected
              ? `Conectado: ${googleDocsUserEmail ?? 'cuenta activa'}`
              : googleDocsConfigured
                ? 'Sin conexión'
                : 'No configurado en servidor'}
          </p>
          <div className="flex gap-2 mt-3">
            {!googleDocsConnected ? (
              <button
                type="button"
                onClick={onConnectGoogleDocs}
                disabled={googleDocsLoading || !googleDocsConfigured}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {googleDocsLoading ? 'Conectando...' : 'Conectar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDisconnectGoogleDocs}
                disabled={googleDocsDisconnectLoading}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
              >
                {googleDocsDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
