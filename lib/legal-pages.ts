import { getAppBaseUrl } from '@/lib/notion'
import { getLegalPagePath, type LegalPageKey, type LegalPageLang } from '@/lib/legal-links'

interface LegalSection {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

interface LegalDocumentCopy {
  title: string
  metaDescription: string
  eyebrow: string
  headline: string
  intro: string
  updatedLabel: string
  updatedDate: string
  companyLabel: string
  companyValue: string
  homeLabel: string
  contactLabel: string
  siblingLabel: string
  siblingCta: string
  languageLabel: string
  languageSwitchLabel: string
  sections: LegalSection[]
}

const LEGAL_COPY: Record<LegalPageLang, Record<LegalPageKey, LegalDocumentCopy>> = {
  en: {
    privacy: {
      title: 'Privacy Policy | Notes Aide',
      metaDescription:
        'Privacy Policy for Notes Aide, including Google sign-in, Google Docs and Google Sheets export disclosures.',
      eyebrow: 'Legal',
      headline: 'Privacy Policy',
      intro:
        'This Privacy Policy explains how Notes Aide collects, uses, stores, and shares information when you use the website, the application, authentication features, and connected integrations.',
      updatedLabel: 'Last updated',
      updatedDate: 'March 15, 2026',
      companyLabel: 'Company',
      companyValue: 'Notes Aide, a product of Well Technologies',
      homeLabel: 'Back to home',
      contactLabel: 'Contact support',
      siblingLabel: 'Related document',
      siblingCta: 'Read Terms of Service',
      languageLabel: 'Language',
      languageSwitchLabel: 'Ver esta página en español',
      sections: [
        {
          title: '1. Information we collect',
          paragraphs: [
            'We may collect account and profile data such as your name, email address, authentication provider identifiers, and account settings.',
            'We also collect the content and source data you choose to process through the service, including links, uploaded files, notes, prompts, extracted playbooks, generated outputs, folders, attachments, comments, and related workspace activity.',
            'When you connect third-party tools, we may store integration metadata and tokens needed to keep the connection active and complete actions you request, such as exports to Notion, Trello, Todoist, Google Docs, or Google Sheets.',
            'We may collect technical and usage data such as device and browser details, approximate IP-derived security signals, logs, performance data, and error telemetry used to operate and secure the service.',
          ],
        },
        {
          title: '2. How we use information',
          paragraphs: [
            'We use information to provide the service, authenticate users, save workspace history, generate and store outputs, support collaboration and sharing features, fulfill export requests, process billing-related workflows, respond to support requests, and protect the platform against abuse or misuse.',
            'We may also use service data to improve reliability, product quality, and security, but not to sell personal data or to serve third-party advertising.',
          ],
        },
        {
          title: '3. Google-specific disclosures',
          paragraphs: [
            'If you sign in with Google, we receive basic identity information needed to authenticate your account, such as your name, email address, and profile data associated with Google sign-in.',
            'If you connect Google Docs or Google Sheets style export functionality, we request Google permissions only when you explicitly choose to connect that integration. Those permissions are used to create or export files in your Google account at your direction and to maintain the connection for future exports.',
            'We may store Google access token metadata, refresh tokens, scope information, and related account identifiers when necessary to keep the integration working. We do not sell Google user data and we do not use Google user data for advertising.',
          ],
        },
        {
          title: '4. Sharing and disclosure',
          paragraphs: [
            'We do not sell personal data. We may share information with infrastructure vendors, payment processors, analytics or error-monitoring providers, and integration providers only as needed to operate the service and fulfill user-requested actions.',
            'If you choose to share a playbook, folder, or public link, the information you make visible through those sharing controls may be accessible to the people or audiences you authorize.',
            'We may also disclose information when required to comply with law, protect users, prevent fraud or abuse, or enforce our agreements.',
          ],
        },
        {
          title: '5. Retention and deletion',
          paragraphs: [
            'We retain account data, connected workspace data, and generated outputs for as long as needed to operate the service, maintain your account, comply with legal obligations, resolve disputes, or enforce agreements.',
            'You may request deletion of your account data or ask us to disconnect integrations by contacting support. Some residual copies may remain in backups or logs for a limited period as part of standard operational safeguards.',
          ],
        },
        {
          title: '6. Security',
          paragraphs: [
            'We use reasonable technical and organizational measures designed to protect information against unauthorized access, loss, misuse, or disclosure. No method of storage or transmission is completely secure, so we cannot guarantee absolute security.',
          ],
        },
        {
          title: '7. International use and transfers',
          paragraphs: [
            'Notes Aide may use service providers and infrastructure located in different countries. By using the service, you understand that information may be processed in jurisdictions other than your own, subject to applicable safeguards.',
          ],
        },
        {
          title: '8. Your choices',
          paragraphs: [
            'You may update some account details from within the product, disconnect integrations through available settings, revoke provider access directly from the provider account, and contact us to request correction or deletion of account data.',
          ],
          bullets: [
            'Review outputs before relying on them for operational, legal, financial, or compliance-sensitive decisions.',
            'Use sharing controls carefully, especially when publishing public or broadly accessible content.',
          ],
        },
        {
          title: '9. Children',
          paragraphs: [
            'Notes Aide is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
          ],
        },
        {
          title: '10. Changes and contact',
          paragraphs: [
            'We may update this Privacy Policy from time to time. When we do, we will post the updated version on this page and revise the effective date.',
            'For privacy or data requests, contact support@notesaide.com.',
          ],
        },
      ],
    },
    terms: {
      title: 'Terms of Service | Notes Aide',
      metaDescription:
        'Terms of Service for Notes Aide covering accounts, user content, billing, AI-generated outputs, and integrations.',
      eyebrow: 'Legal',
      headline: 'Terms of Service',
      intro:
        'These Terms of Service govern your use of Notes Aide. By accessing or using the website, application, exports, or connected integrations, you agree to these terms.',
      updatedLabel: 'Last updated',
      updatedDate: 'March 15, 2026',
      companyLabel: 'Company',
      companyValue: 'Notes Aide, a product of Well Technologies',
      homeLabel: 'Back to home',
      contactLabel: 'Contact support',
      siblingLabel: 'Related document',
      siblingCta: 'Read Privacy Policy',
      languageLabel: 'Language',
      languageSwitchLabel: 'View this page in Spanish',
      sections: [
        {
          title: '1. Eligibility and accounts',
          paragraphs: [
            'You must use Notes Aide lawfully and only for legitimate business, educational, or personal productivity purposes. You are responsible for maintaining the confidentiality of your credentials and for activity that occurs through your account.',
          ],
        },
        {
          title: '2. The service',
          paragraphs: [
            'Notes Aide helps users transform videos, documents, notes, and other source material into structured outputs such as playbooks, views, exports, and related workflow artifacts.',
            'Features may change over time, and some capabilities depend on third-party providers or paid plans.',
          ],
        },
        {
          title: '3. User content and responsibilities',
          paragraphs: [
            'You retain responsibility for the content you upload, connect, process, share, or export through the service. You must have the rights and permissions necessary to use that content.',
            'You are responsible for reviewing generated outputs, shared links, public playbooks, and exported content before relying on them or distributing them to others.',
          ],
        },
        {
          title: '4. License to operate the service',
          paragraphs: [
            'You retain your rights in your content. You grant us a limited license to host, process, transform, store, and transmit that content solely as needed to provide, secure, improve, and support the service you request.',
          ],
        },
        {
          title: '5. Acceptable use',
          paragraphs: [
            'You may not use the service to violate law, infringe intellectual property or privacy rights, abuse connected platforms, attempt unauthorized access, interfere with platform stability, or upload or distribute harmful or fraudulent content.',
          ],
        },
        {
          title: '6. Integrations and third-party services',
          paragraphs: [
            'Some features rely on third-party services such as Google, Notion, Trello, Todoist, Stripe, or other providers. Your use of those services is also subject to their terms and policies.',
            'We are not responsible for outages, policy changes, access revocations, or behavior of third-party platforms.',
          ],
        },
        {
          title: '7. Billing, subscriptions, and cancellation',
          paragraphs: [
            'Paid plans, usage limits, and included features are described on the pricing page or at checkout. Billing may be handled by Stripe or another payment processor.',
            'If you subscribe to a paid plan, the subscription may renew on the billing cycle shown at purchase until you cancel future renewals. Refund requests, if any, are handled according to applicable law and any terms shown at purchase or communicated by support.',
          ],
        },
        {
          title: '8. Availability and product changes',
          paragraphs: [
            'We may modify, improve, limit, suspend, or discontinue features at any time. We do not guarantee uninterrupted availability, specific uptime, or continued support for every format, integration, or workflow.',
          ],
        },
        {
          title: '9. Output disclaimer',
          paragraphs: [
            'Generated outputs are provided as an assistive productivity feature. They may be incomplete, inaccurate, or unsuitable for your specific context. You remain responsible for validating outputs before using them in operational, legal, financial, medical, educational, or compliance-sensitive situations.',
          ],
        },
        {
          title: '10. Warranty disclaimer and limitation of liability',
          paragraphs: [
            'To the maximum extent permitted by law, the service is provided on an “as is” and “as available” basis without warranties of any kind. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, revenue, or business opportunities arising from use of the service.',
          ],
        },
        {
          title: '11. Suspension and termination',
          paragraphs: [
            'We may suspend or terminate access if we reasonably believe you violated these terms, created risk for the platform or other users, or used the service in a fraudulent, abusive, or unlawful way.',
          ],
        },
        {
          title: '12. Changes and contact',
          paragraphs: [
            'We may update these Terms of Service from time to time by publishing the revised version on this page and updating the effective date.',
            'Questions about these terms can be sent to support@notesaide.com.',
          ],
        },
      ],
    },
  },
  es: {
    privacy: {
      title: 'Política de Privacidad | Notes Aide',
      metaDescription:
        'Política de Privacidad de Notes Aide, incluyendo disclosure sobre Google sign-in y exportaciones a Google Docs y Google Sheets.',
      eyebrow: 'Legal',
      headline: 'Política de Privacidad',
      intro:
        'Esta Política de Privacidad explica cómo Notes Aide recopila, usa, almacena y comparte información cuando utilizas el sitio web, la aplicación, las funciones de autenticación y las integraciones conectadas.',
      updatedLabel: 'Última actualización',
      updatedDate: '15 de marzo de 2026',
      companyLabel: 'Compañía',
      companyValue: 'Notes Aide, un producto de Well Technologies',
      homeLabel: 'Volver al inicio',
      contactLabel: 'Contactar soporte',
      siblingLabel: 'Documento relacionado',
      siblingCta: 'Leer Términos de Servicio',
      languageLabel: 'Idioma',
      languageSwitchLabel: 'Ver esta página en inglés',
      sections: [
        {
          title: '1. Información que recopilamos',
          paragraphs: [
            'Podemos recopilar datos de cuenta y perfil como tu nombre, correo electrónico, identificadores del proveedor de autenticación y ajustes de cuenta.',
            'También recopilamos el contenido y los datos fuente que decides procesar mediante el servicio, incluyendo enlaces, archivos subidos, notas, prompts, playbooks extraídos, salidas generadas, carpetas, adjuntos, comentarios y actividad relacionada del workspace.',
            'Cuando conectas herramientas de terceros, podemos almacenar metadatos de integración y tokens necesarios para mantener la conexión activa y completar acciones que solicitas, como exportaciones a Notion, Trello, Todoist, Google Docs o Google Sheets.',
            'Podemos recopilar datos técnicos y de uso como detalles del dispositivo y navegador, señales de seguridad derivadas de IP aproximada, logs, datos de rendimiento y telemetría de errores utilizados para operar y proteger el servicio.',
          ],
        },
        {
          title: '2. Cómo usamos la información',
          paragraphs: [
            'Usamos la información para prestar el servicio, autenticar usuarios, guardar historial de workspaces, generar y almacenar salidas, soportar funciones de colaboración y compartición, cumplir solicitudes de exportación, procesar flujos relacionados con billing, responder soporte y proteger la plataforma frente a abuso o mal uso.',
            'También podemos usar datos del servicio para mejorar confiabilidad, calidad del producto y seguridad, pero no para vender datos personales ni para publicidad de terceros.',
          ],
        },
        {
          title: '3. Disclosure específico de Google',
          paragraphs: [
            'Si inicias sesión con Google, recibimos la información básica de identidad necesaria para autenticar tu cuenta, como tu nombre, correo electrónico y datos de perfil asociados al inicio de sesión con Google.',
            'Si conectas la funcionalidad de exportación a Google Docs o Google Sheets, solicitamos permisos de Google solo cuando eliges conectar esa integración de forma explícita. Esos permisos se usan para crear o exportar archivos en tu cuenta de Google siguiendo tus instrucciones y para mantener la conexión disponible para exportaciones futuras.',
            'Podemos almacenar metadatos de tokens de acceso de Google, refresh tokens, scopes e identificadores de cuenta relacionados cuando sea necesario para mantener la integración operativa. No vendemos datos de usuarios de Google ni usamos datos de usuarios de Google para publicidad.',
          ],
        },
        {
          title: '4. Compartición y divulgación',
          paragraphs: [
            'No vendemos datos personales. Podemos compartir información con proveedores de infraestructura, procesadores de pago, proveedores de analítica o monitoreo de errores y proveedores de integración solo cuando sea necesario para operar el servicio y ejecutar acciones solicitadas por el usuario.',
            'Si decides compartir un playbook, carpeta o enlace público, la información que hagas visible mediante esos controles de compartición puede ser accesible para las personas o audiencias que autorices.',
            'También podemos divulgar información cuando sea necesario para cumplir la ley, proteger a usuarios, prevenir fraude o abuso, o hacer cumplir nuestros acuerdos.',
          ],
        },
        {
          title: '5. Retención y eliminación',
          paragraphs: [
            'Conservamos datos de cuenta, datos de workspaces conectados y salidas generadas durante el tiempo necesario para operar el servicio, mantener tu cuenta, cumplir obligaciones legales, resolver disputas o hacer cumplir acuerdos.',
            'Puedes solicitar la eliminación de datos de tu cuenta o pedir que desconectemos integraciones contactando a soporte. Algunas copias residuales pueden permanecer temporalmente en backups o logs como parte de salvaguardas operativas estándar.',
          ],
        },
        {
          title: '6. Seguridad',
          paragraphs: [
            'Usamos medidas técnicas y organizativas razonables diseñadas para proteger la información frente a acceso no autorizado, pérdida, mal uso o divulgación. Ningún método de almacenamiento o transmisión es completamente seguro, por lo que no podemos garantizar seguridad absoluta.',
          ],
        },
        {
          title: '7. Uso internacional y transferencias',
          paragraphs: [
            'Notes Aide puede utilizar proveedores e infraestructura ubicados en distintos países. Al usar el servicio, entiendes que la información puede procesarse en jurisdicciones distintas a la tuya, sujetas a las salvaguardas aplicables.',
          ],
        },
        {
          title: '8. Tus opciones',
          paragraphs: [
            'Puedes actualizar algunos datos de tu cuenta desde el producto, desconectar integraciones mediante los ajustes disponibles, revocar acceso directamente desde la cuenta del proveedor y contactarnos para solicitar corrección o eliminación de datos de cuenta.',
          ],
          bullets: [
            'Revisa las salidas antes de apoyarte en ellas para decisiones operativas, legales, financieras o sensibles de cumplimiento.',
            'Usa con cuidado los controles de compartición, especialmente al publicar contenido público o ampliamente accesible.',
          ],
        },
        {
          title: '9. Menores',
          paragraphs: [
            'Notes Aide no está dirigido a menores de 13 años y no recopilamos intencionalmente información personal de menores de 13 años.',
          ],
        },
        {
          title: '10. Cambios y contacto',
          paragraphs: [
            'Podemos actualizar esta Política de Privacidad periódicamente. Cuando lo hagamos, publicaremos la versión actualizada en esta página y revisaremos la fecha de vigencia.',
            'Para solicitudes relacionadas con privacidad o datos, escribe a support@notesaide.com.',
          ],
        },
      ],
    },
    terms: {
      title: 'Términos de Servicio | Notes Aide',
      metaDescription:
        'Términos de Servicio de Notes Aide sobre cuentas, contenido del usuario, billing, outputs generados e integraciones.',
      eyebrow: 'Legal',
      headline: 'Términos de Servicio',
      intro:
        'Estos Términos de Servicio regulan el uso de Notes Aide. Al acceder o usar el sitio web, la aplicación, las exportaciones o las integraciones conectadas, aceptas estos términos.',
      updatedLabel: 'Última actualización',
      updatedDate: '15 de marzo de 2026',
      companyLabel: 'Compañía',
      companyValue: 'Notes Aide, un producto de Well Technologies',
      homeLabel: 'Volver al inicio',
      contactLabel: 'Contactar soporte',
      siblingLabel: 'Documento relacionado',
      siblingCta: 'Leer Política de Privacidad',
      languageLabel: 'Idioma',
      languageSwitchLabel: 'Ver esta página en inglés',
      sections: [
        {
          title: '1. Elegibilidad y cuentas',
          paragraphs: [
            'Debes usar Notes Aide de manera lícita y solo para fines legítimos de negocio, estudio o productividad personal. Eres responsable de mantener la confidencialidad de tus credenciales y de la actividad que ocurra en tu cuenta.',
          ],
        },
        {
          title: '2. El servicio',
          paragraphs: [
            'Notes Aide ayuda a transformar videos, documentos, notas y otros materiales fuente en salidas estructuradas como playbooks, vistas, exportaciones y otros artefactos de flujo de trabajo.',
            'Las funciones pueden cambiar con el tiempo y algunas capacidades dependen de proveedores externos o de planes pagos.',
          ],
        },
        {
          title: '3. Contenido del usuario y responsabilidades',
          paragraphs: [
            'Mantienes la responsabilidad sobre el contenido que subes, conectas, procesas, compartes o exportas mediante el servicio. Debes tener los derechos y permisos necesarios para usar ese contenido.',
            'Eres responsable de revisar outputs generados, enlaces compartidos, playbooks públicos y contenido exportado antes de confiar en ellos o distribuirlos a terceros.',
          ],
        },
        {
          title: '4. Licencia para operar el servicio',
          paragraphs: [
            'Mantienes tus derechos sobre tu contenido. Nos concedes una licencia limitada para alojarlo, procesarlo, transformarlo, almacenarlo y transmitirlo únicamente en la medida necesaria para prestar, asegurar, mejorar y soportar el servicio que solicitas.',
          ],
        },
        {
          title: '5. Uso aceptable',
          paragraphs: [
            'No puedes usar el servicio para violar la ley, infringir derechos de propiedad intelectual o privacidad, abusar de plataformas conectadas, intentar acceso no autorizado, interferir con la estabilidad de la plataforma ni subir o distribuir contenido dañino o fraudulento.',
          ],
        },
        {
          title: '6. Integraciones y servicios de terceros',
          paragraphs: [
            'Algunas funciones dependen de servicios de terceros como Google, Notion, Trello, Todoist, Stripe u otros proveedores. Tu uso de esos servicios también está sujeto a sus propios términos y políticas.',
            'No somos responsables por caídas, cambios de política, revocaciones de acceso o comportamientos de plataformas de terceros.',
          ],
        },
        {
          title: '7. Billing, suscripciones y cancelación',
          paragraphs: [
            'Los planes pagos, límites de uso y funciones incluidas se describen en la página de precios o durante el checkout. El billing puede gestionarse mediante Stripe u otro procesador de pagos.',
            'Si te suscribes a un plan pago, la suscripción puede renovarse según el ciclo mostrado en la compra hasta que canceles las renovaciones futuras. Las solicitudes de reembolso, si existen, se gestionan conforme a la ley aplicable y a cualquier condición mostrada durante la compra o comunicada por soporte.',
          ],
        },
        {
          title: '8. Disponibilidad y cambios del producto',
          paragraphs: [
            'Podemos modificar, mejorar, limitar, suspender o discontinuar funciones en cualquier momento. No garantizamos disponibilidad ininterrumpida, uptime específico ni soporte continuo para todos los formatos, integraciones o flujos de trabajo.',
          ],
        },
        {
          title: '9. Disclaimer sobre outputs',
          paragraphs: [
            'Los outputs generados se ofrecen como una función asistiva de productividad. Pueden ser incompletos, inexactos o no adecuados para tu contexto específico. Sigues siendo responsable de validar los outputs antes de usarlos en situaciones operativas, legales, financieras, médicas, educativas o sensibles de cumplimiento.',
          ],
        },
        {
          title: '10. Descargo de garantías y limitación de responsabilidad',
          paragraphs: [
            'En la máxima medida permitida por la ley, el servicio se ofrece “tal cual” y “según disponibilidad”, sin garantías de ningún tipo. No somos responsables por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de datos, ingresos u oportunidades de negocio derivadas del uso del servicio.',
          ],
        },
        {
          title: '11. Suspensión y terminación',
          paragraphs: [
            'Podemos suspender o terminar el acceso si consideramos razonablemente que violaste estos términos, creaste riesgo para la plataforma o para otros usuarios, o usaste el servicio de forma fraudulenta, abusiva o ilegal.',
          ],
        },
        {
          title: '12. Cambios y contacto',
          paragraphs: [
            'Podemos actualizar estos Términos de Servicio periódicamente publicando la versión revisada en esta página y actualizando la fecha de vigencia.',
            'Las preguntas sobre estos términos pueden enviarse a support@notesaide.com.',
          ],
        },
      ],
    },
  },
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => `<p class="copy">${escapeHtml(paragraph)}</p>`)
    .join('')
}

function renderBullets(bullets?: string[]) {
  if (!bullets?.length) return ''
  return `<ul class="bullet-list">${bullets
    .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
    .join('')}</ul>`
}

function renderSections(sections: LegalSection[]) {
  return sections
    .map(
      (section) => `
        <section class="section">
          <h2>${escapeHtml(section.title)}</h2>
          ${renderParagraphs(section.paragraphs)}
          ${renderBullets(section.bullets)}
        </section>
      `
    )
    .join('')
}

function renderLegalDocument(page: LegalPageKey, lang: LegalPageLang) {
  const copy = LEGAL_COPY[lang][page]
  const siblingPage: LegalPageKey = page === 'privacy' ? 'terms' : 'privacy'
  const origin = getAppBaseUrl()
  const currentPath = getLegalPagePath(lang, page)
  const siblingPath = getLegalPagePath(lang, siblingPage)
  const canonicalPath = getLegalPagePath('en', page)
  const alternateLang: LegalPageLang = lang === 'en' ? 'es' : 'en'
  const alternatePath = getLegalPagePath(alternateLang, page)

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.title)}</title>
    <meta name="description" content="${escapeHtml(copy.metaDescription)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${origin}${canonicalPath}" />
    <link rel="alternate" hreflang="en" href="${origin}${getLegalPagePath('en', page)}" />
    <link rel="alternate" hreflang="es" href="${origin}${getLegalPagePath('es', page)}" />
    <link rel="alternate" hreflang="x-default" href="${origin}${canonicalPath}" />
    <style>
      :root {
        color-scheme: light;
        --bg: #f8fafc;
        --panel: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --border: #e2e8f0;
        --accent: #0f172a;
        --accent-soft: #eef2ff;
        --accent-line: #cbd5e1;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top, rgba(250, 204, 21, 0.14), transparent 28%),
          var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.65;
      }
      a { color: inherit; }
      .shell {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 28px;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .hero {
        padding: 28px 28px 22px;
        border-bottom: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid #dbeafe;
        background: var(--accent-soft);
        color: #334155;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 18px 0 12px;
        font-size: clamp(2rem, 4vw, 3.25rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }
      .lead {
        margin: 0;
        max-width: 760px;
        color: var(--muted);
        font-size: 1.05rem;
      }
      .meta {
        display: grid;
        gap: 14px;
        margin-top: 24px;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      .meta-item {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: #f8fafc;
      }
      .meta-label {
        display: block;
        margin-bottom: 6px;
        color: #64748b;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .meta-value, .meta-item a {
        color: var(--text);
        font-size: 0.97rem;
        font-weight: 600;
        text-decoration: none;
      }
      .content {
        padding: 30px 28px 24px;
      }
      .section + .section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
      }
      .section h2 {
        margin: 0 0 10px;
        font-size: 1.16rem;
        line-height: 1.3;
        letter-spacing: -0.02em;
      }
      .copy {
        margin: 0 0 12px;
        color: var(--muted);
      }
      .bullet-list {
        margin: 12px 0 0;
        padding-left: 20px;
        color: var(--muted);
      }
      .bullet-list li + li {
        margin-top: 8px;
      }
      .footer-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 24px 28px 30px;
        border-top: 1px solid var(--border);
        background: #fbfdff;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid var(--accent-line);
        background: white;
        color: #0f172a;
        text-decoration: none;
        font-size: 0.94rem;
        font-weight: 600;
      }
      .pill.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: white;
      }
      @media (max-width: 640px) {
        .shell { padding: 20px 14px 44px; }
        .hero, .content, .footer-nav { padding-left: 18px; padding-right: 18px; }
        .meta { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <article class="card">
        <header class="hero">
          <span class="eyebrow">${escapeHtml(copy.eyebrow)}</span>
          <h1>${escapeHtml(copy.headline)}</h1>
          <p class="lead">${escapeHtml(copy.intro)}</p>
          <div class="meta">
            <div class="meta-item">
              <span class="meta-label">${escapeHtml(copy.updatedLabel)}</span>
              <span class="meta-value">${escapeHtml(copy.updatedDate)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">${escapeHtml(copy.companyLabel)}</span>
              <span class="meta-value">${escapeHtml(copy.companyValue)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">${escapeHtml(copy.languageLabel)}</span>
              <a href="${escapeHtml(alternatePath)}">${escapeHtml(copy.languageSwitchLabel)}</a>
            </div>
          </div>
        </header>
        <div class="content">
          ${renderSections(copy.sections)}
        </div>
        <nav class="footer-nav">
          <a class="pill" href="/">${escapeHtml(copy.homeLabel)}</a>
          <a class="pill" href="/contact">${escapeHtml(copy.contactLabel)}</a>
          <a class="pill primary" href="${escapeHtml(siblingPath)}">${escapeHtml(copy.siblingCta)}</a>
        </nav>
      </article>
    </main>
  </body>
</html>`
}

export function buildLegalHtmlResponse(page: LegalPageKey, lang: LegalPageLang) {
  return new Response(renderLegalDocument(page, lang), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-language': lang,
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      'x-robots-tag': 'index, follow',
    },
  })
}
