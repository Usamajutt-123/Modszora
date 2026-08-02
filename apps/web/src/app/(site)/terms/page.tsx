import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { Prose } from '@/components/ui';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of Service — MODVerse',
  description: 'The terms governing your use of MODVerse, including acceptable use, disclaimers and intellectual property.',
  path: '/terms',
});

export default function TermsPage() {
  const updated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <PageShell title="Terms of Service" intro={`Last updated ${updated}.`} crumbs={[{ name: 'Terms of Service', path: '/terms' }]}>
      <Prose html={`
<h2>1. Acceptance</h2>
<p>By accessing MODVerse you agree to these terms. If you do not agree, do not use the site.</p>

<h2>2. Nature of the service</h2>
<p>MODVerse is an index and information service. We catalogue modified Android application packages, verify what we can, and link to files hosted by third parties. We are not the author of the games listed and we do not operate the file hosting.</p>

<h2>3. Intellectual property</h2>
<p>All game titles, logos, artwork and trademarks are the property of their respective owners. Their appearance here is nominative use for identification and commentary. MODVerse claims no ownership over any third-party work.</p>

<h2>4. Acceptable use</h2>
<ul>
  <li>Do not use the site to distribute malware or misrepresent files.</li>
  <li>Do not scrape at a rate that degrades service for others.</li>
  <li>Do not post comments that are unlawful, abusive, or contain malicious links.</li>
  <li>Do not attempt to access administrative interfaces or APIs you are not authorised to use.</li>
</ul>

<h2>5. Modified software disclaimer</h2>
<p>Modified applications are provided for testing, research and educational purposes. Installing a modified client may violate the end-user licence agreement of the original publisher and may result in suspension of your account with that publisher. You accept that risk entirely. Where you value a game, buy it.</p>

<h2>6. No warranty</h2>
<p>The service is provided "as is" without warranties of any kind. While every file we list is scanned before publication, we cannot guarantee that any third-party binary is free of defects or malicious code. Verify hashes and keep device protections enabled.</p>

<h2>7. Limitation of liability</h2>
<p>To the maximum extent permitted by law, MODVerse and its operators are not liable for any indirect, incidental or consequential damages arising from use of the site or of any file obtained through it, including device damage, data loss or account suspension.</p>

<h2>8. Third-party links</h2>
<p>Outbound links are provided for convenience. We do not control and are not responsible for third-party content, policies or practices.</p>

<h2>9. Takedowns</h2>
<p>Rights holders may request removal via our <a href="/dmca">DMCA page</a>. Valid notices are actioned promptly.</p>

<h2>10. Changes</h2>
<p>We may revise these terms. Continued use after a revision constitutes acceptance of the updated terms.</p>
`} />
    </PageShell>
  );
}
