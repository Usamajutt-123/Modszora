import type { Metadata } from 'next';
import { AlertTriangle, Bug, Gamepad2, Mail, Scale } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Contact MODSzora — Support & Requests',
  description: 'Get in touch with MODSzora for game requests, broken links, bug reports, DMCA notices and partnership enquiries.',
  path: '/contact',
  keywords: ['contact modszora', 'mod apk support', 'request a game', 'report broken link'],
});

const CHANNELS = [
  { icon: Gamepad2, title: 'Game requests', body: 'Send the Play Store link and we will queue it for the ingestion agent.', to: 'requests@modszora.app' },
  { icon: Bug, title: 'Broken download or bug', body: 'Include the game name, your Android version and what happened.', to: 'support@modszora.app' },
  { icon: Scale, title: 'DMCA / takedown', body: 'Rights holders should follow the formal process on our DMCA page.', to: 'legal@modszora.app' },
  { icon: Mail, title: 'Everything else', body: 'Partnerships, press and general enquiries.', to: 'hello@modszora.app' },
];

export default function ContactPage() {
  return (
    <PageShell
      title="Contact"
      intro="We read everything. Pick the right channel below and you will get a faster, more useful answer."
      crumbs={[{ name: 'Contact', path: '/contact' }]}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CHANNELS.map(({ icon: Icon, title, body, to }) => (
          <div key={title} className="card p-5">
            <Icon className="h-6 w-6 text-brand" />
            <h2 className="mt-3 font-display text-base font-bold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            <a href={`mailto:${to}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:text-accent">
              {to}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-warning/30 bg-warning/[0.07] p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-warning">
          <AlertTriangle className="h-4 w-4" />
          Before you email about an install failure
        </h2>
        <p className="mt-2 text-sm text-muted">
          Most failures are a signature conflict. Uninstall the Play Store copy of the game first, then reinstall the MOD APK.
          Our <a href="/faq" className="modverse-inline-link">FAQ</a> covers the other common causes.
        </p>
      </div>
    </PageShell>
  );
}
