import Script from 'next/script';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppJoinPrompt } from '@/components/marketing/WhatsAppJoinPrompt';
import { env } from '@/lib/env';

/**
 * Public site chrome.
 *
 * Lives in a route group so the admin area (and the admin login screen) can
 * render standalone without the marketing header, footer or ambient
 * background bleeding into it.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const socialBarSrc = env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC;

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern bg-grid-pattern opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand/15 blur-[130px]" />
        <div className="absolute -right-40 top-1/3 h-[460px] w-[460px] rounded-full bg-accent/12 blur-[130px]" />
      </div>
      <Header />
      <main id="main" className="relative">
        {children}
      </main>
      <Footer />

      {/* WhatsApp channel invite — floating bottom-corner prompt, client-side only */}
      <WhatsAppJoinPrompt />

      {/*
        Adsterra Social Bar — sticky bottom bar rendered by Adsterra itself.
        Mounted here (public route group only) so it loads once site-wide and
        never inside /admin. afterInteractive keeps it off the critical path;
        the stable id stops Strict Mode from injecting it twice. The script
        positions and styles itself — no wrapper or CSS for it.
      */}
      {socialBarSrc ? <Script id="adsterra-socialbar" src={socialBarSrc} strategy="afterInteractive" /> : null}
    </>
  );
}
