/**
 * Dutch Toeslagen Eligibility Calculator — 2026 thresholds
 * Based on Belastingdienst / Dienst Toeslagen official numbers.
 * All amounts in integer euro cents.
 */

// ── Zorgtoeslag 2026 ──
const ZORGTOESLAG = {
  max_alleenstaand: 12900,       // €129/maand
  max_partner: 24600,            // €246/maand
  inkomen_max_alleenstaand: 4085700,   // €40.857/jaar
  inkomen_max_partner: 5114200,        // €51.142/jaar
  vermogen_max_alleenstaand: 14601100, // €146.011
  vermogen_max_partner: 18463300,      // €184.633
};

// ── Huurtoeslag 2026 ──
const HUURTOESLAG = {
  rekenhuur_max_21plus: 93293,   // €932,93/maand (max huur voor berekening)
  rekenhuur_max_18_20: 49820,    // €498,20/maand
  inkomen_max_alleenstaand: 3169800,   // €31.698/jaar
  inkomen_max_meerpersoons: 4317000,   // €43.170/jaar
  vermogen_max_alleenstaand: 3847900,  // €38.479
  vermogen_max_partner: 7695800,       // €76.958
  min_leeftijd: 18,
};

// ── Kindgebonden Budget 2026 ──
const KINDGEBONDEN = {
  max_per_kind_onder_12: 21500,  // €215/maand (€2.580/jaar)
  max_per_kind_12_15: 27400,     // €274/maand (€3.283/jaar)
  max_per_kind_16_17: 29300,     // €293/maand (€3.516/jaar)
  alleenstaande_ouder_extra: 27700, // €277/maand (€3.320/jaar)
  inkomen_afbouw_alleenstaand: 2973600,  // €29.736/jaar
  inkomen_afbouw_partner: 3914100,       // €39.141/jaar
  vermogen_max_alleenstaand: 14601100,
  vermogen_max_partner: 18463300,
};

// ── Kinderopvangtoeslag 2026 ──
const KINDEROPVANG = {
  inkomen_96_pct: 5641300,  // €56.413 — 96% vergoed
};

export interface ToeslagResult {
  naam: string;
  eligible: boolean;
  reden: string;
  geschat_bedrag: number; // monthly estimate in cents
  actie: string; // what user should do
}

export interface ToeslagenOverview {
  zorgtoeslag: ToeslagResult;
  huurtoeslag: ToeslagResult;
  kindgebonden_budget: ToeslagResult;
  kinderopvangtoeslag: ToeslagResult;
  totaal_geschat: number; // total monthly in cents
}

interface ToeslagenInput {
  jaarinkomen: number;          // annual gross in cents (netto * 12 as proxy)
  has_partner: boolean;
  partner_jaarinkomen: number;  // partner annual in cents
  vermogen: number;             // total assets in cents
  monthly_rent: number;         // kale huur in cents
  num_children: number;
  children_ages: number[];      // array of ages
  has_kinderopvang: boolean;
  leeftijd?: number;            // user age (optional, defaults to 25)
}

/**
 * Convert monthly netto income to estimated annual toetsingsinkomen.
 * This is a rough proxy — real toetsingsinkomen = verzamelinkomen from tax.
 * We use netto * 12 * 1.35 as a rough bruto estimate for lower incomes.
 */
export function estimateJaarinkomen(nettoMaand: number): number {
  // Simple proxy: netto * 12 * ~1.33 (lower tax bracket approximation)
  return Math.round(nettoMaand * 12 * 1.33);
}

export function calculateToeslagen(input: ToeslagenInput): ToeslagenOverview {
  const gezamenlijk = input.jaarinkomen + input.partner_jaarinkomen;
  const leeftijd = input.leeftijd ?? 25;

  // ── Zorgtoeslag ──
  const zorgtoeslag = calculateZorgtoeslag(input, gezamenlijk);

  // ── Huurtoeslag ──
  const huurtoeslag = calculateHuurtoeslag(input, gezamenlijk, leeftijd);

  // ── Kindgebonden Budget ──
  const kindgebonden = calculateKindgebonden(input, gezamenlijk);

  // ── Kinderopvangtoeslag ──
  const kinderopvang = calculateKinderopvang(input, gezamenlijk);

  const totaal = [zorgtoeslag, huurtoeslag, kindgebonden, kinderopvang]
    .filter(t => t.eligible)
    .reduce((sum, t) => sum + t.geschat_bedrag, 0);

  return {
    zorgtoeslag,
    huurtoeslag,
    kindgebonden_budget: kindgebonden,
    kinderopvangtoeslag: kinderopvang,
    totaal_geschat: totaal,
  };
}

function calculateZorgtoeslag(input: ToeslagenInput, gezamenlijk: number): ToeslagResult {
  const base: ToeslagResult = {
    naam: 'Zorgtoeslag',
    eligible: false,
    reden: '',
    geschat_bedrag: 0,
    actie: 'Aanvragen via toeslagen.nl',
  };

  // Vermogen check
  const vermogenMax = input.has_partner
    ? ZORGTOESLAG.vermogen_max_partner
    : ZORGTOESLAG.vermogen_max_alleenstaand;
  if (input.vermogen > vermogenMax) {
    base.reden = 'Vermogen te hoog';
    return base;
  }

  // Income check
  const inkomenMax = input.has_partner
    ? ZORGTOESLAG.inkomen_max_partner
    : ZORGTOESLAG.inkomen_max_alleenstaand;

  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;
  if (toetsinkomen > inkomenMax) {
    base.reden = 'Inkomen te hoog';
    return base;
  }

  // Eligible — estimate amount (linear interpolation)
  const maxBedrag = input.has_partner
    ? ZORGTOESLAG.max_partner
    : ZORGTOESLAG.max_alleenstaand;

  const ratio = 1 - (toetsinkomen / inkomenMax);
  const geschat = Math.round(maxBedrag * Math.max(0, Math.min(1, ratio)));

  base.eligible = true;
  base.geschat_bedrag = Math.max(geschat, 100); // minimum €1
  base.reden = 'Je komt waarschijnlijk in aanmerking';
  return base;
}

function calculateHuurtoeslag(input: ToeslagenInput, gezamenlijk: number, leeftijd: number): ToeslagResult {
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

  // Vermogen check
  const vermogenMax = input.has_partner
    ? HUURTOESLAG.vermogen_max_partner
    : HUURTOESLAG.vermogen_max_alleenstaand;
  if (input.vermogen > vermogenMax) {
    base.reden = 'Vermogen te hoog';
    return base;
  }

  // Income check
  const inkomenMax = (input.has_partner || input.num_children > 0)
    ? HUURTOESLAG.inkomen_max_meerpersoons
    : HUURTOESLAG.inkomen_max_alleenstaand;

  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;
  if (toetsinkomen > inkomenMax) {
    base.reden = 'Inkomen te hoog';
    return base;
  }

  // Eligible — rough estimate based on rent and income
  const rekenhuur = leeftijd < 21
    ? Math.min(input.monthly_rent, HUURTOESLAG.rekenhuur_max_18_20)
    : Math.min(input.monthly_rent, HUURTOESLAG.rekenhuur_max_21plus);

  const ratio = 1 - (toetsinkomen / inkomenMax);
  const geschat = Math.round(rekenhuur * 0.5 * Math.max(0, Math.min(1, ratio)));

  base.eligible = true;
  base.geschat_bedrag = Math.max(geschat, 500); // minimum €5
  base.reden = 'Je komt waarschijnlijk in aanmerking';
  return base;
}

function calculateKindgebonden(input: ToeslagenInput, gezamenlijk: number): ToeslagResult {
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

  // Check if any children under 18
  const minderjarig = input.children_ages.filter(a => a < 18);
  if (minderjarig.length === 0) {
    base.reden = 'Geen kinderen onder 18';
    return base;
  }

  // Vermogen check
  const vermogenMax = input.has_partner
    ? KINDGEBONDEN.vermogen_max_partner
    : KINDGEBONDEN.vermogen_max_alleenstaand;
  if (input.vermogen > vermogenMax) {
    base.reden = 'Vermogen te hoog';
    return base;
  }

  // Calculate max amount per child
  let maxMaandelijks = 0;
  for (const age of minderjarig) {
    if (age < 12) maxMaandelijks += KINDGEBONDEN.max_per_kind_onder_12;
    else if (age < 16) maxMaandelijks += KINDGEBONDEN.max_per_kind_12_15;
    else maxMaandelijks += KINDGEBONDEN.max_per_kind_16_17;
  }

  // Alleenstaande ouder bonus
  if (!input.has_partner) {
    maxMaandelijks += KINDGEBONDEN.alleenstaande_ouder_extra;
  }

  // Income-based reduction
  const afbouwgrens = input.has_partner
    ? KINDGEBONDEN.inkomen_afbouw_partner
    : KINDGEBONDEN.inkomen_afbouw_alleenstaand;

  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;
  if (toetsinkomen <= afbouwgrens) {
    base.eligible = true;
    base.geschat_bedrag = maxMaandelijks;
    base.reden = 'Je komt in aanmerking voor het maximale bedrag';
    return base;
  }

  // Afbouw: roughly 6.75% per year above threshold
  const boven = toetsinkomen - afbouwgrens;
  const afbouw = Math.round((boven * 0.0675) / 12);
  const geschat = Math.max(0, maxMaandelijks - afbouw);

  if (geschat > 0) {
    base.eligible = true;
    base.geschat_bedrag = geschat;
    base.reden = 'Je komt waarschijnlijk in aanmerking';
  } else {
    base.reden = 'Inkomen te hoog';
  }

  return base;
}

function calculateKinderopvang(input: ToeslagenInput, gezamenlijk: number): ToeslagResult {
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

  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;

  base.eligible = true;
  if (toetsinkomen <= KINDEROPVANG.inkomen_96_pct) {
    base.reden = 'Tot 96% van de opvangkosten vergoed';
    base.geschat_bedrag = 0; // depends on actual opvang hours — can't estimate
    base.actie = 'Aanvragen via toeslagen.nl — bereken exact bedrag daar';
  } else {
    base.reden = 'Gedeeltelijke vergoeding mogelijk';
    base.actie = 'Maak een proefberekening op toeslagen.nl';
  }

  return base;
}

/**
 * Helper: calculate monthly amount normalized from any interval
 */
export function normalizeToMonthly(amount: number, interval: string): number {
  switch (interval) {
    case 'weekly': return Math.round(amount * 52 / 12);
    case 'monthly': return amount;
    case 'quarterly': return Math.round(amount / 3);
    case 'yearly': return Math.round(amount / 12);
    default: return amount;
  }
}
