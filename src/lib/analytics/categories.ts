/**
 * PayWatch Transaction Category Taxonomy
 *
 * Dutch-first, debt-focused. Designed for consumers under financial stress.
 * Top-level categories are intentionally broad (8-10 max) for clarity.
 * Subcategories provide drill-down detail.
 *
 * File: src/lib/analytics/categories.ts
 */

export interface CategoryDef {
  id: string;
  nl: string;
  en: string;
  direction: 'out' | 'in' | 'both';
  color: string;
  subcategories?: { id: string; nl: string; en: string }[];
}

// Lucide icon names mapped per category (used in UI)
export const CATEGORY_ICONS: Record<string, string> = {
  wonen:          'Home',
  vaste_lasten:   'Receipt',
  boodschappen:   'ShoppingCart',
  eten_drinken:   'UtensilsCrossed',
  vervoer:        'Train',
  winkelen:       'ShoppingBag',
  vrije_tijd:     'Music',
  zorg:           'HeartPulse',
  abonnementen:   'Repeat',
  schuld:         'AlertTriangle',
  salaris:        'Briefcase',
  overheid:       'Landmark',
  overig_inkomen: 'Coins',
  eigen_rekening: 'ArrowLeftRight',
  pin_opname:     'Banknote',
  onbekend:       'HelpCircle',
};

export const CATEGORY_COLORS: Record<string, string> = {
  wonen:          '#2563EB',
  vaste_lasten:   '#7C3AED',
  boodschappen:   '#059669',
  eten_drinken:   '#EA580C',
  vervoer:        '#0891B2',
  winkelen:       '#DB2777',
  vrije_tijd:     '#CA8A04',
  zorg:           '#DC2626',
  abonnementen:   '#6366F1',
  schuld:         '#991B1B',
  salaris:        '#059669',
  overheid:       '#2563EB',
  overig_inkomen: '#0891B2',
  eigen_rekening: '#64748B',
  pin_opname:     '#94A3B8',
  onbekend:       '#94A3B8',
};

export const CATEGORIES: CategoryDef[] = [
  // ─── Spending ─────────────────────────────────────
  {
    id: 'wonen',
    nl: 'Wonen',
    en: 'Housing',
    direction: 'out',
    color: '#2563EB',
    subcategories: [
      { id: 'huur', nl: 'Huur', en: 'Rent' },
      { id: 'hypotheek', nl: 'Hypotheek', en: 'Mortgage' },
      { id: 'energie', nl: 'Energie', en: 'Energy' },
      { id: 'water', nl: 'Water', en: 'Water' },
      { id: 'gemeentebelasting', nl: 'Gemeentebelasting', en: 'Municipal tax' },
    ],
  },
  {
    id: 'vaste_lasten',
    nl: 'Vaste lasten',
    en: 'Fixed costs',
    direction: 'out',
    color: '#7C3AED',
    subcategories: [
      { id: 'verzekering', nl: 'Verzekering', en: 'Insurance' },
      { id: 'zorgverzekering', nl: 'Zorgverzekering', en: 'Health insurance' },
      { id: 'telecom', nl: 'Telefoon & internet', en: 'Phone & internet' },
    ],
  },
  {
    id: 'boodschappen',
    nl: 'Boodschappen',
    en: 'Groceries',
    direction: 'out',
    color: '#059669',
  },
  {
    id: 'eten_drinken',
    nl: 'Eten & drinken',
    en: 'Food & drinks',
    direction: 'out',
    color: '#EA580C',
    subcategories: [
      { id: 'restaurant', nl: 'Restaurant', en: 'Restaurant' },
      { id: 'bezorging', nl: 'Bezorging', en: 'Delivery' },
      { id: 'koffie', nl: 'Koffie & snacks', en: 'Coffee & snacks' },
    ],
  },
  {
    id: 'vervoer',
    nl: 'Vervoer',
    en: 'Transport',
    direction: 'out',
    color: '#0891B2',
    subcategories: [
      { id: 'ov', nl: 'OV', en: 'Public transport' },
      { id: 'brandstof', nl: 'Brandstof', en: 'Fuel' },
      { id: 'fiets', nl: 'Fiets', en: 'Bicycle' },
      { id: 'parkeren', nl: 'Parkeren', en: 'Parking' },
    ],
  },
  {
    id: 'winkelen',
    nl: 'Winkelen',
    en: 'Shopping',
    direction: 'out',
    color: '#DB2777',
  },
  {
    id: 'vrije_tijd',
    nl: 'Vrije tijd',
    en: 'Leisure',
    direction: 'out',
    color: '#CA8A04',
  },
  {
    id: 'zorg',
    nl: 'Zorg',
    en: 'Healthcare',
    direction: 'out',
    color: '#DC2626',
    subcategories: [
      { id: 'apotheek', nl: 'Apotheek', en: 'Pharmacy' },
      { id: 'huisarts', nl: 'Huisarts / specialist', en: 'Doctor' },
    ],
  },
  {
    id: 'abonnementen',
    nl: 'Abonnementen',
    en: 'Subscriptions',
    direction: 'out',
    color: '#6366F1',
  },
  {
    id: 'schuld',
    nl: 'Schuld',
    en: 'Debt',
    direction: 'out',
    color: '#991B1B',
    subcategories: [
      { id: 'incasso', nl: 'Incasso', en: 'Collection' },
      { id: 'deurwaarder', nl: 'Deurwaarder', en: 'Bailiff' },
      { id: 'cjib', nl: 'CJIB boete', en: 'CJIB fine' },
      { id: 'belastingschuld', nl: 'Belastingschuld', en: 'Tax debt' },
      { id: 'lening', nl: 'Lening / krediet', en: 'Loan' },
    ],
  },

  // ─── Income ───────────────────────────────────────
  {
    id: 'salaris',
    nl: 'Salaris',
    en: 'Salary',
    direction: 'in',
    color: '#059669',
  },
  {
    id: 'overheid',
    nl: 'Overheid',
    en: 'Government',
    direction: 'in',
    color: '#2563EB',
    subcategories: [
      { id: 'toeslag', nl: 'Toeslagen', en: 'Benefits' },
      { id: 'uitkering', nl: 'Uitkering', en: 'Welfare' },
      { id: 'kinderbijslag', nl: 'Kinderbijslag', en: 'Child benefit' },
    ],
  },
  {
    id: 'overig_inkomen',
    nl: 'Overig inkomen',
    en: 'Other income',
    direction: 'in',
    color: '#0891B2',
    subcategories: [
      { id: 'betaalverzoek', nl: 'Betaalverzoek / Tikkie', en: 'Payment request' },
      { id: 'terugbetaling', nl: 'Terugbetaling', en: 'Refund' },
    ],
  },

  // ─── Special ──────────────────────────────────────
  {
    id: 'eigen_rekening',
    nl: 'Eigen rekening',
    en: 'Own account',
    direction: 'both',
    color: '#64748B',
  },
  {
    id: 'pin_opname',
    nl: 'Pinopname',
    en: 'Cash withdrawal',
    direction: 'out',
    color: '#94A3B8',
  },
  {
    id: 'onbekend',
    nl: 'Overig',
    en: 'Other',
    direction: 'both',
    color: '#94A3B8',
  },
];

/** Spending categories only (for donut chart) */
export const SPENDING_CATEGORIES = CATEGORIES.filter(c => c.direction === 'out');

/** Income categories only */
export const INCOME_CATEGORIES = CATEGORIES.filter(c => c.direction === 'in');

/** Debt-related category IDs */
export const DEBT_CATEGORY_IDS = ['schuld', 'incasso', 'deurwaarder', 'betalingsregeling'];

/** Fixed cost category IDs (not flexible spending) */
export const FIXED_COST_IDS = ['wonen', 'vaste_lasten', 'schuld'];

/** Get category label in Dutch */
export function getCategoryLabel(id: string, locale: 'nl' | 'en' = 'nl'): string {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? cat[locale] : (locale === 'nl' ? 'Overig' : 'Other');
}

/** Get category color */
export function getCategoryColor(id: string): string {
  return CATEGORY_COLORS[id] || '#94A3B8';
}
