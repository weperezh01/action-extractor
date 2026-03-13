import type { Metadata } from 'next'
import { CareersPageContent } from './CareersPageContent'

export const metadata: Metadata = {
  title: 'Careers | Notes Aide',
  description: 'Career interest and future opportunities at Notes Aide.',
}

export default function CareersPage() {
  return <CareersPageContent />
}
