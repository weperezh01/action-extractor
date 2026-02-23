export type Lang = 'en' | 'es'

export const LANG_STORAGE_KEY = 'roi-lang'

export function normalizeLang(raw: string | null | undefined): Lang {
  if (raw === 'en' || raw === 'es') return raw
  return 'en'
}

const dict = {
  en: {
    'nav.privacy': 'Privacy Policy',
    'nav.terms': 'Terms of Use',
    'nav.openApp': 'Open app',
    'nav.dark': 'Dark mode',
    'nav.light': 'Light mode',
    'nav.langToggle': 'ES',

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

    'value.time.title': 'Save Hours',
    'value.time.desc': 'From 2 hours of video to a 3-minute read.',
    'value.action.title': 'Pure Action',
    'value.action.desc': 'No filler. Only the steps that generate ROI.',
    'value.export.title': 'Easy Export',
    'value.export.desc': 'Export in one click to Notion, Trello, Todoist or Google Doc.',

    'landing.headline': 'From Video to',
    'landing.headlineAccent': 'Executable Money',
    'landing.headlineSuffix': 'in Seconds.',
  },
  es: {
    'nav.privacy': 'Política de Privacidad',
    'nav.terms': 'Términos de Uso',
    'nav.openApp': 'Abrir app',
    'nav.dark': 'Modo oscuro',
    'nav.light': 'Modo claro',
    'nav.langToggle': 'EN',

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

    'value.time.title': 'Ahorra Horas',
    'value.time.desc': 'De 2 horas de video a 3 minutos de lectura.',
    'value.action.title': 'Acción Pura',
    'value.action.desc': 'Sin relleno. Solo los pasos que generan ROI.',
    'value.export.title': 'Exporta Fácil',
    'value.export.desc': 'Exporta en un click a Notion, Trello, Todoist o Google Doc.',

    'landing.headline': 'De Video a',
    'landing.headlineAccent': 'Dinero Ejecutable',
    'landing.headlineSuffix': 'en Segundos.',
  },
} as const

type DictKey = keyof (typeof dict)['en']

export function t(lang: Lang, key: DictKey): string {
  return dict[lang][key]
}
