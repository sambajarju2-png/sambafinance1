/**
 * Dutch Toeslagen Eligibility Calculator — 2026 thresholds
 * Based on Belastingdienst / Dienst Toeslagen official numbers.
 * All amounts in integer euro cents.
 *
 * Sources:
 * - Belastingdienst proefberekening parameters 2026
 * - Rijksoverheid toeslagen tabellen 2026
 *
 * DISCLAIMER: These are estimates. Users should always verify
 * via the official proefberekening at toeslagen.nl
 */

// ─── Zorgtoeslag 2026 — Official stepped table ──────────────────────────────
// Amounts in euros (converted to cents at calculation time)
// Belastingdienst publishes these as stepped tables, not a single formula

interface IncomeStep {
  inkomen: number; // upper bound toetsingsinkomen (euros)
  maand: number;   // monthly amount (euros)
}

const ZORGTOESLAG_TABLE_ALLEENSTAAND: IncomeStep[] = [
  { inkomen: 29500, maand: 129 },
  { inkomen: 30000, maand: 126 },
  { inkomen: 30500, maand: 120 },
  { inkomen: 31000, maand: 114 },
  { inkomen: 31500, maand: 109 },
  { inkomen: 32000, maand: 103 },
  { inkomen: 32500, maand: 97 },
  { inkomen: 33000, maand: 91 },
  { inkomen: 33500, maand: 86 },
  { inkomen: 34000, maand: 80 },
  { inkomen: 34500, maand: 74 },
  { inkomen: 35000, maand: 69 },
  { inkomen: 35500, maand: 63 },
  { inkomen: 36000, maand: 57 },
  { inkomen: 36500, maand: 51 },
  { inkomen: 37000, maand: 46 },
  { inkomen: 37500, maand: 40 },
  { inkomen: 38000, maand: 34 },
  { inkomen: 38500, maand: 28 },
  { inkomen: 39000, maand: 23 },
  { inkomen: 39500, maand: 17 },
  { inkomen: 40000, maand: 11 },
  { inkomen: 40500, maand: 6 },
  { inkomen: 40857, maand: 0 },
];

const ZORGTOESLAG_TABLE_PARTNER: IncomeStep[] = [
  { inkomen: 29500, maand: 246 },
  { inkomen: 30000, maand: 243 },
  { inkomen: 30500, maand: 238 },
  { inkomen: 31000, maand: 232 },
  { inkomen: 31500, maand: 226 },
  { inkomen: 32000, maand: 221 },
  { inkomen: 32500, maand: 215 },
  { inkomen: 33000, maand: 209 },
  { inkomen: 33500, maand: 203 },
  { inkomen: 34000, maand: 198 },
  { inkomen: 34500, maand: 192 },
  { inkomen: 35000, maand: 186 },
  { inkomen: 35500, maand: 180 },
  { inkomen: 36000, maand: 175 },
  { inkomen: 36500, maand: 169 },
  { inkomen: 37000, maand: 163 },
  { inkomen: 37500, maand: 157 },
  { inkomen: 38000, maand: 152 },
  { inkomen: 38500, maand: 146 },
  { inkomen: 39000, maand: 140 },
  { inkomen: 39500, maand: 134 },
  { inkomen: 40000, maand: 129 },
  { inkomen: 40500, maand: 123 },
  { inkomen: 41000, maand: 117 },
  { inkomen: 41500, maand: 111 },
  { inkomen: 42000, maand: 106 },
  { inkomen: 42500, maand: 100 },
  { inkomen: 43000, maand: 94 },
  { inkomen: 43500, maand: 88 },
  { inkomen: 44000, maand: 83 },
  { inkomen: 44500, maand: 77 },
  { inkomen: 45000, maand: 71 },
  { inkomen: 45500, maand: 65 },
  { inkomen: 46000, maand: 60 },
  { inkomen: 46500, maand: 54 },
  { inkomen: 47000, maand: 48 },
  { inkomen: 47500, maand: 42 },
  { inkomen: 48000, maand: 37 },
  { inkomen: 48500, maand: 31 },
  { inkomen: 49000, maand: 25 },
  { inkomen: 49500, maand: 19 },
  { inkomen: 50000, maand: 14 },
  { inkomen: 50500, maand: 8 },
  { inkomen: 51000, maand: 2 },
  { inkomen: 51142, maand: 0 },
];

// ─── Zorgtoeslag constants ──────────────────────────────────────────────────
const ZORGTOESLAG = {
  max_alleenstaand_maand: 129,
  max_partner_maand: 246,
  inkomen_max_alleenstaand: 40857,
  inkomen_max_partner: 51142,
  vermogen_max_alleenstaand: 146011,
  vermogen_max_partner: 184633,
};

// ─── Huurtoeslag 2026 parameters ────────────────────────────────────────────
const HUURTOESLAG = {
  kwaliteitskortingsgrens: 49820,
  aftoppingsgrens_laag: 71302,
  aftoppingsgrens_hoog: 76414,
  maximale_huur_21plus: 93293,
  maximale_huur_jongeren: 49820,
  basishuur_approx: 20100,
  min_leeftijd: 18,
  min_inkomen_alleenstaand: 23425,
  min_inkomen_meerpersoons: 31500,
  inkomen_max_alleenstaand: 31698,
  inkomen_max_meerpersoons: 43170,
  vermogen_max_alleenstaand: 38479,
  vermogen_max_partner: 76958,
};

// ─── Kindgebonden Budget 2026 parameters ────────────────────────────────────
const KINDGEBONDEN = {
  alleenstaand_1kind: 5996,
  alleenstaand_2kinderen: 8576,
  partner_1kind: 2580,
  partner_2kinderen: 5160,
  extra_per_kind_vanaf_3: 2580,
  verhoging_12_15: 724,
  verhoging_16_17: 964,
  inkomen_max_alleenstaand: 29736,
  inkomen_max_partner: 39141,
  afbouw_percentage: 0.076,
  vermogen_max_alleenstaand: 146011,
  vermogen_max_partner: 184633,
};

// ─── Kinderopvangtoeslag 2026 parameters ────────────────────────────────────
const KINDEROPVANG = {
  max_uur_dagopvang: 11.23,
  max_uur_bso: 9.98,
  max_uur_gastouder: 8.49,
  inkomen_96_pct: 56413,
};

// ─── Types (unchanged interface for backward compatibility) ─────────────────

export interface ToeslagResult {
  naam: string;
  eligible: boolean;
  reden: string;
  geschat_bedrag: number;
  actie: string;
}

export interface ToeslagenOverview {
  zorgtoeslag: ToeslagResult;
  huurtoeslag: ToeslagResult;
  kindgebonden_budget: ToeslagResult;
  kinderopvangtoeslag: ToeslagResult;
  totaal_geschat: number;
}

interface ToeslagenInput {
  jaarinkomen: number;
  has_partner: boolean;
  partner_jaarinkomen: number;
  vermogen: number;
  monthly_rent: number;
  num_children: number;
  children_ages: number[];
  has_kinderopvang: boolean;
  leeftijd?: number;
}

// ─── Netto → Toetsingsinkomen estimation (stepped 2026 tax brackets) ────────

export function estimateJaarinkomen(nettoMaandCents: number): number {
  const nettoJaar = (nettoMaandCents / 100) * 12;

  let brutoJaar: number;
  if (nettoJaar <= 22500) {
    brutoJaar = nettoJaar * 1.11;
  } else if (nettoJaar <= 28000) {
    brutoJaar = nettoJaar * 1.25;
  } else if (nettoJaar <= 36500) {
    brutoJaar = nettoJaar * 1.37;
  } else {
    brutoJaar = nettoJaar * 1.56;
  }

  return Math.round(brutoJaar * 100);
}

// ─── Lookup + interpolation helper ──────────────────────────────────────────

function lookupStepped(table: IncomeStep[], toetsingsinkomenEuros: number): number {
  if (toetsingsinkomenEuros <= table[0].inkomen) {
    return table[0].maand;
  }
  if (toetsingsinkomenEuros >= table[table.length - 1].inkomen) {
    return 0;
  }
  for (let i = 0; i < table.length - 1; i++) {
    if (toetsingsinkomenEuros > table[i].inkomen && toetsingsinkomenEuros <= table[i + 1].inkomen) {
      const prev = table[i];
      const next = table[i + 1];
      const ratio = (toetsingsinkomenEuros - prev.inkomen) / (next.inkomen - prev.inkomen);
      const interpolated = prev.maand - ratio * (prev.maand - next.maand);
      return Math.round(interpolated);
    }
  }
  return 0;
}

// ─── Main calculator ────────────────────────────────────────────────────────

export function calculateToeslagen(input: ToeslagenInput): ToeslagenOverview {
  const gezamenlijk = input.jaarinkomen + input.partner_jaarinkomen;
  const leeftijd = input.leeftijd ?? 25;

  const zorgtoeslag = calcZorgtoeslag(input, gezamenlijk);
  const huurtoeslag = calcHuurtoeslag(input, gezamenlijk, leeftijd);
  const kindgebonden = calcKindgebonden(input, gezamenlijk);
  const kinderopvang = calcKinderopvang(input, gezamenlijk);

  const totaal = [zorgtoeslag, huurtoeslag, kindgebonden, kinderopvang]
    .filter(t => t.eligible)
    .reduce((sum, t) => sum + t.geschat_bedrag, 0);

  return { zorgtoeslag, huurtoeslag, kindgebonden_budget: kindgebonden, kinderopvangtoeslag: kinderopvang, totaal_geschat: totaal };
}

// ─── Zorgtoeslag (2026 — stepped table + interpolation) ─────────────────────

function calcZorgtoeslag(input: ToeslagenInput, gezamenlijkCents: number): ToeslagResult {
  const base: ToeslagResult = {
    naam: 'Zorgtoeslag',
    eligible: false,
    reden: '',
    geschat_bedrag: 0,
    actie: 'Aanvragen via toeslagen.nl',
  };

  const vermogenEuros = input.vermogen / 100;
  const toetsinkomenCents = input.has_partner ? gezamenlijkCents : input.jaarinkomen;
  const toetsinkomenEuros = toetsinkomenCents / 100;

  const vermogenMax = input.has_partner
    ? ZORGTOESLAG.vermogen_max_partner
    : ZORGTOESLAG.vermogen_max_alleenstaand;
  if (vermogenEuros > vermogenMax) {
    base.reden = 'Vermogen te hoog';
    return base;
  }

  const inkomenMax = input.has_partner
    ? ZORGTOESLAG.inkomen_max_partner
    : ZORGTOESLAG.inkomen_max_alleenstaand;
  if (toetsinkomenEuros > inkomenMax) {
    base.reden = 'Inkomen te hoog';
    return base;
  }

  const table = input.has_partner
    ? ZORGTOESLAG_TABLE_PARTNER
    : ZORGTOESLAG_TABLE_ALLEENSTAAND;
  const maandEuros = lookupStepped(table, toetsinkomenEuros);

  if (maandEuros > 0) {
    base.eligible = true;
    base.geschat_bedrag = Math.round(maandEuros * 100);
    base.reden = toetsinkomenEuros <= 29500
      ? 'Je komt in aanmerking voor het maximale bedrag'
      : 'Je komt waarschijnlijk in aanmerking';
  } else {
    base.reden = 'Inkomen te hoog voor zorgtoeslag';
  }

  return base;
}

// ─── Huurtoeslag (2026 — tiered reimbursement with basishuur) ────────────────

function calcHuurtoeslag(input: ToeslagenInput, gezamenlijkCents: number, leeftijd: number): ToeslagResult {
  const base: ToeslagResult = {
    naam: 'Huurtoeslag',
    eligible: false,
    reden: '',
    geschat_bedrag: 0,
    actie: 'Aanvragen via toeslagen.nl',
  };

  if (leeftijd < HUURTOESLAG.min_leeftijd) {
    base.reden = 'Je moet minimaal 18 jaar zijn';
    return base;
  }

  if (input.monthly_rent <= 0) {
    base.reden = 'Geen huur opgegeven';
    return base;
  }

  const vermogenEuros = input.vermogen / 100;
  const toetsinkomenCents = input.has_partner ? gezamenlijkCents : input.jaarinkomen;
  const toetsinkomenEuros = toetsinkomenCents / 100;

  const vermogenMax = input.has_partner
    ? HUURTOESLAG.vermogen_max_partner
    : HUURTOESLAG.vermogen_max_alleenstaand;
  if (vermogenEuros > vermogenMax) {
    base.reden = 'Vermogen te hoog';
    return base;
  }

  const inkomenMax = (input.has_partner || input.num_children > 0)
    ? HUURTOESLAG.inkomen_max_meerpersoons
    : HUURTOESLAG.inkomen_max_alleenstaand;
  if (toetsinkomenEuros > inkomenMax) {
    base.reden = 'Inkomen te hoog';
    return base;
  }

  const huishoudenGrootte = 1 + (input.has_partner ? 1 : 0) + input.num_children;
  const allUnder21 = leeftijd < 21;

  const maxHuur = allUnder21 ? HUURTOESLAG.maximale_huur_jongeren : HUURTOESLAG.maximale_huur_21plus;
  const rekenhuur = Math.min(input.monthly_rent, maxHuur);

  const basishuur = HUURTOESLAG.basishuur_approx;

  if (rekenhuur <= basishuur) {
    base.reden = 'Huur lager dan de basishuur (eigen bijdrage)';
    return base;
  }

  const kwaliteitsgrens = HUURTOESLAG.kwaliteitskortingsgrens;
  const aftoppingsgrens = huishoudenGrootte >= 3
    ? HUURTOESLAG.aftoppingsgrens_hoog
    : HUURTOESLAG.aftoppingsgrens_laag;

  let toeslag = 0;

  // Tier 1: 100% between basishuur and kwaliteitskortingsgrens
  const tier1Top = Math.min(rekenhuur, kwaliteitsgrens);
  if (tier1Top > basishuur) {
    toeslag += (tier1Top - basishuur);
  }

  // Tier 2: 65% between kwaliteitskortingsgrens and aftoppingsgrens
  if (rekenhuur > kwaliteitsgrens) {
    const tier2Top = Math.min(rekenhuur, aftoppingsgrens);
    const tier2Amount = tier2Top - kwaliteitsgrens;
    if (tier2Amount > 0) {
      toeslag += Math.round(tier2Amount * 0.65);
    }
  }

  // Tier 3: 40% between aftoppingsgrens and maximale huur
  if (rekenhuur > aftoppingsgrens) {
    const tier3Amount = rekenhuur - aftoppingsgrens;
    toeslag += Math.round(tier3Amount * 0.40);
  }

  // Income-based reduction
  const minInkomen = huishoudenGrootte === 1
    ? HUURTOESLAG.min_inkomen_alleenstaand
    : HUURTOESLAG.min_inkomen_meerpersoons;

  if (toetsinkomenEuros > minInkomen) {
    const excess = toetsinkomenEuros - minInkomen;
    const maxExcess = inkomenMax - minInkomen;
    const reductionFactor = Math.min(excess / maxExcess, 1);
    toeslag = Math.round(toeslag * (1 - reductionFactor));
  }

  if (toeslag > 0) {
    base.eligible = true;
    base.geschat_bedrag = toeslag;
    base.reden = 'Je komt waarschijnlijk in aanmerking';
  } else {
    base.reden = 'Berekend bedrag is €0 bij dit inkomen';
  }

  return base;
}

// ─── Kindgebonden Budget (2026 — cumulative base + 7.60% afbouw) ─────────────

function calcKindgebonden(input: ToeslagenInput, gezamenlijkCents: number): ToeslagResult {
  const base: ToeslagResult = {
    naam: 'Kindgebonden budget',
    eligible: false,
    reden: '',
    geschat_bedrag: 0,
    actie: 'Aanvragen via toeslagen.nl',
  };

  if (input.num_children === 0 || input.children_ages.length === 0) {
    base.reden = 'Geen kinderen onder 18';
    return base;
  }

  const minderjarig = input.children_ages.filter(a => a < 18);
  if (minderjarig.length === 0) {
    base.reden = 'Geen kinderen onder 18';
    return base;
  }

  const vermogenEuros = input.vermogen / 100;
  const toetsinkomenCents = input.has_partner ? gezamenlijkCents : input.jaarinkomen;
  const toetsinkomenEuros = toetsinkomenCents / 100;
  const alleenstaand = !input.has_partner;

  const vermogenMax = alleenstaand
    ? KINDGEBONDEN.vermogen_max_alleenstaand
    : KINDGEBONDEN.vermogen_max_partner;
  if (vermogenEuros > vermogenMax) {
    base.reden = 'Vermogen te hoog';
    return base;
  }

  // Step 1: Calculate base maximum (annual, euros)
  let maxBaseJaar: number;

  if (alleenstaand) {
    if (minderjarig.length === 1) {
      maxBaseJaar = KINDGEBONDEN.alleenstaand_1kind;
    } else {
      maxBaseJaar = KINDGEBONDEN.alleenstaand_2kinderen;
    }
  } else {
    if (minderjarig.length === 1) {
      maxBaseJaar = KINDGEBONDEN.partner_1kind;
    } else {
      maxBaseJaar = KINDGEBONDEN.partner_2kinderen;
    }
  }

  if (minderjarig.length >= 3) {
    maxBaseJaar += (minderjarig.length - 2) * KINDGEBONDEN.extra_per_kind_vanaf_3;
  }

  // Step 2: Add age supplements
  let ageSupplement = 0;
  for (const age of minderjarig) {
    if (age >= 12 && age <= 15) {
      ageSupplement += KINDGEBONDEN.verhoging_12_15;
    } else if (age >= 16 && age <= 17) {
      ageSupplement += KINDGEBONDEN.verhoging_16_17;
    }
  }

  let maxAmountJaar = maxBaseJaar + ageSupplement;

  // Step 3: Apply income-based afbouw (7.60%)
  const threshold = alleenstaand
    ? KINDGEBONDEN.inkomen_max_alleenstaand
    : KINDGEBONDEN.inkomen_max_partner;

  if (toetsinkomenEuros > threshold) {
    const excess = toetsinkomenEuros - threshold;
    const reduction = excess * KINDGEBONDEN.afbouw_percentage;
    maxAmountJaar = Math.max(0, maxAmountJaar - reduction);
  }

  const maandelijksCents = Math.round((maxAmountJaar / 12) * 100);

  if (maandelijksCents > 0) {
    base.eligible = true;
    base.geschat_bedrag = maandelijksCents;
    base.reden = toetsinkomenEuros <= threshold
      ? 'Je komt in aanmerking voor het maximale bedrag'
      : 'Je komt waarschijnlijk in aanmerking';
  } else {
    base.reden = 'Inkomen te hoog';
  }

  return base;
}

// ─── Kinderopvangtoeslag (2026 — eligibility + direction) ────────────────────

function calcKinderopvang(input: ToeslagenInput, gezamenlijkCents: number): ToeslagResult {
  const base: ToeslagResult = {
    naam: 'Kinderopvangtoeslag',
    eligible: false,
    reden: '',
    geschat_bedrag: 0,
    actie: 'Aanvragen via toeslagen.nl',
  };

  if (!input.has_kinderopvang) {
    base.reden = 'Geen kinderopvang opgegeven';
    return base;
  }

  if (input.num_children === 0) {
    base.reden = 'Geen kinderen';
    return base;
  }

  const toetsinkomenEuros = (input.has_partner ? gezamenlijkCents : input.jaarinkomen) / 100;

  base.eligible = true;
  if (toetsinkomenEuros <= KINDEROPVANG.inkomen_96_pct) {
    base.reden = 'Tot 96% van de opvangkosten vergoed';
    base.actie = 'Aanvragen via toeslagen.nl — bereken exact bedrag daar';
  } else {
    base.reden = 'Gedeeltelijke vergoeding mogelijk';
    base.actie = 'Maak een proefberekening op toeslagen.nl';
  }

  return base;
}

// ─── Interval normalization (unchanged) ──────────────────────────────────────

export function normalizeToMonthly(amount: number, interval: string): number {
  switch (interval) {
    case 'weekly': return Math.round(amount * 52 / 12);
    case 'monthly': return amount;
    case 'quarterly': return Math.round(amount / 3);
    case 'yearly': return Math.round(amount / 12);
    default: return amount;
  }
}
