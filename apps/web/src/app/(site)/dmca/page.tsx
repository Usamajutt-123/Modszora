import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { Prose } from '@/components/ui';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'DMCA & Takedown Policy — MODVerse',
  description: 'How rights holders can request removal of content from MODVerse, and what a valid notice must contain.',
  path: '/dmca',
});

export default function DmcaPage() {
  return (
    <PageShell
      title="DMCA & Takedown Policy"
      intro="MODVerse respects intellectual property rights and responds promptly to valid removal requests."
      crumbs={[{ name: 'DMCA', path: '/dmca' }]}
    >
      <Prose html={`
<h2>Our position</h2>
<p>MODVerse operates as an index. We do not host application binaries on our own infrastructure; listings point to files stored with third-party providers. Where we control a listing, we can remove it. Where a file resides with another host, we will remove our listing and direct you to that host for deletion of the underlying file.</p>

<h2>Submitting a notice</h2>
<p>Send your notice to <strong>legal@modverse.app</strong> with the subject line "DMCA Takedown Request". To be actionable under 17 U.S.C. § 512(c)(3), it must include all of the following:</p>
<ol>
  <li>A physical or electronic signature of the copyright owner, or a person authorised to act on their behalf.</li>
  <li>Identification of the copyrighted work claimed to have been infringed.</li>
  <li>The exact URL or URLs on this site of the material you want removed — a general reference to the site is not sufficient.</li>
  <li>Your contact information: full name, mailing address, telephone number and email address.</li>
  <li>A statement that you have a good faith belief that the disputed use is not authorised by the copyright owner, its agent, or the law.</li>
  <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on their behalf.</li>
</ol>

<h2>What happens next</h2>
<ul>
  <li>We acknowledge receipt, normally within two business days.</li>
  <li>Valid notices result in removal or disabling of the identified listing, typically within 72 hours.</li>
  <li>The listing is recorded so our ingestion agent does not automatically republish the same content.</li>
</ul>

<h2>Counter-notice</h2>
<p>If you believe material was removed in error you may submit a counter-notice to the same address, including your contact details, identification of the removed material and its former location, a statement under penalty of perjury that removal resulted from mistake or misidentification, and consent to the jurisdiction of the appropriate federal court.</p>

<h2>Repeat infringers</h2>
<p>Sources that repeatedly supply infringing material are removed from the ingestion agent's allowlist.</p>

<h2>Good faith</h2>
<p>Knowingly making a material misrepresentation in a takedown notice may result in liability for damages under 17 U.S.C. § 512(f).</p>
`} />
    </PageShell>
  );
}
