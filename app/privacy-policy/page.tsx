import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Notes Aide',
  description: 'Privacy policy for Notes Aide.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12">
      <div className="mx-auto max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-sm p-8 md:p-10">
        <p className="text-sm text-slate-500 mb-3">Effective: February 20, 2026</p>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Privacy Policy</h1>

        <p className="text-slate-700 leading-relaxed mb-5">
          This policy describes how Notes Aide collects, uses, and protects user information.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Data We Collect</h2>
        <p className="text-slate-700 leading-relaxed">
          We collect account data (name, email), platform usage data, URLs of processed content, and
          extraction results. If you connect integrations such as Notion, we also store the OAuth token
          required to export content to your workspace.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Use of Information</h2>
        <p className="text-slate-700 leading-relaxed">
          We use information to operate the service, authenticate users, maintain extraction history,
          enable exports (e.g., to Notion, Trello, Todoist, Google Docs), and improve stability and security.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Data Sharing</h2>
        <p className="text-slate-700 leading-relaxed">
          We do not sell personal data. Some data may be processed by infrastructure providers and external
          APIs strictly to deliver the functionality requested by the user.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Retention and Security</h2>
        <p className="text-slate-700 leading-relaxed">
          We implement reasonable controls to protect information. We retain data for as long as necessary
          to operate the service or fulfill technical and legal obligations.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. User Rights</h2>
        <p className="text-slate-700 leading-relaxed">
          You may request updates or deletion of your account data by writing to the contact email below.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Contact</h2>
        <p className="text-slate-700 leading-relaxed mb-8">
          Email: <a className="text-indigo-600 hover:text-indigo-700" href="mailto:support@notesaide.com">support@notesaide.com</a>
        </p>

        <div className="pt-6 border-t border-slate-200 flex flex-wrap gap-4 text-sm">
          <Link className="text-indigo-600 hover:text-indigo-700" href="/">
            Back to home
          </Link>
          <Link className="text-indigo-600 hover:text-indigo-700" href="/terms-of-use">
            View Terms of Service
          </Link>
        </div>
      </div>
    </main>
  )
}
