import type { Metadata } from 'next';
import { GameEditor } from '@/components/admin/GameEditor';

export const metadata: Metadata = { title: 'Manual Game Upload' };
export const dynamic = 'force-dynamic';

/** Manual game upload â€” the hand-entry counterpart to the AI agent. */
export default function ManualGameUploadPage() {
    return <GameEditor />;
}