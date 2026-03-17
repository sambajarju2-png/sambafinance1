'use client';

import { useEffect } from 'react';

export default function DarkModeProvider({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);
  return <>{children}</>;
}
