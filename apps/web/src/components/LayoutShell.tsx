// components/LayoutShell.tsx
'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navigation } from '@/components/navigation';
import { CountdownBanner } from '@/components/countdown-banner';
import { useSettings } from '@/lib/settings-context';
import { useCountdown } from '@/hooks/use-countdown';
import { useAuth } from '@/hooks/use-auth';

// lazy-load footer on client; don't include it in SSR bundle
const Footer = dynamic(() => import('@/components/footer/Footer'), {
  ssr: false,
  loading: () => null, // show nothing while footer loads
});

export default function LayoutShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { show } = useCountdown(settings?.discountValidUntil);
  const pathname = usePathname() || '';

  const hideLayout = pathname.includes('/chat') || pathname.includes('/free-groups');
  const hideNave = (pathname.includes('/chat') || pathname.includes('/free-groups')) && isAuthenticated;

  return (
    <>
      {!hideLayout && <CountdownBanner />}
      {!hideLayout && show && <div className="h-[55px] md:h-[85px]" />}
      {!hideNave && <Navigation />}

      {/* main content */}
      {children}

      {/* footer is lazy loaded — will not be part of SSR bundle */}
      {!hideLayout && <Footer />}
    </>
  );
}
