'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DbBill } from '@/lib/types'

interface UseBillsReturn {
  bills: DbBill[]
  paidBills: DbBill[]
  loading: boolean
  error: string | null
  seeded: boolean
  refetch: () => Promise<void>
  markPaid: (id: string) => Promise<void>
  bulkMarkPaid: (ids: string[]) => Promise<void>
  updateBill: (id: string, updates: Partial<DbBill>) => Promise<void>
  seed: () => Promise<void>
}

export function useBills(accessToken: string | null): UseBillsReturn {
  const [bills, setBills] = useState<DbBill[]>([])
  const [paidBills, setPaidBills] = useState<DbBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)

  const authHeaders = useCallback(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }, [accessToken])

  const fetchBills = useCallback(async () => {
    if (!accessToken) { setLoading(false); return }
    try {
      setError(null)

      const headers = authHeaders()
      const [openRes, paidRes] = await Promise.all([
        fetch('/api/bills?status=outstanding', { headers }),
        fetch('/api/bills?status=settled', { headers }),
      ])

      if (!openRes.ok || !paidRes.ok) {
        const errBody = await (openRes.ok ? paidRes : openRes).json()
        throw new Error(errBody.error || 'Failed to fetch bills')
      }

      const openData = await openRes.json()
      const paidData = await paidRes.json()

      setBills(openData.data)
      setPaidBills(paidData.data)

      // If no bills at all, might need seeding
      if (openData.data.length === 0 && paidData.data.length === 0) {
        setSeeded(false)
      } else {
        setSeeded(true)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, authHeaders])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  const markPaid = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'settled' }),
      })

      if (!res.ok) {
        const errBody = await res.json()
        throw new Error(errBody.error || 'Failed to mark as paid')
      }

      const { data: updated } = await res.json()

      // Move from open to paid list
      setBills((prev) => prev.filter((b) => b.id !== id))
      setPaidBills((prev) => [updated, ...prev])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    }
  }, [authHeaders])

  const bulkMarkPaid = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/bills/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status: 'settled' }),
          })
        )
      )
      // Refetch to get clean state
      await fetchBills()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    }
  }, [fetchBills, authHeaders])

  const updateBill = useCallback(async (id: string, updates: Partial<DbBill>) => {
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const errBody = await res.json()
        throw new Error(errBody.error || 'Failed to update bill')
      }

      const { data: updated } = await res.json()

      // Update in the appropriate list
      if (updated.status === 'settled') {
        setBills((prev) => prev.filter((b) => b.id !== id))
        setPaidBills((prev) => {
          const existing = prev.findIndex((b) => b.id === id)
          if (existing >= 0) {
            const next = [...prev]
            next[existing] = updated
            return next
          }
          return [updated, ...prev]
        })
      } else {
        setBills((prev) => prev.map((b) => (b.id === id ? updated : b)))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    }
  }, [authHeaders])

  const seed = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/seed', { method: 'POST', headers: authHeaders() })
      if (!res.ok) {
        const errBody = await res.json()
        throw new Error(errBody.error || 'Seed failed')
      }
      setSeeded(true)
      await fetchBills()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [fetchBills, authHeaders])

  return {
    bills, paidBills, loading, error, seeded,
    refetch: fetchBills, markPaid, bulkMarkPaid, updateBill, seed,
  }
}
