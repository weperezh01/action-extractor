import type { Metadata } from 'next'
import SettingsPageClient from './SettingsPageClient'

export const metadata: Metadata = {
  title: 'Configuración de Cuenta | Notes Aide',
  description: 'Administra tu perfil, contraseña, consumo y privacidad en Notes Aide.',
}

export default function SettingsPage() {
  return <SettingsPageClient />
}
