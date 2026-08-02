import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Sign In — MODVerse',
  robots: { index: false, follow: false, nocache: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
