import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | Notes Aide',
  description: 'Terms of service for Notes Aide.',
}

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12">
      <div className="mx-auto max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-sm p-8 md:p-10">
        <p className="text-sm text-slate-500 mb-3">Effective: February 20, 2026</p>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Terms of Service</h1>

        <p className="text-slate-700 leading-relaxed mb-5">
          These terms govern the use of Notes Aide. By accessing or using the platform, you agree to these terms.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance</h2>
        <p className="text-slate-700 leading-relaxed">
          By using the platform, you accept these terms and any future updates published on this site.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Permitted Use</h2>
        <p className="text-slate-700 leading-relaxed">
          You must use the service lawfully and responsibly. Using the platform for illegal activities,
          abuse of external services, or violation of third-party rights is prohibited.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Account and Access</h2>
        <p className="text-slate-700 leading-relaxed">
          You are responsible for maintaining the confidentiality of your credentials and for all activity
          conducted from your account.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Third-Party Integrations</h2>
        <p className="text-slate-700 leading-relaxed">
          Some features depend on third-party services (e.g., Notion, Trello, Todoist, Google Docs).
          Use of these integrations is also subject to the policies and terms of the respective provider.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Limitation of Liability</h2>
        <p className="text-slate-700 leading-relaxed">
          The service is provided on a best-effort basis. We do not guarantee continuous availability or
          specific commercial outcomes derived from the generated content.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Changes and Termination</h2>
        <p className="text-slate-700 leading-relaxed">
          We may update features and terms as necessary. We may also suspend access in response to misuse
          or non-compliance.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. Contact</h2>
        <p className="text-slate-700 leading-relaxed mb-8">
          Email: <a className="text-indigo-600 hover:text-indigo-700" href="mailto:support@notesaide.com">support@notesaide.com</a>
        </p>

        <div className="pt-6 border-t border-slate-200 flex flex-wrap gap-4 text-sm">
          <Link className="text-indigo-600 hover:text-indigo-700" href="/">
            Back to home
          </Link>
          <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy-policy">
            View Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  )
}
