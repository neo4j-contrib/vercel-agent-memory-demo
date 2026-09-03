import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@neo4j-ndl/base/lib/neo4j-ds-styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'eve + Neo4j Agent Memory',
  description: 'A workshop agent that remembers you, backed by a Neo4j graph.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
