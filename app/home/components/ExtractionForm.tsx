import { ArrowRight, Play } from 'lucide-react'

interface ExtractionFormProps {
  url: string
  isProcessing: boolean
  urlError: string | null
  onUrlChange: (value: string) => void
  onExtract: () => void
}

export function ExtractionForm({
  url,
  isProcessing,
  urlError,
  onUrlChange,
  onExtract,
}: ExtractionFormProps) {
  const isDisabled = isProcessing || !url.trim() || Boolean(urlError)

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div className="bg-white p-2 rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-200 flex flex-col md:flex-row gap-2 transform transition-all hover:scale-[1.01] dark:bg-slate-900 dark:border-slate-800">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Play size={18} />
          </div>
          <input
            type="text"
            placeholder="Pega aquí el link de YouTube..."
            className="w-full h-12 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 bg-transparent placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !isDisabled && onExtract()}
            aria-invalid={Boolean(urlError)}
            aria-describedby={urlError ? 'youtube-url-error' : undefined}
          />
        </div>
        <button
          onClick={onExtract}
          disabled={isDisabled}
          className={`h-12 px-8 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 ${
            isDisabled
              ? isProcessing
                ? 'bg-slate-400 cursor-wait'
                : 'bg-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              Extraer <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>

      {urlError && (
        <p
          id="youtube-url-error"
          className="mt-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {urlError}
        </p>
      )}
    </div>
  )
}
