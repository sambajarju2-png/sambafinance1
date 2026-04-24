/**
 * Dutch Toeslagen Eligibility Calculator — 2026 thresholds
 * Based on Belastingdienst / Dienst Toeslagen official numbers.
 * All amounts in integer euro cents.
 */

const ZORGTOESLAG = {
  max_alleenstaand: 12900,
  max_partner: 24600,
  inkomen_max_alleenstaand: 4085700,
  inkomen_max_partner: 5114200,
  vermogen_max_alleenstaand: 14601100,
  vermogen_max_partner: 18463300,
};

const HUURTOESLAG = {
  rekenhuur_max_21plus: 93293,
  rekenhuur_max_18_20: 49820,
  inkomen_max_alleenstaand: 3169800,
  inkomen_max_meerpersoons: 4317000,
  vermogen_max_alleenstaand: 3847900,
  vermogen_max_partner: 7695800,
  min_leeftijd: 18,
};

const KINDGEBONDEN = {
  max_per_kind_onder_12: 21500,
  max_per_kind_12_15: 27400,
  max_per_kind_16_17: 29300,
  alleenstaande_ouder_extra: 27700,
  inkomen_afbouw_alleenstaand: 2973600,
  inkomen_afbouw_partner: 3914100,
  vermogen_max_alleenstaand: 14601100,
  vermogen_max_partner: 18463300,
};

const KINDEROPVANG = {
  inkomen_96_pct: 5641300,
};

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

export function estimateJaarinkomen(nettoMaand: number): number {
  return Math.round(nettoMaand * 12 * 1.33);
}

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

function calcZorgtoeslag(input: ToeslagenInput, gezamenlijk: number): ToeslagResult {
  const base: ToeslagResult = { naam: 'Zorgtoeslag', eligible: false, reden: '', geschat_bedrag: 0, actie: 'Aanvragen via toeslagen.nl' };

  const vermogenMax = input.has_partner ? ZORGTOESLAG.vermogen_max_partner : ZORGTOESLAG.vermogen_max_alleenstaand;
  if (input.vermogen > vermogenMax) { base.reden = 'Vermogen te hoog'; return base; }

  const inkomenMax = input.has_partner ? ZORGTOESLAG.inkomen_max_partner : ZORGTOESLAG.inkomen_max_alleenstaand;
  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;
  if (toetsinkomen > inkomenMax) { base.reden = 'Inkomen te hoog'; return base; }

  const maxBedrag = input.has_partner ? ZORGTOESLAG.max_partner : ZORGTOESLAG.max_alleenstaand;
  const ratio = 1 - (toetsinkomen / inkomenMax);
  base.eligible = true;
  base.geschat_bedrag = Math.max(Math.round(maxBedrag * Math.max(0, Math.min(1, ratio))), 100);
  base.reden = 'Je komt waarschijnlijk in aanmerking';
  return base;
}

function calcHuurtoeslag(input: ToeslagenInput, gezamenlijk: number, leeftijd: number): ToeslagResult {
  const base: ToeslagResult = { naam: 'Huurtoeslag', eligible: false, reden: '', geschat_bedrag: 0, actie: 'Aanvragen via toeslagen.nl' };

  if (leeftijd < HUURTOESLAG.min_leeftijd) { base.reden = 'Je moet minimaal 18 jaar zijn'; return base; }
  if (input.monthly_rent <= 0) { base.reden = 'Geen huur opgegeven'; return base; }

  const vermogenMax = input.has_partner ? HUURTOESLAG.vermogen_max_partner : HUURTOESLAG.vermogen_max_alleenstaand;
  if (input.vermogen > vermogenMax) { base.reden = 'Vermogen te hoog'; return base; }

  const inkomenMax = (input.has_partner || input.num_children > 0) ? HUURTOESLAG.inkomen_max_meerpersoons : HUURTOESLAG.inkomen_max_alleenstaand;
  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;
  if (toetsinkomen > inkomenMax) { base.reden = 'Inkomen te hoog'; return base; }

  const rekenhuur = leeftijd < 21
    ? Math.min(input.monthly_rent, HUURTOESLAG.rekenhuur_max_18_20)
    : Math.min(input.monthly_rent, HUURTOESLAG.rekenhuur_max_21plus);

  const ratio = 1 - (toetsinkomen / inkomenMax);
  base.eligible = true;
  base.geschat_bedrag = Math.max(Math.round(rekenhuur * 0.5 * Math.max(0, Math.min(1, ratio))), 500);
  base.reden = 'Je komt waarschijnlijk in aanmerking';
  return base;
}

function calcKindgebonden(input: ToeslagenInput, gezamenlijk: number): ToeslagResult {
  const base: ToeslagResult = { naam: 'Kindgebonden budget', eligible: false, reden: '', geschat_bedrag: 0, actie: 'Aanvragen via toeslagen.nl' };

  if (input.num_children === 0 || input.children_ages.length === 0) { base.reden = 'Geen kinderen onder 18'; return base; }

  const minderjarig = input.children_ages.filter(a => a < 18);
  if (minderjarig.length === 0) { base.reden = 'Geen kinderen onder 18'; return base; }

  const vermogenMax = input.has_partner ? KINDGEBONDEN.vermogen_max_partner : KINDGEBONDEN.vermogen_max_alleenstaand;
  if (input.vermogen > vermogenMax) { base.reden = 'Vermogen te hoog'; return base; }

  let maxMaandelijks = 0;
  for (const age of minderjarig) {
    if (age < 12) maxMaandelijks += KINDGEBONDEN.max_per_kind_onder_12;
    else if (age < 16) maxMaandelijks += KINDGEBONDEN.max_per_kind_12_15;
    else maxMaandelijks += KINDGEBONDEN.max_per_kind_16_17;
  }

  if (!input.has_partner) maxMaandelijks += KINDGEBONDEN.alleenstaande_ouder_extra;

  const afbouwgrens = input.has_partner ? KINDGEBONDEN.inkomen_afbouw_partner : KINDGEBONDEN.inkomen_afbouw_alleenstaand;
  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;

  if (toetsinkomen <= afbouwgrens) {
    base.eligible = true;
    base.geschat_bedrag = maxMaandelijks;
    base.reden = 'Je komt in aanmerking voor het maximale bedrag';
    return base;
  }

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

function calcKinderopvang(input: ToeslagenInput, gezamenlijk: number): ToeslagResult {
  const base: ToeslagResult = { naam: 'Kinderopvangtoeslag', eligible: false, reden: '', geschat_bedrag: 0, actie: 'Aanvragen via toeslagen.nl' };

  if (!input.has_kinderopvang) { base.reden = 'Geen kinderopvang opgegeven'; return base; }
  if (input.num_children === 0) { base.reden = 'Geen kinderen'; return base; }

  const toetsinkomen = input.has_partner ? gezamenlijk : input.jaarinkomen;
  base.eligible = true;
  if (toetsinkomen <= KINDEROPVANG.inkomen_96_pct) {
    base.reden = 'Tot 96% van de opvangkosten vergoed';
    base.actie = 'Aanvragen via toeslagen.nl — bereken exact bedrag daar';
  } else {
    base.reden = 'Gedeeltelijke vergoeding mogelijk';
    base.actie = 'Maak een proefberekening op toeslagen.nl';
  }
  return base;
}

export function normalizeToMonthly(amount: number, interval: string): number {
  switch (interval) {
    case 'weekly': return Math.round(amount * 52 / 12);
    case 'monthly': return amount;
    case 'quarterly': return Math.round(amount / 3);
    case 'yearly': return Math.round(amount / 12);
    default: return amount;
  }
}
