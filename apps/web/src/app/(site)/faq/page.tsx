import type { Metadata } from 'next';
import { faqJsonLd } from '@modverse/shared';
import { PageShell } from '@/components/layout/PageShell';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { buildMetadata, jsonLdScript } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'MOD APK FAQ — Installation, Safety & Troubleshooting',
  description:
    'Answers to the most common MOD APK questions: is it safe, do I need root, why does installation fail, can I play online, and how updates work.',
  path: '/faq',
  keywords: ['mod apk faq', 'is mod apk safe', 'apk not installed fix', 'mod apk root required'],
});

const FAQS = [
  { question: 'What exactly is a MOD APK?', answer: 'A MOD APK is a repackaged Android application. A modder decompiles the original game, changes specific values or code paths — currency, unlock flags, ad calls — then rebuilds and re-signs the package. The gameplay is the developer\u2019s; only the restrictions differ.' },
  { question: 'Are MOD APKs from MODVerse safe?', answer: 'Every file we publish is hashed, signature-inspected and scanned by multiple antivirus engines before the listing goes live. The SHA-256 and scan summary appear on each game page so you can verify the file you downloaded matches what we scanned. That said, no scan is infallible: install only from this site and keep Play Protect enabled.' },
  { question: 'Do I need to root my phone?', answer: 'No. Every mod in our library runs on stock, unrooted Android. You only need to allow installation from unknown sources for the app doing the install (your browser or file manager), which is a normal Android setting.' },
  { question: 'Why do I get "App not installed" or a parse error?', answer: 'Ninety percent of the time an existing copy signed with a different key is already installed \u2014 uninstall the Play Store version first. The remaining causes are: insufficient storage, a partially downloaded file (re-download), or an APK built for a different CPU architecture than your device.' },
  { question: 'What is an OBB file and where does it go?', answer: 'Large games ship their assets separately from the APK in an OBB expansion file. Extract the provided OBB folder to Android/obb/ on internal storage so the path reads Android/obb/com.example.game/. Install the APK first, then place the OBB, then launch.' },
  { question: 'Can I play modded games online or in ranked modes?', answer: 'Offline and single-player content works fully. Online competitive modes often run server-side anti-cheat that detects modified clients, which can result in a ban. If you intend to play online, use a secondary account you are willing to lose.' },
  { question: 'Will the mod break when the game updates?', answer: 'Usually yes \u2014 a new official build invalidates the previous patch. Our agent monitors upstream sources and refreshes each listing when a new modded version is released, so returning to the same page gets you the current build.' },
  { question: 'Do I need an account to download?', answer: 'No. MODVerse has no public user registration at all. There are no surveys, no link shorteners and no paywalls \u2014 the countdown on the download page exists only to finish verifying the file.' },
  { question: 'How do I request a game?', answer: 'Send the Play Store link through the contact page. Requests feed into the agent\u2019s recommendation queue, which prioritises by demand and upstream availability.' },
  { question: 'Does MODVerse host the APK files?', answer: 'No. Files are transferred directly to third-party cloud storage (Mega) via remote upload and served from there. We index and verify; we do not operate the file hosting.' },
];

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQS)!) }} />
      <PageShell
        title="Frequently Asked Questions"
        intro="Everything about installing, verifying and troubleshooting MOD APK files on Android."
        crumbs={[{ name: 'FAQ', path: '/faq' }]}
      >
        <FaqAccordion items={FAQS} />
      </PageShell>
    </>
  );
}
