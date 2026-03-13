import type { Metadata } from 'next'
import { AuthStandalonePage } from '@/app/components/AuthStandalonePage'

export const metadata: Metadata = {
  title: 'Sign In | Notes Aide',
  description: 'Sign in to Notes Aide without loading the full extractor interface first.',
}

export default function LoginPage() {
  return <AuthStandalonePage initialAuthMode="login" />
}
