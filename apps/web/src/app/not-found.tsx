import Link from 'next/link';
import { Gamepad2, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-6">
        <span className="font-display text-[8rem] font-extrabold leading-none text-gradient opacity-90">404</span>
        <Gamepad2 className="absolute -right-6 top-4 h-12 w-12 animate-float text-brand/40" />
      </div>
      <h1 className="text-2xl font-bold md:text-3xl">Game over — page not found</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        This page has been unpublished, moved, or never existed. Try the library or search for what you need.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary btn"><Home className="h-4 w-4" />Home</Link>
        <Link href="/browse" className="btn-secondary btn"><Gamepad2 className="h-4 w-4" />Browse Games</Link>
        <Link href="/search" className="btn-ghost btn"><Search className="h-4 w-4" />Search</Link>
      </div>
    </div>
  );
}
