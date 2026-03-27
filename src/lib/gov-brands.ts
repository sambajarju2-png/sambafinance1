/**
 * Government brand detection for Dutch "Blauwe Envelop" bills.
 * Detects CJIB and Belastingdienst from vendor name or content keywords.
 */

export type GovBrand = 'cjib' | 'belastingdienst' | null;

export interface GovBrandInfo {
  brand: GovBrand;
  name: string;
  shortName: string;
  color: string;
  colorLight: string;
  /** Lucide icon name to use */
  iconType: 'shield-alert' | 'landmark' | null;
  isPriority: boolean;
  deadlineNote: string;
  escalationNote: string;
}

const CJIB_KEYWORDS = [
  'cjib',
  'centraal justitieel incassobureau',
  'verkeersboete',
  'wahv',
  'mulderbeschikking',
  'strafbeschikking',
];

const BELASTING_KEYWORDS = [
  'belastingdienst',
  'belasting',
  'rijksbelasting',
  'inkomstenbelasting',
  'btw-aangifte',
  'aanslag ib',
  'voorlopige aanslag',
  'toeslagen',
  'naheffing',
];

/**
 * Detect government brand from vendor name and optional content.
 */
export function detectGovBrand(vendor: string, content?: string): GovBrand {
  const text = `${vendor} ${content || ''}`.toLowerCase();

  if (CJIB_KEYWORDS.some((kw) => text.includes(kw))) return 'cjib';
  if (BELASTING_KEYWORDS.some((kw) => text.includes(kw))) return 'belastingdienst';

  return null;
}

/**
 * Get full brand info for UI rendering.
 */
export function getGovBrandInfo(brand: GovBrand): GovBrandInfo {
  if (brand === 'cjib') {
    return {
      brand: 'cjib',
      name: 'Centraal Justitieel Incassobureau',
      shortName: 'CJIB',
      color: '#582F71',
      colorLight: '#582F7115',
      iconType: 'shield-alert',
      isPriority: true,
      deadlineNote: 'Betaaltermijn: 8 weken',
      escalationNote: 'Daarna +25% verhoging',
    };
  }

  if (brand === 'belastingdienst') {
    return {
      brand: 'belastingdienst',
      name: 'Belastingdienst',
      shortName: 'Belastingdienst',
      color: '#154273',
      colorLight: '#15427315',
      iconType: 'landmark',
      isPriority: true,
      deadlineNote: 'Betaaltermijn: 6 weken',
      escalationNote: 'Daarna 4% invorderingsrente',
    };
  }

  return {
    brand: null,
    name: '',
    shortName: '',
    color: '',
    colorLight: '',
    iconType: null,
    isPriority: false,
    deadlineNote: '',
    escalationNote: '',
  };
}

/**
 * Detect CJIB bill subtype from content/vendor.
 */
export function detectCjibSubtype(vendor: string, content?: string): string | null {
  const text = `${vendor} ${content || ''}`.toLowerCase();

  if (text.includes('verkeersboete') || text.includes('wahv') || text.includes('mulder')) return 'Verkeersboete';
  if (text.includes('strafbeschikking')) return 'Strafbeschikking';
  if (text.includes('schadevergoeding')) return 'Schadevergoedingsmaatregel';
  if (text.includes('ontneming')) return 'Ontnemingsmaatregel';
  if (text.includes('dwangsom')) return 'Dwangsom';
  if (text.includes('bestuurlijke boete')) return 'Bestuurlijke boete';

  return null;
}

/**
 * Detect Belastingdienst bill subtype.
 */
export function detectBelastingSubtype(vendor: string, content?: string): string | null {
  const text = `${vendor} ${content || ''}`.toLowerCase();

  if (text.includes('inkomstenbelasting') || text.includes('aanslag ib')) return 'Aanslag inkomstenbelasting';
  if (text.includes('voorlopige aanslag')) return 'Voorlopige aanslag';
  if (text.includes('btw')) return 'BTW-aangifte';
  if (text.includes('toeslagen') || text.includes('toeslag')) return 'Toeslagen';
  if (text.includes('naheffing')) return 'Naheffingsaanslag';
  if (text.includes('motorrijtuigenbelasting') || text.includes('mrb')) return 'Motorrijtuigenbelasting';

  return null;
}
