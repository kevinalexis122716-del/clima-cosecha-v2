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
      <body className={`${dmSans.className} bg-slate-50 min-h-screen m-0 p-0`}>
        {children}
      </body>
    </html>
  )
}
