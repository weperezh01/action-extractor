import { ArrowRight, History, Play } from 'lucide-react'

interface ExtractionFormProps {
  url: string
  isProcessing: boolean
  urlError: string | null
  onUrlChange: (value: string) => void
  onExtract: () => void
  onScrollToHistory: () => void
}

export function ExtractionForm({
  url,
  isProcessing,
  urlError,
  onUrlChange,
  onExtract,
  onScrollToHistory,
}: ExtractionFormProps) {
  const isDisabled = isProcessing || !url.trim() || Boolean(urlError)

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="ml-2 text-zinc-400 dark:text-zinc-500">
              <Play size={17} />
            </div>
            <input
              type="text"
              placeholder="Pega aquí el link de YouTube..."
              className="h-12 w-full bg-transparent px-2 text-base text-zinc-800 placeholder:text-zinc-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && !isDisabled && onExtract()}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? 'youtube-url-error' : undefined}
            />

            <button
              onClick={onExtract}
              disabled={isDisabled}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-colors duration-200 ${
                isDisabled
                  ? isProcessing
                    ? 'cursor-wait bg-zinc-400 dark:bg-zinc-700'
                    : 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-700'
                  : 'bg-violet-600 hover:bg-violet-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Analizando
                </>
              ) : (
                <>
                  Extraer
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onScrollToHistory}
          className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:from-indigo-100 hover:to-sky-100 hover:shadow-md dark:border-indigo-800/70 dark:from-indigo-950/40 dark:to-sky-950/40 dark:text-indigo-300 dark:hover:border-indigo-700"
        >
          <History size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
          Ver historial
        </button>
      </div>

      {urlError && (
        <p
          id="youtube-url-error"
          className="mt-2 px-3 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {urlError}
        </p>
      )}
    </div>
  )
}
