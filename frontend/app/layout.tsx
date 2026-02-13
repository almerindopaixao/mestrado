import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'Projeto - Descricao de Elementos Visuais em Aulas',
  description:
    'Ferramenta de tecnologia assistiva que analisa videos de aulas e gera descricoes textuais acessiveis de elementos figurados como diagramas, tabelas e graficos para estudantes com deficiencia visual.',
}

export const viewport: Viewport = {
  themeColor: '#0c6ea1',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
