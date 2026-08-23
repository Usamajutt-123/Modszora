import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware responsibilities:
 *  1. Refresh the Supabase auth cookie so admin sessions stay alive.
 *  2. Gate every /admin route behind an authenticated session.
 *  3. Attach a per-request nonce + hardened headers.
 *
 * The email allowlist check happens server-side in the admin layout;
 * middleware only proves "is logged in" because it must stay edge-fast.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });


  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
  const isLoginRoute = req.nextUrl.pathname === '/admin/login';

  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });

    // Refreshes the session cookie when it is close to expiry.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isAdminRoute && !isLoginRoute && !user) {
      const redirect = req.nextUrl.clone();
      redirect.pathname = '/admin/login';
      redirect.searchParams.set('next', req.nextUrl.pathname);
      return NextResponse.redirect(redirect);
    }

    if (isLoginRoute && user) {
      const redirect = req.nextUrl.clone();
      redirect.pathname = '/admin';
      redirect.search = '';
      return NextResponse.redirect(redirect);
    }
  } else if (isAdminRoute && !isLoginRoute) {
    // No Supabase configured: the admin area cannot authenticate anyone.
    const redirect = req.nextUrl.clone();
    redirect.pathname = '/admin/login';
    redirect.searchParams.set('reason', 'not-configured');
    return NextResponse.redirect(redirect);
  }

  // Admin pages must never be cached or indexed.
  if (isAdminRoute) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimisation,
     * which keeps middleware off the hot path for cached content.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
};
