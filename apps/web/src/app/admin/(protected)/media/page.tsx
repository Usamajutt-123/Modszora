import type { Metadata } from 'next';
import { FolderOpen } from 'lucide-react';
import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { isDemoMode } from '@/lib/env';

export const metadata: Metadata = { title: 'Media Library' };
export const dynamic = 'force-dynamic';

export default function AdminMediaPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
          <FolderOpen className="h-6 w-6 text-brand" />
          Media Library
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every image in storage — search, preview, replace or delete. Uploads are converted to WebP and resized
          automatically.
        </p>
      </header>
      <MediaLibrary demoMode={isDemoMode()} />
    </div>
  );
}
