import './globals.css'

export const metadata = {
  title: 'Second Quint',
  description: 'Centered image website',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}