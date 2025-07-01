import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Medica Movil - Encuentra y agenda citas médicas en México',
  description: 'Plataforma líder en México para encontrar doctores y agendar citas médicas. Consultas presenciales, virtuales y a domicilio con los mejores especialistas.',
  keywords: 'médicos, doctores, citas médicas, telemedicina, consultas médicas, México, salud',
  authors: [{ name: 'Medica Movil' }],
  openGraph: {
    title: 'Medica Movil - Encuentra y agenda citas médicas en México',
    description: 'Plataforma líder en México para encontrar doctores y agendar citas médicas.',
    type: 'website',
    locale: 'es_MX',
    siteName: 'Medica Movil'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Medica Movil - Encuentra y agenda citas médicas en México',
    description: 'Plataforma líder en México para encontrar doctores y agendar citas médicas.'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Providers>
            <div className="min-h-screen bg-background">
              {children}
            </div>
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}