import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { Prose } from '@/components/ui';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy — MODSzora',
  description: 'How MODSzora collects, uses and protects your data. We run no user accounts and collect the minimum necessary.',
  path: '/privacy',
});

export default function PrivacyPage() {
  const updated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <PageShell title="Privacy Policy" intro={`Last updated ${updated}.`} crumbs={[{ name: 'Privacy Policy', path: '/privacy' }]}>
      <Prose html={`
<h2>Summary</h2>
<p>MODSzora has no public user registration. We do not ask you to create an account, and we do not sell personal data. The sections below describe exactly what is collected and why.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Anonymous usage events.</strong> When you view a game page or click a download button we record the event, the page slug, an approximate country from your request headers, and whether the device is mobile or desktop. These records are not linked to an identity.</li>
  <li><strong>Comments.</strong> If you post a comment we store the display name and text you submit. Your IP address is stored only as a salted one-way hash, used for rate limiting and spam prevention. Supplying an email address is optional.</li>
  <li><strong>Newsletter.</strong> If you subscribe we store your email address for the purpose of sending the digest. Unsubscribing removes it.</li>
  <li><strong>Server logs.</strong> Standard request logs are retained briefly for security and debugging.</li>
</ul>

<h2>What we do not collect</h2>
<p>No accounts, no passwords, no payment details, no precise location, no contact lists, no device identifiers, and no cross-site advertising profiles built by us.</p>

<h2>Cookies</h2>
<p>The site sets one preference value in your browser's local storage to remember your light/dark theme choice. Authentication cookies exist only for administrators. If advertising is enabled, the ad provider may set its own cookies, governed by their policy.</p>

<h2>Third parties</h2>
<ul>
  <li><strong>Hosting and database.</strong> Infrastructure providers process requests on our behalf under their own data protection terms.</li>
  <li><strong>File storage.</strong> Downloads are served by third-party cloud storage. Following a download link means that provider sees the request.</li>
  <li><strong>Analytics.</strong> If a privacy-respecting analytics tool is enabled, it is configured to anonymise IP addresses.</li>
</ul>

<h2>Data retention</h2>
<p>Anonymous usage events are retained in aggregate. Comment records persist until removed by moderation or on request. Newsletter addresses persist until you unsubscribe.</p>

<h2>Your rights</h2>
<p>You may request deletion of any comment or newsletter subscription associated with you by emailing the address on our <a href="/contact">contact page</a>. Because we hold no accounts, most data on this site cannot be traced back to an individual.</p>

<h2>Children</h2>
<p>This site is not directed at children under 13 and we do not knowingly collect their data.</p>

<h2>Changes</h2>
<p>Material changes to this policy will be reflected in the "last updated" date above.</p>
`} />
    </PageShell>
  );
}
