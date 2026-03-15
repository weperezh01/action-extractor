import Link from 'next/link'
import { Github, Linkedin, Twitter } from 'lucide-react'
import { NotesAideLogo } from '@/app/components/NotesAideLogo'
import type { Lang } from '@/app/home/lib/i18n'
import { getLegalPagePath } from '@/lib/legal-links'

type FooterLinkItem = {
  label: string
  href: string
}

function FooterLink({ item }: { item: FooterLinkItem }) {
  const className = 'transition-colors hover:text-slate-800 dark:hover:text-slate-200'

  if (item.href.startsWith('mailto:') || item.href.startsWith('http')) {
    return (
      <a
        href={item.href}
        className={className}
        target={item.href.startsWith('http') ? '_blank' : undefined}
        rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {item.label}
      </a>
    )
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  )
}

export function AppFooter({ lang }: { lang: Lang }) {
  const isEs = lang === 'es'
  const privacyHref = getLegalPagePath(lang, 'privacy')
  const termsHref = getLegalPagePath(lang, 'terms')
  const copy = isEs
    ? {
        tagline: 'Convierte contenido en planes de ejecución claros en segundos.',
        product: 'Producto',
        useCases: 'Casos de uso',
        company: 'Compañía',
        legal: 'Legal',
        app: 'App',
        pricing: 'Precios',
        integrations: 'Integraciones',
        consultants: 'Consultores',
        students: 'Estudiantes',
        contentCreators: 'Creadores de contenido',
        projectManagers: 'Gerentes de proyecto',
        about: 'Sobre nosotros',
        careers: 'Carreras',
        support: 'Contactar soporte',
        privacy: 'Política de privacidad',
        terms: 'Términos de servicio',
        rights: 'Todos los derechos reservados.',
        poweredBy: 'Powered by',
        socialSlot: 'Espacio para redes sociales',
      }
    : {
        tagline: 'Turn content into execution-ready plans in seconds.',
        product: 'Product',
        useCases: 'Use Cases',
        company: 'Company',
        legal: 'Legal',
        app: 'App',
        pricing: 'Pricing',
        integrations: 'Integrations',
        consultants: 'Consultants',
        students: 'Students',
        contentCreators: 'Content Creators',
        projectManagers: 'Project Managers',
        about: 'About Us',
        careers: 'Careers',
        support: 'Contact Support',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        rights: 'All rights reserved.',
        poweredBy: 'Powered by',
        socialSlot: 'Social icons',
      }

  const columns: Array<{ title: string; links: FooterLinkItem[] }> = [
    {
      title: copy.product,
      links: [
        { label: copy.app, href: '/app' },
        { label: copy.pricing, href: '/#pricing' },
        { label: copy.integrations, href: '/#integrations' },
      ],
    },
    {
      title: copy.useCases,
      links: [
        { label: copy.consultants, href: '/#use-case-consultants' },
        { label: copy.students, href: '/#use-case-students' },
        { label: copy.contentCreators, href: '/#use-case-content-creators' },
        { label: copy.projectManagers, href: '/#use-case-project-managers' },
      ],
    },
    {
      title: copy.company,
      links: [
        { label: copy.about, href: '/about-us' },
        { label: copy.careers, href: '/careers' },
        { label: copy.support, href: '/contact' },
      ],
    },
    {
      title: copy.legal,
      links: [
        { label: copy.privacy, href: privacyHref },
        { label: copy.terms, href: termsHref },
      ],
    },
  ]

  const socialIcons = [Linkedin, Twitter, Github]

  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="flex flex-col gap-3">
            <NotesAideLogo
              className="h-11 w-[210px] text-slate-800 dark:text-slate-100"
              title="Notes Aide"
            />

            <p className="max-w-[260px] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {copy.tagline}
            </p>
          </div>

          <nav className="grid gap-8 text-sm font-medium text-slate-500 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {column.title}
                </span>
                {column.links.map((link) => (
                  <FooterLink key={`${column.title}-${link.label}`} item={link} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="my-8 border-t border-slate-100 dark:border-slate-800" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} Notes Aide. {copy.rights}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {copy.poweredBy}{' '}
              <a
                href="https://welltechnologies.net"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-800 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-slate-100"
              >
                Well Technologies
              </a>
            </p>

            <div className="flex items-center gap-2" aria-label={copy.socialSlot}>
              {socialIcons.map((Icon, index) => (
                <span
                  key={index}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                >
                  <Icon size={14} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
