import type { Metadata } from 'next'
import SettingsPageClient from './SettingsPageClient'

export const metadata: Metadata = {
  title: 'Configuración de Cuenta | Roi Action Extractor App',
  description: 'Administra tu perfil, contraseña, consumo y privacidad en Roi Action Extractor App.',
}

export default function SettingsPage() {
  return <SettingsPageClient />
}
