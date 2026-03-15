import type { Metadata } from 'next'
import { AuthStandalonePage } from '@/app/components/AuthStandalonePage'

export const metadata: Metadata = {
  title: 'Sign In | Notes Aide',
  description: 'Sign in to Notes Aide to save, export, and manage your extractions.',
}

export default function LoginPage() {
  return <AuthStandalonePage initialAuthMode="login" />
}
