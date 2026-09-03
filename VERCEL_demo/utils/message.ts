import type { EveDynamicToolPart, EveMessage, EveMessagePart } from 'eve/react';
import type { MemorySnapshot } from '@/types';

export function getMsgText(msg: EveMessage): string {
  return msg.parts
    .filter((p): p is Extract<EveMessagePart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function lastUserText(messages: readonly EveMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      const text = getMsgText(messages[i]);
      if (text) return text;
    }
  }
  return '';
}

export function toolParts(parts: readonly EveMessagePart[]): EveDynamicToolPart[] {
  return parts.filter((p): p is EveDynamicToolPart => p.type === 'dynamic-tool');
}

export function isMemoryTool(toolName: string): boolean {
  return toolName.toLowerCase().includes('memory');
}

export function toolStateLabel(part: EveDynamicToolPart): string {
  switch (part.state) {
    case 'input-streaming':
    case 'input-available':
      return 'running…';
    case 'approval-requested':
      return 'waiting for approval';
    case 'approval-responded':
      return part.approval.approved === true
        ? 'approved'
        : part.approval.approved === false
          ? 'denied'
          : 'approval received';
    case 'output-available':
      return part.partial ? 'streaming…' : 'done';
    case 'output-error':
      return 'failed';
    case 'output-denied':
      return 'denied';
    default:
      return '';
  }
}

export function toolOutputText(part: EveDynamicToolPart): string | null {
  if (part.state === 'output-error') return part.errorText;
  if (part.state !== 'output-available') return null;
  const out = part.output;
  if (out == null) return null;
  return typeof out === 'string' ? out : (JSON.stringify(out, null, 2) ?? String(out));
}

export function emptySnapshot(): MemorySnapshot {
  return {
    counts: { recent: 0, observations: 0, insights: 0, entities: 0, reasoning: 0 },
    items: { recent: [], observations: [], insights: [], entities: [], reasoning: [] },
  };
}

export function formatErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (error) return String(error);
  return null;
}
