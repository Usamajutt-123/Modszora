import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Gamepad2, ShieldAlert } from 'lucide-react';
import { LoginForm } from '@/components/admin/LoginForm';
import { hasSupabase } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Admin Sign In — MODVerse',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  const configured = hasSupabase();

  return (
    <div className="grid min-h-[85dvh] place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-grad-brand shadow-glow">
            <Gamepad2 className="h-7 w-7 text-white" strokeWidth={2.4} />
          </span>
          <h1 className="font-display text-2xl font-extrabold">
            MOD<span className="text-gradient">Verse</span> Admin
          </h1>
          <p className="mt-1.5 text-sm text-muted">Authorised operators only. There is no public registration.</p>
        </div>

        {configured ? (
          <div className="card p-6">
            <Suspense fallback={<div className="skeleton h-56 w-full rounded-xl" />}>
              <LoginForm />
            </Suspense>
          </div>
        ) : (
          <div className="card border-warning/40 bg-warning/[0.06] p-6">
            <ShieldAlert className="h-7 w-7 text-warning" />
            <h2 className="mt-3 font-display text-lg font-bold text-warning">Authentication not configured</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Supabase credentials are missing, so the admin area cannot verify anyone. Set the following in your
              environment, then restart:
            </p>
            <ul className="mt-3 space-y-1 font-mono text-2xs text-muted">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              <li>SUPABASE_SERVICE_ROLE_KEY</li>
              <li>ADMIN_EMAILS</li>
            </ul>
            <p className="mt-3 text-2xs text-faint">
              The public site continues to work in demo mode with bundled fixture data.
            </p>
          </div>
        )}

        <p className="mt-5 text-center text-2xs text-faint">
          Protected by Supabase Auth · rate limited · session cookies are httpOnly
        </p>
      </div>
    </div>
  );
}
