import ChatShell from '@/components/chat/ChatShell';
import { currentMemoryMode } from '@/lib/mode';

export default function Page() {
  return <ChatShell mode={currentMemoryMode()} />;
}
