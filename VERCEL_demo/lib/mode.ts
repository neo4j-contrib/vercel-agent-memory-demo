import type { MemoryMode } from '@/types';

export function currentMemoryMode(): MemoryMode {
  const raw = process.env.MEMORY_MODE?.trim().toLowerCase() || 'off';
  return raw === 'provider' ||
    raw === 'middleware' ||
    raw === 'tools' ||
    raw === 'hooks' ||
    raw === 'off'
    ? raw
    : 'off';
}
