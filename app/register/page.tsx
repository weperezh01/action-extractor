import type { Metadata } from 'next'
import { AuthStandalonePage } from '@/app/components/AuthStandalonePage'

export const metadata: Metadata = {
  title: 'Create Account | Notes Aide',
  description: 'Create a Notes Aide account to save, export, and organize your extractions.',
}

export default function RegisterPage() {
  return <AuthStandalonePage initialAuthMode="register" />
}
