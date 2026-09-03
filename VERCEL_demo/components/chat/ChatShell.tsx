'use client';

import { useEffect, useState } from 'react';

import AppHeader from '@/components/AppHeader';
import ChatComponent from '@/components/chat/ChatComponent';
import type { MemoryMode } from '@/types';

const THEME_KEY = 'nams-chat-theme';

interface ChatShellProps {
  mode: MemoryMode;
  sessionId?: string;
}

export default function ChatShell({ mode, sessionId }: ChatShellProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') setIsDarkMode(stored === 'dark');

    const query = window.matchMedia('(max-width: 640px)');
    setIsMobile(query.matches);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((wasDark) => {
      window.localStorage.setItem(THEME_KEY, wasDark ? 'light' : 'dark');
      return !wasDark;
    });
  };

  return (
    <div
      className={`n-bg-neutral-bg-default ${isDarkMode ? 'ndl-theme-dark' : 'ndl-theme-light'}`}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <AppHeader
        mode={mode}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onNewChat={() => window.location.assign('/s')}
        isMobile={isMobile}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <ChatComponent mode={mode} sessionId={sessionId} />
      </div>
    </div>
  );
}
