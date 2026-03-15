import type { Metadata } from 'next'
import { ContactPageContent } from './ContactPageContent'

export const metadata: Metadata = {
  title: 'Contact Support | Notes Aide',
  description: 'Contact support, billing, or partnership requests for Notes Aide.',
}

export default function ContactPage() {
  return <ContactPageContent />
}
