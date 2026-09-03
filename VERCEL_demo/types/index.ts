export type MemoryMode = 'provider' | 'middleware' | 'tools' | 'hooks' | 'off';

export type MemoryTab = 'recent' | 'observations' | 'insights' | 'entities' | 'reasoning';

export interface MemoryHit {
  content: string;
  label: string;
}

export interface MemorySnapshot {
  counts: Record<MemoryTab, number>;
  items: Record<MemoryTab, MemoryHit[]>;

  loading?: boolean;

  error?: string;
}
