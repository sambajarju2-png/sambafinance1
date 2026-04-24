import { NextResponse } from 'next/server'
import { listBanks } from '@/lib/enablebanking'

// Cache banks for 24 hours
let cache: { data: unknown[]; at: number } | null = null

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 86400000) {
      return NextResponse.json(cache.data)
    }

    const banks = await listBanks('NL')

    // Sort: major Dutch banks first
    const priority = ['ING', 'Rabobank', 'ABN AMRO', 'SNS', 'ASN Bank', 'Triodos', 'Bunq', 'Knab', 'Revolut', 'N26']
    const sorted = banks.sort((a, b) => {
      const aIdx = priority.findIndex(n => a.name.toLowerCase().includes(n.toLowerCase()))
      const bIdx = priority.findIndex(n => b.name.toLowerCase().includes(n.toLowerCase()))
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    const result = sorted.map(b => ({
      id: b.name,
      name: b.name,
      country: b.country,
      logo: b.logo || null
    }))

    cache = { data: result, at: Date.now() }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Bank] Failed to fetch banks:', error)
    return NextResponse.json({ error: 'Kon banken niet ophalen' }, { status: 500 })
  }
}
