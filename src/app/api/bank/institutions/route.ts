import { NextResponse } from 'next/server'
import { listBanks } from '@/lib/enablebanking'

// Map Dutch bank names to their domains for Logo.dev
const BANK_DOMAINS: Record<string, string> = {
  'ING': 'ing.nl',
  'Rabobank': 'rabobank.nl',
  'ABN AMRO': 'abnamro.nl',
  'SNS': 'snsbank.nl',
  'ASN Bank': 'asnbank.nl',
  'RegioBank': 'regiobank.nl',
  'Triodos Bank': 'triodos.nl',
  'Bunq': 'bunq.com',
  'Knab': 'knab.nl',
  'Revolut': 'revolut.com',
  'N26': 'n26.com',
  'Handelsbanken': 'handelsbanken.nl',
  'Van Lanschot': 'vanlanschot.nl',
  'BNG Bank': 'bngbank.nl',
  'NIBC': 'nibc.nl',
  'de Volksbank': 'devolksbank.nl',
}

function getBankLogo(name: string): string {
  const domain = BANK_DOMAINS[name]
  if (domain) {
    return `https://img.logo.dev/${domain}?token=pk_RLZzD1KxRrCpEywuCrIRRw&size=64&format=png`
  }
  // Fallback: try the bank name as domain
  const guessed = name.toLowerCase().replace(/\s+/g, '') + '.nl'
  return `https://img.logo.dev/${guessed}?token=pk_RLZzD1KxRrCpEywuCrIRRw&size=64&format=png`
}

// Cache for 24 hours
let cache: { data: unknown[]; at: number } | null = null

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 86400000) {
      return NextResponse.json(cache.data)
    }

    const banks = await listBanks('NL')

    // Sort: major Dutch banks first
    const priority = ['ING', 'Rabobank', 'ABN AMRO', 'SNS', 'ASN Bank', 'Triodos', 'Bunq', 'Knab', 'Revolut', 'N26']
    const sorted = banks
      .filter(b => b.psu_types?.includes('personal'))  // only show banks with personal accounts
      .sort((a, b) => {
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
      logo: getBankLogo(b.name)
    }))

    cache = { data: result, at: Date.now() }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Bank] Failed to fetch banks:', error)
    return NextResponse.json({ error: 'Kon banken niet ophalen' }, { status: 500 })
  }
}
