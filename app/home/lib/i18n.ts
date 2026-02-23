export type Lang = 'en' | 'es'

export const LANG_STORAGE_KEY = 'roi-lang'

export function normalizeLang(raw: string | null | undefined): Lang {
  if (raw === 'en' || raw === 'es') return raw
  return 'en'
}

const dict = {
  en: {
    // ── nav ──
    'nav.privacy': 'Privacy Policy',
    'nav.terms': 'Terms of Use',
    'nav.openApp': 'Open app',
    'nav.dark': 'Dark mode',
    'nav.light': 'Light mode',
    'nav.langToggle': 'ES',
    'nav.signin': 'Sign in',

    // ── PublicHeroSection (kept for compatibility) ──
    'hero.badge': 'Clean Execution Layer',
    'hero.headline': 'Convert videos into executable decisions.',
    'hero.subheadline':
      'Extract real action from YouTube as an action plan, executive summary, business ideas, or key quotes. Less passive consumption, more measurable execution.',
    'hero.stat1.value': '3m',
    'hero.stat1.label': 'avg. reading time',
    'hero.stat2.value': '4',
    'hero.stat2.label': 'extraction modes',
    'hero.stat3.value': '1-Click',
    'hero.stat3.label': 'integrated export',
    'hero.cta.register': 'Create account',
    'hero.cta.login': 'I already have an account',
    'hero.preview.title': 'Preview',
    'hero.preview.badge': 'Action Plan',
    'hero.preview.phase1': 'Phase 1 · Focus & positioning',
    'hero.preview.phase2': 'Phase 2 · Offer & monetization',
    'hero.preview.phase3': 'Phase 3 · Daily execution',
    'hero.preview.timeSaved': 'Time saved',
    'hero.preview.difficulty': 'Difficulty',
    'hero.preview.difficultyValue': 'Medium',
    'hero.preview.tip1': 'From content to execution plan in minutes.',
    'hero.preview.tip2': 'Export directly to Notion, Trello, Todoist or Google Docs.',

    // ── value highlights ──
    'value.time.title': 'Save Hours',
    'value.time.desc': 'From 2 hours of video to a 3-minute read.',
    'value.action.title': 'Pure Action',
    'value.action.desc': 'No filler. Only the steps that generate ROI.',
    'value.export.title': 'Easy Export',
    'value.export.desc': 'Export in one click to Notion, Trello, Todoist or Google Doc.',

    // ── old landing keys (kept for compatibility) ──
    'landing.headline': 'From Video to',
    'landing.headlineAccent': 'Executable Money',
    'landing.headlineSuffix': 'in Seconds.',

    // ── landing · hero ──
    'landing.hero.badge': 'AI-Powered Action Extraction',
    'landing.hero.headline1': 'Stop watching,',
    'landing.hero.headline2': 'start executing.',
    'landing.hero.sub':
      'Paste a YouTube URL and get a structured action plan, executive summary, business ideas, or key quotes — powered by Claude AI — in seconds.',
    'landing.hero.cta': 'Start for free',
    'landing.hero.signin': 'Already have an account?',
    'landing.hero.signinLink': 'Sign in',

    // ── landing · how it works ──
    'landing.how.title': 'How it works',
    'landing.how.step1.title': 'Paste any URL',
    'landing.how.step1.desc':
      'YouTube video, web article, or upload a file. We extract the full content automatically.',
    'landing.how.step2.title': 'AI extracts the action',
    'landing.how.step2.desc':
      'Claude AI reads the full transcript and structures it into the format you choose.',
    'landing.how.step3.title': 'Export & execute',
    'landing.how.step3.desc':
      'One click to Notion, Trello, Todoist or Google Docs. Copy as Markdown. Done.',

    // ── landing · extraction modes ──
    'landing.modes.title': 'Four ways to extract value',
    'landing.modes.sub': 'Choose the output format that fits your workflow.',
    'landing.mode1.title': 'Action Plan',
    'landing.mode1.desc':
      'Phased plan with concrete steps, priorities, and a pro tip for immediate execution.',
    'landing.mode2.title': 'Executive Summary',
    'landing.mode2.desc':
      'Decision-ready briefing with key insights, findings, and strategic recommendations.',
    'landing.mode3.title': 'Business Ideas',
    'landing.mode3.desc':
      'Market opportunities extracted from the content, with MVP definition and success metrics.',
    'landing.mode4.title': 'Key Quotes',
    'landing.mode4.desc':
      'The most impactful quotes and ideas with practical context and direct applications.',

    // ── landing · integrations ──
    'landing.integrations.title': 'Export everywhere you work',
    'landing.integrations.sub':
      'One-click export to your favorite productivity tools. No copy-paste, no reformatting.',

    // ── landing · final CTA ──
    'landing.finalcta.title': 'Start extracting value today',
    'landing.finalcta.sub': 'Free account. No credit card required.',
    'landing.finalcta.button': 'Create free account',

    // ── landing · guest extractor ──
    'landing.hero.tryGuest': 'Try it free — no account needed',
    'landing.guest.title': 'Try it right now',
    'landing.guest.sub': '1 free extraction. No sign-up required. Results are not saved.',
    'guest.warning': '1 free extraction · No account needed · Results are not saved',
    'guest.placeholder': 'Paste a YouTube URL or any article link…',
    'guest.extract': 'Extract for free',
    'guest.extracting': 'Extracting…',
    'guest.resultTitle': 'Your free extraction',
    'guest.afterResult': 'Liked the result? Create a free account to save, export, and get more extractions.',
    'guest.createAccount': 'Create free account',
    'guest.limitReached': 'You already used your free extraction today. Create an account to continue.',
    'guest.limitCta': 'Create account',
  },
  es: {
    // ── nav ──
    'nav.privacy': 'Política de Privacidad',
    'nav.terms': 'Términos de Uso',
    'nav.openApp': 'Abrir app',
    'nav.dark': 'Modo oscuro',
    'nav.light': 'Modo claro',
    'nav.langToggle': 'EN',
    'nav.signin': 'Iniciar sesión',

    // ── PublicHeroSection ──
    'hero.badge': 'Clean Execution Layer',
    'hero.headline': 'Convierte videos en decisiones ejecutables.',
    'hero.subheadline':
      'Extrae acción real desde YouTube en formato plan, resumen ejecutivo, ideas de negocio o frases clave. Menos consumo pasivo, más ejecución medible.',
    'hero.stat1.value': '3m',
    'hero.stat1.label': 'lectura promedio',
    'hero.stat2.value': '4',
    'hero.stat2.label': 'modos de extracción',
    'hero.stat3.value': '1-Click',
    'hero.stat3.label': 'exportación integrada',
    'hero.cta.register': 'Crear cuenta',
    'hero.cta.login': 'Ya tengo cuenta',
    'hero.preview.title': 'Vista previa',
    'hero.preview.badge': 'Plan de Acción',
    'hero.preview.phase1': 'Fase 1 · Enfoque y posicionamiento',
    'hero.preview.phase2': 'Fase 2 · Oferta y monetización',
    'hero.preview.phase3': 'Fase 3 · Ejecución diaria',
    'hero.preview.timeSaved': 'Tiempo ahorrado',
    'hero.preview.difficulty': 'Dificultad',
    'hero.preview.difficultyValue': 'Media',
    'hero.preview.tip1': 'Del contenido al plan de ejecución en minutos.',
    'hero.preview.tip2': 'Exporta directo a Notion, Trello, Todoist o Google Docs.',

    // ── value highlights ──
    'value.time.title': 'Ahorra Horas',
    'value.time.desc': 'De 2 horas de video a 3 minutos de lectura.',
    'value.action.title': 'Acción Pura',
    'value.action.desc': 'Sin relleno. Solo los pasos que generan ROI.',
    'value.export.title': 'Exporta Fácil',
    'value.export.desc': 'Exporta en un click a Notion, Trello, Todoist o Google Doc.',

    // ── old landing keys ──
    'landing.headline': 'De Video a',
    'landing.headlineAccent': 'Dinero Ejecutable',
    'landing.headlineSuffix': 'en Segundos.',

    // ── landing · hero ──
    'landing.hero.badge': 'Extracción de Acción con IA',
    'landing.hero.headline1': 'Deja de ver,',
    'landing.hero.headline2': 'empieza a ejecutar.',
    'landing.hero.sub':
      'Pega una URL de YouTube y obtén un plan de acción estructurado, resumen ejecutivo, ideas de negocio o frases clave — con Claude AI — en segundos.',
    'landing.hero.cta': 'Comenzar gratis',
    'landing.hero.signin': '¿Ya tienes cuenta?',
    'landing.hero.signinLink': 'Inicia sesión',

    // ── landing · how it works ──
    'landing.how.title': 'Cómo funciona',
    'landing.how.step1.title': 'Pega cualquier URL',
    'landing.how.step1.desc':
      'Video de YouTube, artículo web o sube un archivo. Extraemos el contenido completo automáticamente.',
    'landing.how.step2.title': 'La IA extrae la acción',
    'landing.how.step2.desc':
      'Claude AI lee la transcripción completa y la estructura en el formato que eliges.',
    'landing.how.step3.title': 'Exporta y ejecuta',
    'landing.how.step3.desc':
      'Un clic a Notion, Trello, Todoist o Google Docs. Copia como Markdown. Listo.',

    // ── landing · extraction modes ──
    'landing.modes.title': 'Cuatro formas de extraer valor',
    'landing.modes.sub': 'Elige el formato de salida que encaja con tu flujo de trabajo.',
    'landing.mode1.title': 'Plan de Acción',
    'landing.mode1.desc':
      'Plan por fases con pasos concretos, prioridades y un tip profesional para ejecución inmediata.',
    'landing.mode2.title': 'Resumen Ejecutivo',
    'landing.mode2.desc':
      'Briefing listo para decidir con insights clave, hallazgos y recomendaciones estratégicas.',
    'landing.mode3.title': 'Ideas de Negocio',
    'landing.mode3.desc':
      'Oportunidades de mercado extraídas del contenido, con definición de MVP y métricas de éxito.',
    'landing.mode4.title': 'Frases Clave',
    'landing.mode4.desc':
      'Las frases más impactantes con contexto práctico y aplicaciones directas.',

    // ── landing · integrations ──
    'landing.integrations.title': 'Exporta donde trabajas',
    'landing.integrations.sub':
      'Exportación con un clic a tus herramientas favoritas. Sin copiar, sin reformatear.',

    // ── landing · final CTA ──
    'landing.finalcta.title': 'Empieza a extraer valor hoy',
    'landing.finalcta.sub': 'Cuenta gratuita. No requiere tarjeta de crédito.',
    'landing.finalcta.button': 'Crear cuenta gratis',

    // ── landing · guest extractor ──
    'landing.hero.tryGuest': 'Pruébalo gratis — sin cuenta',
    'landing.guest.title': 'Pruébalo ahora mismo',
    'landing.guest.sub': '1 extracción gratuita. Sin registro. El resultado no se guarda.',
    'guest.warning': '1 extracción gratuita · Sin registro · No se guarda el resultado',
    'guest.placeholder': 'Pega una URL de YouTube o cualquier artículo…',
    'guest.extract': 'Extraer gratis',
    'guest.extracting': 'Extrayendo…',
    'guest.resultTitle': 'Tu extracción gratuita',
    'guest.afterResult': '¿Te gustó el resultado? Crea una cuenta gratis para guardar, exportar y hacer más extracciones.',
    'guest.createAccount': 'Crear cuenta gratis',
    'guest.limitReached': 'Ya usaste tu extracción gratuita de hoy. Crea una cuenta para continuar.',
    'guest.limitCta': 'Crear cuenta',
  },
} as const

type DictKey = keyof (typeof dict)['en']

export function t(lang: Lang, key: DictKey): string {
  return dict[lang][key]
}
