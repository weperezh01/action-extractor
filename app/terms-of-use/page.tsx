import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos de Uso | Roi Action Extractor App',
  description: 'Términos de uso temporales para Roi Action Extractor App.',
}

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12">
      <div className="mx-auto max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-sm p-8 md:p-10">
        <p className="text-sm text-slate-500 mb-3">Vigencia: 20 de febrero de 2026</p>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Términos de Uso (Temporal)</h1>

        <p className="text-slate-700 leading-relaxed mb-5">
          Estos términos regulan el uso de Roi Action Extractor App. Este documento es temporal y será sustituido por
          una versión legal final.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Aceptación</h2>
        <p className="text-slate-700 leading-relaxed">
          Al usar la plataforma, aceptas estos términos y cualquier actualización futura publicada en este sitio.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Uso permitido</h2>
        <p className="text-slate-700 leading-relaxed">
          Debes usar el servicio de forma legal y responsable. No está permitido usar la plataforma para actividades
          ilícitas, abuso de servicios externos o vulneración de derechos de terceros.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Cuenta y acceso</h2>
        <p className="text-slate-700 leading-relaxed">
          Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada desde tu
          cuenta.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Integraciones de terceros</h2>
        <p className="text-slate-700 leading-relaxed">
          Algunas funciones dependen de terceros (por ejemplo Notion). El uso de esas integraciones también está sujeto
          a las políticas y términos del proveedor correspondiente.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Limitación de responsabilidad</h2>
        <p className="text-slate-700 leading-relaxed">
          El servicio se ofrece sobre base de mejor esfuerzo. No garantizamos disponibilidad continua ni resultados
          comerciales específicos derivados del contenido generado.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Cambios y terminación</h2>
        <p className="text-slate-700 leading-relaxed">
          Podemos actualizar funciones y términos cuando sea necesario. También podemos suspender acceso ante uso
          indebido o incumplimiento.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. Contacto</h2>
        <p className="text-slate-700 leading-relaxed mb-8">
          Correo: <a className="text-indigo-600 hover:text-indigo-700" href="mailto:wdperezh@gmail.com">wdperezh@gmail.com</a>
        </p>

        <div className="pt-6 border-t border-slate-200 flex flex-wrap gap-4 text-sm">
          <Link className="text-indigo-600 hover:text-indigo-700" href="/">
            Volver al inicio
          </Link>
          <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy-policy">
            Ver Política de Privacidad
          </Link>
        </div>
      </div>
    </main>
  )
}
