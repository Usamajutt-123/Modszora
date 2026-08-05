import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import { organizationJsonLd, websiteJsonLd } from '@modverse/shared';
import { ThemeProvider, themeInitScript } from '@/components/theme/ThemeProvider';
import { env, siteUrl } from '@/lib/env';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800'],
  fallback: ['system-ui', 'arial'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'MODSzora — Premium MOD APK Games for Android',
    description:
      'Download premium MOD APK games with unlimited money, unlocked features and mod menus. Virus-scanned, version-tracked and updated daily.',
    path: '/',
    keywords: ['mod apk', 'android games', 'mod menu', 'unlimited money apk', 'premium apk', 'modded games'],
  }),
  applicationName: 'MODSzora',
  referrer: 'origin-when-cross-origin',
  formatDetection: { telephone: false, address: false, email: false },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
    
  },
  
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#070912' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = { siteUrl: siteUrl(), siteName: env.NEXT_PUBLIC_SITE_NAME || 'MODSzora' };
  const gaId = env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${mono.variable} mv-theme-loading`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://picsum.photos" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript([organizationJsonLd(ctx), websiteJsonLd(ctx)]) }}
        />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink">
        <ThemeProvider defaultTheme="system">{children}</ThemeProvider>

        {gaId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
