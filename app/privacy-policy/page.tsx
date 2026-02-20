import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad | Roi Action Extractor App',
  description: 'Política de privacidad temporal para Roi Action Extractor App.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12">
      <div className="mx-auto max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-sm p-8 md:p-10">
        <p className="text-sm text-slate-500 mb-3">Vigencia: 20 de febrero de 2026</p>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Política de Privacidad (Temporal)</h1>

        <p className="text-slate-700 leading-relaxed mb-5">
          Esta política describe cómo Roi Action Extractor App recopila, usa y protege la información de los usuarios.
          Este documento es temporal y será reemplazado por una versión legal final.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Datos que recopilamos</h2>
        <p className="text-slate-700 leading-relaxed">
          Recopilamos datos de cuenta (nombre, correo), datos de uso de la plataforma, URLs de videos procesados y
          resultados de extracción. Si conectas Notion, también se almacena el token OAuth necesario para exportar
          contenido a tu workspace.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Uso de la información</h2>
        <p className="text-slate-700 leading-relaxed">
          Usamos la información para operar el servicio, autenticar usuarios, guardar historial de extracciones,
          habilitar exportaciones (por ejemplo a Notion) y mejorar estabilidad y seguridad.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Compartición de datos</h2>
        <p className="text-slate-700 leading-relaxed">
          No vendemos datos personales. Algunos datos pueden procesarse mediante proveedores de infraestructura y APIs
          externas estrictamente para entregar la funcionalidad solicitada por el usuario.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Conservación y seguridad</h2>
        <p className="text-slate-700 leading-relaxed">
          Implementamos controles razonables para proteger la información. Conservamos datos durante el tiempo necesario
          para operar el servicio o cumplir obligaciones técnicas y legales.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Derechos del usuario</h2>
        <p className="text-slate-700 leading-relaxed">
          Puedes solicitar actualización o eliminación de datos de cuenta escribiendo al correo de contacto.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Contacto</h2>
        <p className="text-slate-700 leading-relaxed mb-8">
          Correo: <a className="text-indigo-600 hover:text-indigo-700" href="mailto:wdperezh@gmail.com">wdperezh@gmail.com</a>
        </p>

        <div className="pt-6 border-t border-slate-200 flex flex-wrap gap-4 text-sm">
          <Link className="text-indigo-600 hover:text-indigo-700" href="/">
            Volver al inicio
          </Link>
          <Link className="text-indigo-600 hover:text-indigo-700" href="/terms-of-use">
            Ver Términos de Uso
          </Link>
        </div>
      </div>
    </main>
  )
}
