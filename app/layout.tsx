import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clima Cosecha | Monitoreo Agroclimático',
  description: 'Sistema de monitoreo de precipitación y clima para el Valle del Cauca',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={dmSans.className} style={{
        margin: 0,
        padding: 0,
        background: '#f1f5f9',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  )
}
