import type { Metadata } from 'next'
import { AboutUsPageContent } from './AboutUsPageContent'

export const metadata: Metadata = {
  title: 'About Us | Notes Aide',
  description: 'General information about Notes Aide and Well Technologies.',
}

export default function AboutUsPage() {
  return <AboutUsPageContent />
}
