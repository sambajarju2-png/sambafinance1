import { NextResponse } from 'next/server'
import { listInstitutions } from '@/lib/gocardless'

// Cache institutions for 24 hours (they rarely change)
let cachedInstitutions: { data: unknown[]; cachedAt: number } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  try {
    // Return cached if fresh
    if (cachedInstitutions && Date.now() - cachedInstitutions.cachedAt < CACHE_TTL) {
      return NextResponse.json(cachedInstitutions.data)
    }

    const institutions = await listInstitutions('NL')

    // Sort by name, put major Dutch banks first
    const majorBanks = ['ING', 'Rabobank', 'ABN AMRO', 'SNS', 'ASN Bank', 'Triodos', 'Bunq', 'Knab', 'Revolut', 'N26']
    const sorted = institutions.sort((a, b) => {
      const aIdx = majorBanks.findIndex(name => a.name.toLowerCase().includes(name.toLowerCase()))
      const bIdx = majorBanks.findIndex(name => b.name.toLowerCase().includes(name.toLowerCase()))
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    // Simplify response
    const simplified = sorted.map(inst => ({
      id: inst.id,
      name: inst.name,
      logo: inst.logo,
      max_history_days: inst.transaction_total_days
    }))

    cachedInstitutions = { data: simplified, cachedAt: Date.now() }

    return NextResponse.json(simplified)
  } catch (error) {
    console.error('[Bank] Failed to fetch institutions:', error)
    return NextResponse.json({ error: 'Kon banken niet ophalen' }, { status: 500 })
  }
}
