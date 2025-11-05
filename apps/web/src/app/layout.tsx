// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './globals.css';
import ReactQueryProvider from './react-query-provider';
import { AuthProvider } from '@/hooks/use-auth';
import LayoutShell from '@/components/LayoutShell'; // ← import your new shell
import serverRequest from '@/lib/server-request';
import { SettingsProvider } from '@/lib/settings-context';
import type { ISettingResponse } from '@elearning/types';
import { MuteProvider } from '@/hooks/MuteContext';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const APP_NAME = 'Freebaj';
const APP_DEFAULT_TITLE = 'Freebaj';
const APP_TITLE_TEMPLATE = '%s - Freebaj';
const APP_DESCRIPTION = 'Best Free courses!';

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.jpg',
    apple: '/square.jpg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_DEFAULT_TITLE,
    startupImage: '/logo.jpg',
  },
  other: { 'apple-mobile-web-app-capable': 'yes' },

  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = { themeColor: '#FFFFFF' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
 

  const settings = await serverRequest<ISettingResponse>('/settings');

  return (
    <ReactQueryProvider>
      <AuthProvider>
        <html lang="en">
          <head>
            <link rel="manifest" href="/site.webmanifest" />
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content="Freebaj" />
            <meta name="application-name" content="Freebaj" />
            <meta name="theme-color" content="#ffffff" />
            <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></meta>
            {/* iOS PWA splash screens */}
            {/* iPhone SE (1st gen) – 640×1136, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/640x1136.png"
              media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/640x1136.png"
              media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />

            {/* iPhone 8 – 750×1334, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/750x1334.png"
              media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/750x1334.png"
              media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />

            {/* iPhone 8 Plus – 1242×2208, DPR=3 */}
            <link
              rel="apple-touch-startup-image"
              href="/1242x2208.png"
              media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1242x2208.png"
              media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
            />

            {/* iPhone X / 11 Pro / XS – 1125×2436, DPR=3 */}
            <link
              rel="apple-touch-startup-image"
              href="/1125x2436.png"
              media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1125x2436.png"
              media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
            />

            {/* iPhone XR / 11 – 828×1792, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/828x1792.png"
              media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/828x1792.png"
              media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />

            {/* iPhone 11 Pro Max / XS Max – 1242×2688, DPR=3 */}
            <link
              rel="apple-touch-startup-image"
              href="/1242x2688.png"
              media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1242x2688.png"
              media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
            />

            {/* iPhone 12 / 13 / 14 – 1170×2532, DPR=3 */}
            <link
              rel="apple-touch-startup-image"
              href="/1170x2532.png"
              media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1170x2532.png"
              media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
            />

            {/* iPhone 12/13/14 Pro Max & 14 Plus – 1284×2778, DPR=3 */}
            <link
              rel="apple-touch-startup-image"
              href="/1284x2778.png"
              media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1284x2778.png"
              media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
            />

            {/* iPad Mini – 1536×2048, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/1536x2048.png"
              media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1536x2048.png"
              media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />

            {/* iPad Air / Pro 9.7 – 1668×2224, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/1668x2224.png"
              media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1668x2224.png"
              media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />

            {/* iPad Pro 11″ – 1668×2388, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/1668x2388.png"
              media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/1668x2388.png"
              media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />

            {/* iPad Pro 12.9″ – 2048×2732, DPR=2 */}
            <link
              rel="apple-touch-startup-image"
              href="/2048x2732.png"
              media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
            />
            <link
              rel="apple-touch-startup-image"
              href="/2048x2732.png"
              media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
            />
          </head>
          <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
            <MuteProvider>
              <SettingsProvider initialSettings={settings}>
                <div className="min-h-screen bg-white ">
                  {/* Use the shell to conditionally show nav/banner/footer */}
                  <LayoutShell>{children}</LayoutShell>
                </div>
                <ToastContainer position="top-center" theme="colored" />
              </SettingsProvider>
            </MuteProvider>
          </body>
        </html>
      </AuthProvider>
    </ReactQueryProvider>
  );
}
