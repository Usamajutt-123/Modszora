'use client';

import { useState } from 'react';
import { Check, Facebook, Link2, MessageCircle, Send, Share2, Twitter } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ShareButtons({ url, title, className }: { url: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const targets = [
    { label: 'Twitter', icon: Twitter, href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
    { label: 'WhatsApp', icon: MessageCircle, href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      void copy();
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-faint">Share</span>

      {targets.map(({ label, icon: Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={`Share on ${label}`}
          title={`Share on ${label}`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2 text-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand"
        >
          <Icon className="h-3.5 w-3.5" />
        </a>
      ))}

      <button
        type="button"
        onClick={copy}
        aria-label="Copy link"
        title="Copy link"
        className={cn(
          'grid h-8 w-8 place-items-center rounded-lg border transition-all duration-200 hover:-translate-y-0.5',
          copied ? 'border-success/50 bg-success/10 text-success' : 'border-line bg-surface-2 text-muted hover:border-brand/50 hover:text-brand',
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      </button>

      <button
        type="button"
        onClick={nativeShare}
        aria-label="Share"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2 text-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand sm:hidden"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
