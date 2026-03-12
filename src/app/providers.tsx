'use client'
import { useEffect } from 'react'
import { AuthProvider } from '@/lib/auth-context'
export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])
  return <AuthProvider>{children}</AuthProvider>
}
