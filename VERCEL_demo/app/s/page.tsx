import ChatShell from '@/components/chat/ChatShell';
import { currentMemoryMode } from '@/lib/mode';

export default function NewSessionPage() {
  return <ChatShell mode={currentMemoryMode()} />;
}
