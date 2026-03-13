import { getLocale, getMessages } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
