import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { calculateWIKCosts } from '@/lib/wik';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/voice/wik-check
 * Checks whether claimed incasso costs exceed WIK maximums.
 * Called by the check_wik client tool from the voice agent.
 *
 * Body: { bill_amount: number (euros), claimed_costs: number (euros), vendor?: string }
 * Returns: { overcharged, max_allowed, claimed, overpaid, bill_amount, summary }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();

    const billAmountEuros = parseFloat(String(body.bill_amount || 0).replace(',', '.'));
    const claimedCostsEuros = parseFloat(String(body.claimed_costs || 0).replace(',', '.'));
    const vendor = String(body.vendor || 'het incassobureau').trim();

    if (billAmountEuros <= 0) {
      return NextResponse.json({ error: 'bill_amount is verplicht en moet groter dan 0 zijn' }, { status: 400, headers: NO_CACHE });
    }

    const billAmountCents = Math.round(billAmountEuros * 100);
    const claimedCostsCents = Math.round(claimedCostsEuros * 100);
    const maxAllowedCents = calculateWIKCosts(billAmountCents);
    const maxAllowedEuros = maxAllowedCents / 100;
    const overcharged = claimedCostsCents > maxAllowedCents;
    const overpaidCents = Math.max(0, claimedCostsCents - maxAllowedCents);
    const overpaidEuros = overpaidCents / 100;

    let summary: string;

    if (claimedCostsEuros <= 0) {
      // User only asked what the max is, no claimed costs provided
      summary = `Bij een rekening van €${billAmountEuros.toFixed(2)} mag ${vendor} maximaal €${maxAllowedEuros.toFixed(2)} aan incassokosten rekenen volgens de WIK.`;
    } else if (overcharged) {
      summary = `Let op! ${vendor} rekent €${claimedCostsEuros.toFixed(2)} aan incassokosten, maar wettelijk mag dat maximaal €${maxAllowedEuros.toFixed(2)} zijn bij een rekening van €${billAmountEuros.toFixed(2)}. Dat is €${overpaidEuros.toFixed(2)} teveel. Je kunt hiertegen bezwaar maken.`;
    } else {
      summary = `De incassokosten van €${claimedCostsEuros.toFixed(2)} van ${vendor} vallen binnen het wettelijk maximum van €${maxAllowedEuros.toFixed(2)}. Dit klopt dus.`;
    }

    return NextResponse.json({
      overcharged,
      max_allowed: maxAllowedEuros,
      claimed: claimedCostsEuros,
      overpaid: overpaidEuros,
      bill_amount: billAmountEuros,
      vendor,
      summary,
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('WIK check error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
