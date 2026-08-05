import type { Metadata } from 'next';
import { Bot, Database, Shield, Zap } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Prose } from '@/components/ui';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'About MODSzora — How the Platform Works',
  description:
    'MODSzora is an automated MOD APK library. Learn how our ingestion agent discovers games, verifies files, and keeps thousands of listings current.',
  path: '/about',
  keywords: ['about modszora', 'mod apk platform', 'how modszora works'],
});

const PILLARS = [
  { icon: Bot, title: 'Autonomous ingestion', body: 'An AI agent monitors eight upstream MOD APK sources continuously, detects new releases and version bumps, and publishes updates without creating duplicate pages.' },
  { icon: Shield, title: 'Verified before publish', body: 'Every APK is hashed, signature-inspected and scanned by multiple antivirus engines. The SHA-256 and scan result are printed on each game page.' },
  { icon: Database, title: 'Structured data first', body: 'Each listing is a typed record — version, package, size, requirements, mod features — so search, filtering and schema.org markup are always accurate.' },
  { icon: Zap, title: 'Built for speed', body: 'Static rendering with incremental regeneration, AVIF/WebP images and aggressive caching keep pages fast on slow mobile connections.' },
];

export default function AboutPage() {
  return (
    <PageShell
      title="About MODSzora"
      intro="MODSzora is a modded Android game library that runs itself. Instead of a team manually copying listings, an autonomous agent researches, verifies, writes and publishes."
      crumbs={[{ name: 'About', path: '/about' }]}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card p-5">
            <Icon className="h-6 w-6 text-brand" />
            <h2 className="mt-3 font-display text-base font-bold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>

      <Prose
        className="mt-10"
        html={`
<h2>Why we built it</h2>
<p>MOD APK sites are notorious for stale listings, misleading version numbers and download buttons that lead anywhere but the file. Most of the problem is manual labour: keeping thousands of games current is more work than a small team can do by hand, so listings rot.</p>
<p>MODSzora solves that structurally. The ingestion agent treats every game as a record with a content fingerprint. When an upstream source changes, the agent compares fingerprints and updates the existing listing in place rather than publishing a near-duplicate. That single decision keeps the catalogue clean and the SEO healthy.</p>

<h2>How a game gets published</h2>
<ol>
  <li>The agent crawls its configured sources on a schedule, respecting robots.txt and rate limits.</li>
  <li>Candidate pages are parsed into a strict schema — anything that fails validation is rejected rather than guessed.</li>
  <li>Icons, banners and screenshots are downloaded, compressed, converted to WebP and uploaded to object storage.</li>
  <li>The APK is transferred to Mega using a remote upload service, so the file never touches our servers.</li>
  <li>An LLM generates the SEO bundle, descriptions, FAQs and internal links from the verified facts.</li>
  <li>The listing is published through the same authenticated API a human admin would use.</li>
</ol>

<h2>What we do not do</h2>
<p>MODSzora does not host copyrighted binaries on its own infrastructure, does not require an account to download, and does not gate files behind surveys or link shorteners. If a rights holder wants a listing removed, our <a href="/dmca">DMCA page</a> explains the process and we act on valid notices quickly.</p>

<h2>Contact</h2>
<p>Questions, corrections or takedown requests belong on the <a href="/contact">contact page</a>. For install problems, the <a href="/faq">FAQ</a> covers the common failures first.</p>
`}
      />
    </PageShell>
  );
}
