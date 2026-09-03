import ChatShell from '@/components/chat/ChatShell';
import { currentMemoryMode } from '@/lib/mode';

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatShell mode={currentMemoryMode()} sessionId={sessionId} />;
}
