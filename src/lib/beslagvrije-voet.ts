/**
 * Beslagvrije Voet Calculator — 2026 parameters
 * Based on the VTLB (Vrij Te Laten Bedrag) formula from Recofa/NVVK guidelines.
 *
 * The beslagvrije voet is the minimum income a debtor is legally allowed to keep
 * after wage garnishment by a deurwaarder (bailiff).
 *
 * Formula: BVV = (90% × bijstandsnorm) + woonkostencorrectie + zorgpremiecorrectie - toeslagen
 *
 * All amounts in euro cents.
 */

// ─── 2026 Bijstandsnormen (per maand, in cents) ─────────────────────────────
// These are net amounts including holiday allowance (vakantiegeld)
const BIJSTANDSNORM_2026 = {
  alleenstaand: 125600,       // ~€1,256/month
  alleenstaand_ouder: 125600, // Same base, but may get more via toeslagen
  samenwonend: 179400,        // ~€1,794/month (for couple together)
};

// ─── Fixed parameters ───────────────────────────────────────────────────────
const BVV_PARAMS = {
  bvvPercentage: 0.90,        // 90% of bijstandsnorm
  normpremieZorg: 17500,      // €175/month norm health insurance premium
  basishuurNorm: 25286,       // €252.86/month basishuur (own housing contribution)
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BvvInput {
  huishoudType: 'alleenstaand' | 'alleenstaand_ouder' | 'samenwonend';
  huurCents: number;           // monthly rent in cents
  zorgpremieCents: number;     // monthly health insurance premium in cents
  toeslagenCents: number;      // total monthly toeslagen received in cents
  nettoloonCents: number;      // net monthly salary in cents (for comparison)
}

export interface BvvResult {
  bijstandsnorm: number;       // applicable bijstandsnorm (cents)
  basisBvv: number;            // 90% of bijstandsnorm (cents)
  woonCorrectie: number;       // housing cost correction (cents)
  zorgCorrectie: number;       // health insurance correction (cents)
  toeslagenAftrek: number;     // toeslagen deduction (cents)
  beslagvrijeVoet: number;     // final BVV amount (cents)
  maxBeslag: number;           // maximum that can be garnished (cents)
  verschil: number;            // difference: nettoloon - bvv (cents)
  isOnderBvv: boolean;         // true if income is below BVV (illegal garnishment)
}

// ─── Calculator ─────────────────────────────────────────────────────────────

export function calculateBeslagvrijeVoet(input: BvvInput): BvvResult {
  // Step 1: Get applicable bijstandsnorm
  const bijstandsnorm = BIJSTANDSNORM_2026[input.huishoudType];

  // Step 2: Calculate base BVV (90% of bijstandsnorm)
  const basisBvv = Math.round(bijstandsnorm * BVV_PARAMS.bvvPercentage);

  // Step 3: Housing cost correction
  // If rent > basishuur norm, the excess is added to BVV
  const woonCorrectie = Math.max(0, input.huurCents - BVV_PARAMS.basishuurNorm);

  // Step 4: Health insurance correction
  // If premium > norm premium, the excess is added to BVV
  const zorgCorrectie = Math.max(0, input.zorgpremieCents - BVV_PARAMS.normpremieZorg);

  // Step 5: Subtract toeslagen (these are income the debtor keeps)
  const toeslagenAftrek = input.toeslagenCents;

  // Step 6: Final BVV
  const beslagvrijeVoet = Math.max(0, basisBvv + woonCorrectie + zorgCorrectie - toeslagenAftrek);

  // Step 7: Maximum garnishment amount
  const maxBeslag = Math.max(0, input.nettoloonCents - beslagvrijeVoet);

  // Step 8: Check if income is below BVV
  const isOnderBvv = input.nettoloonCents < beslagvrijeVoet;

  return {
    bijstandsnorm,
    basisBvv,
    woonCorrectie,
    zorgCorrectie,
    toeslagenAftrek,
    beslagvrijeVoet,
    maxBeslag,
    verschil: input.nettoloonCents - beslagvrijeVoet,
    isOnderBvv,
  };
}

// ─── Letter generator ───────────────────────────────────────────────────────

export function generateBvvCorrectionLetter(
  result: BvvResult,
  userName: string,
  deurwaarderNaam: string,
): string {
  const bvv = (result.beslagvrijeVoet / 100).toFixed(2).replace('.', ',');
  const datum = new Date().toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `${datum}

Betreft: Verzoek tot herberekening beslagvrije voet

Geachte heer/mevrouw ${deurwaarderNaam},

Hierbij verzoek ik u om de beslagvrije voet te herberekenen conform artikel 475d van het Wetboek van Burgerlijke Rechtsvordering.

Op basis van mijn huidige situatie heb ik de beslagvrije voet berekend op €${bvv} per maand. Dit bedrag is opgebouwd uit:
- 90% van de bijstandsnorm: €${(result.basisBvv / 100).toFixed(2).replace('.', ',')}
- Woonkostencorrectie: €${(result.woonCorrectie / 100).toFixed(2).replace('.', ',')}
- Zorgpremiecorrectie: €${(result.zorgCorrectie / 100).toFixed(2).replace('.', ',')}
- Af: ontvangen toeslagen: €${(result.toeslagenAftrek / 100).toFixed(2).replace('.', ',')}

Ik verzoek u vriendelijk om de beslagvrije voet dienovereenkomstig aan te passen en het teveel ingehouden bedrag terug te storten.

Ik verwacht uw reactie binnen 14 dagen na dagtekening van deze brief.

Met vriendelijke groet,

${userName}`;
}
