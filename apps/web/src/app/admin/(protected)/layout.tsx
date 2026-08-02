import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAdminSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: { default: 'Admin — MODVerse', template: '%s — MODVerse Admin' },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * Guards every authenticated admin route.
 *
 * Middleware already blocks unauthenticated requests at the edge; this second
 * check enforces the email allowlist, which middleware cannot do cheaply.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
