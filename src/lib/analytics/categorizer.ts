/**
 * Transaction Categorizer
 *
 * Hybrid approach:
 * 1. Internal transfer detection (IBAN matching)
 * 2. Rules engine (vendor patterns, IBAN lookup, bank_transaction_code, MCC)
 * 3. Mistral AI fallback for unknowns (batch, EU-hosted)
 *
 * SERVER-ONLY — never import in client components.
 *
 * File: src/lib/analytics/categorizer.ts
 */

import { createClient } from '@supabase/supabase-js';
import { callMistralText } from '@/lib/ai/mistral';

// ─── Types ────────────────────────────────────────────────────

export interface BankTx {
  id: string;
  transaction_id: string;
  user_id: string;
  amount: number;
  creditor_name: string | null;
  debtor_name: string | null;
  creditor_iban: string | null;
  debtor_iban: string | null;
  remittance_info: string | null;
  bank_category: string | null;
  mcc: string | null;
  pw_category: string | null;
  category_source: string | null;
}

export interface CategoryResult {
  category: string;
  sub_category: string | null;
  confidence: number;
  source: 'rules' | 'mcc' | 'bank_code' | 'ai' | 'user';
  merchant_clean_name: string | null;
  is_internal_transfer: boolean;
}

// ─── MCC → Category mapping ──────────────────────────────────

const MCC_MAP: Record<string, { category: string; sub?: string }> = {
  // Supermarkets
  '5411': { category: 'boodschappen' },
  '5422': { category: 'boodschappen' },
  '5441': { category: 'boodschappen' },
  '5451': { category: 'boodschappen' },
  '5462': { category: 'boodschappen' },
  // Restaurants & food
  '5812': { category: 'eten_drinken', sub: 'restaurant' },
  '5813': { category: 'eten_drinken' },
  '5814': { category: 'eten_drinken', sub: 'bezorging' },
  // Transport
  '4111': { category: 'vervoer', sub: 'ov' },
  '4112': { category: 'vervoer', sub: 'ov' },
  '4121': { category: 'vervoer' },
  '4131': { category: 'vervoer' },
  '5541': { category: 'vervoer', sub: 'brandstof' },
  '5542': { category: 'vervoer', sub: 'brandstof' },
  '7523': { category: 'vervoer', sub: 'parkeren' },
  // Shopping
  '5311': { category: 'winkelen' },
  '5331': { category: 'winkelen' },
  '5399': { category: 'winkelen' },
  '5691': { category: 'winkelen' },
  '5699': { category: 'winkelen' },
  '5941': { category: 'winkelen' },
  '5942': { category: 'winkelen' },
  // Healthcare
  '5912': { category: 'zorg', sub: 'apotheek' },
  '8011': { category: 'zorg', sub: 'huisarts' },
  '8021': { category: 'zorg' },
  '8031': { category: 'zorg' },
  '8099': { category: 'zorg' },
  // Entertainment
  '7832': { category: 'vrije_tijd' },
  '7911': { category: 'vrije_tijd' },
  '7922': { category: 'vrije_tijd' },
  '7941': { category: 'vrije_tijd' },
  // ATM
  '6010': { category: 'pin_opname' },
  '6011': { category: 'pin_opname' },
};

// ─── Dutch keyword rules ─────────────────────────────────────

interface KeywordRule {
  patterns: string[];
  category: string;
  sub_category?: string;
  direction?: 'in' | 'out';
  wholeWord?: boolean;
}

const KEYWORD_RULES: KeywordRule[] = [
  // Income
  { patterns: ['salaris', 'loon', 'maandloon', 'nettoloon', 'salarisbetaling'], category: 'salaris', direction: 'in' },
  { patterns: ['belastingdienst toeslag', 'huurtoeslag', 'zorgtoeslag', 'kindgebonden budget', 'kinderopvangtoeslag'], category: 'overheid', sub_category: 'toeslag', direction: 'in' },
  { patterns: ['uwv', 'uitkering', 'ww-uitkering', 'bijstand', 'participatiewet'], category: 'overheid', sub_category: 'uitkering', direction: 'in' },
  { patterns: ['svb', 'kinderbijslag', 'aow'], category: 'overheid', sub_category: 'kinderbijslag', direction: 'in' },
  { patterns: ['tikkie', 'betaalverzoek'], category: 'overig_inkomen', sub_category: 'betaalverzoek' },

  // Housing
  { patterns: ['hypotheek', 'mortgage'], category: 'wonen', sub_category: 'hypotheek' },
  { patterns: ['huur', 'woningcorporatie', 'woonbron', 'vestia', 'havensteder', 'woonstad'], category: 'wonen', sub_category: 'huur' },
  { patterns: ['eneco', 'vattenfall', 'essent', 'greenchoice', 'budget energie', 'energiedirect', 'oxxio'], category: 'wonen', sub_category: 'energie' },
  { patterns: ['vitens', 'brabant water', 'evides', 'waternet', 'dunea', 'oasen'], category: 'wonen', sub_category: 'water' },
  { patterns: ['gemeentebelasting', 'mswg', 'bsge'], category: 'wonen', sub_category: 'gemeentebelasting' },

  // Fixed costs
  { patterns: ['zilveren kruis', 'cz groep', 'vgz', 'menzis', 'ohra', 'interpolis', 'ditzo', 'just', 'anderzorg', 'a.s.r.'], category: 'vaste_lasten', sub_category: 'zorgverzekering' },
  { patterns: ['nationale-nederlanden', 'aegon', 'centraal beheer', 'univé', 'allianz', 'inshared'], category: 'vaste_lasten', sub_category: 'verzekering' },
  { patterns: ['kpn', 'vodafone', 'tele2', 't-mobile', 'ziggo', 'odido', 'simyo', 'lebara', 'ben', 'hollandsnieuwe'], category: 'vaste_lasten', sub_category: 'telecom' },

  // Groceries (Dutch supermarkets)
  { patterns: ['albert heijn', 'jumbo', 'lidl', 'aldi', 'plus', 'dirk', 'vomar', 'dekamarkt', 'poiesz', 'boni', 'coop', 'nettorama', 'hoogvliet', 'spar'], category: 'boodschappen' },

  // Food & drinks
  { patterns: ['thuisbezorgd', 'uber eats', 'deliveroo', 'dominos', 'new york pizza'], category: 'eten_drinken', sub_category: 'bezorging' },
  { patterns: ['starbucks', 'coffeecompany', 'bagels & beans'], category: 'eten_drinken', sub_category: 'koffie' },
  { patterns: ['mcdonalds', 'burger king', 'kfc', 'subway', 'febo'], category: 'eten_drinken', sub_category: 'restaurant' },

  // Transport
  { patterns: ['ns reizigers', 'ns groep', 'ns internationaal', 'ov-chipkaart', 'translink', 'ret', 'gvb', 'htm', 'connexxion', 'arriva', 'bravo', 'u-ov', 'qbuzz'], category: 'vervoer', sub_category: 'ov', wholeWord: true },
  { patterns: ['shell', 'bp', 'esso', 'total energies', 'tinq', 'tango', 'gulf'], category: 'vervoer', sub_category: 'brandstof' },
  { patterns: ['swapfiets', 'vanmoof'], category: 'vervoer', sub_category: 'fiets' },
  { patterns: ['parkmobile', 'yellowbrick', 'q-park', 'interparking'], category: 'vervoer', sub_category: 'parkeren' },
  { patterns: ['uber', 'ubr*', 'lyft', 'bolt.eu', 'taxi'], category: 'vervoer', sub_category: 'taxi' },

  // Shopping
  { patterns: ['bol.com', 'amazon', 'coolblue', 'mediamarkt', 'action', 'hema', 'primark', 'h&m', 'zara', 'wehkamp'], category: 'winkelen' },
  { patterns: ['ikea', 'gamma', 'praxis', 'karwei', 'hornbach'], category: 'winkelen' },

  // Subscriptions
  { patterns: ['netflix', 'spotify', 'disney+', 'videoland', 'hbo max', 'apple.com/bill', 'google play', 'playstation'], category: 'abonnementen' },
  { patterns: ['basic-fit', 'fit for free', 'anytime fitness', 'sportcity'], category: 'abonnementen' },

  // Healthcare
  { patterns: ['apotheek', 'pharmacy'], category: 'zorg', sub_category: 'apotheek' },
  { patterns: ['huisarts', 'tandarts', 'fysiotherap', 'psycholoog'], category: 'zorg', sub_category: 'huisarts' },

  // Debt / Schuld (PayWatch specialty)
  { patterns: ['cjib', 'centraal justitieel incasso bureau'], category: 'schuld', sub_category: 'cjib' },
  { patterns: ['deurwaarder', 'gerechtsdeurwaarder'], category: 'schuld', sub_category: 'deurwaarder' },
  { patterns: ['lbio'], category: 'schuld', sub_category: 'incasso', wholeWord: true },
  { patterns: ['belastingdienst invordering', 'belastingdienst schuld'], category: 'schuld', sub_category: 'belastingschuld' },

  // Cash
  { patterns: ['geldautomaat', 'geldopname', 'atm', 'pinopname', 'cash withdrawal'], category: 'pin_opname' },

  // International money transfers (outgoing)
  { patterns: ['remitly', 'wise', 'transferwise', 'western union', 'moneygram', 'worldremit'], category: 'overig', sub_category: 'internationale_overboeking', direction: 'out' },

  // P2P payments received (Tikkie, Spesa, etc.)
  { patterns: ['spesa payment', 'spesa'], category: 'overig_inkomen', sub_category: 'betaalverzoek', direction: 'in' },

  // Convenience stores & food shops
  { patterns: ['avondwinkel', 'nachtwacht', 'zabka', 'xenos', 'kruidvat', 'etos'], category: 'boodschappen' },

  // Business / services
  { patterns: ['kvk', 'kamer van koophandel', 'applaunchpad', 'appstore', 'google workspace', 'adobe', 'dropbox', 'notion', 'github'], category: 'zakelijk' },

  // Healthcare supplements
  { patterns: ['ggz', 'geestelijke gezondheidszorg', 'riagg'], category: 'zorg', sub_category: 'zorginstelling' },
];

// ─── Bank transaction code mapping ───────────────────────────

const BANK_CODE_MAP: Record<string, string> = {
  'incasso': 'vaste_lasten',          // Direct debit = usually fixed cost
  'automatische incasso': 'vaste_lasten',
  'geldautomaat': 'pin_opname',
  'geldopname': 'pin_opname',
  'overschrijving': '',               // Too generic, skip
  'betaling': '',                     // Too generic, skip
  'storting': '',                     // Too generic, skip
};

// ─── Main categorization function ────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchKeyword(text: string, pattern: string, wholeWord?: boolean): boolean {
  if (!text || !pattern) return false;
  const lower = text.toLowerCase();
  const pat = pattern.toLowerCase();

  if (wholeWord || pat.length <= 4) {
    const regex = new RegExp(`(?:^|[\\s,.()/\\-])${escapeRegex(pat)}(?:$|[\\s,.()/\\-])`, 'i');
    return regex.test(` ${lower} `);
  }
  return lower.includes(pat);
}

export function categorizeByRules(
  tx: BankTx,
  userIbans: string[]
): CategoryResult | null {
  const creditor = tx.creditor_name || '';
  const debtor = tx.debtor_name || '';
  const info = tx.remittance_info || '';
  const searchText = `${creditor} ${debtor} ${info}`.toLowerCase();
  const isCredit = tx.amount >= 0;

  // 1. Internal transfer detection
  if (userIbans.length > 0) {
    const cleanIbans = userIbans.map(i => i.replace(/\s/g, '').toUpperCase());
    const txCredIban = (tx.creditor_iban || '').replace(/\s/g, '').toUpperCase();
    const txDebIban = (tx.debtor_iban || '').replace(/\s/g, '').toUpperCase();

    if (
      (txCredIban && cleanIbans.includes(txCredIban)) ||
      (txDebIban && cleanIbans.includes(txDebIban))
    ) {
      return {
        category: 'eigen_rekening',
        sub_category: null,
        confidence: 0.95,
        source: 'rules',
        merchant_clean_name: null,
        is_internal_transfer: true,
      };
    }
  }

  // 1b. Revolut-specific internal transfer detection (no IBAN, only remittance_info)
  const infoLower = info.toLowerCase().trim();
  if (
    infoLower === 'to eur' ||
    infoLower.startsWith('to flexible cash funds') ||
    infoLower.startsWith('from flexible cash funds') ||
    infoLower.startsWith('to savings vault') ||
    infoLower.startsWith('from savings vault') ||
    infoLower.startsWith('aanvulling saldotekort') ||
    infoLower.startsWith('to pocket') ||
    infoLower.startsWith('from pocket')
  ) {
    return {
      category: 'eigen_rekening',
      sub_category: null,
      confidence: 0.95,
      source: 'rules',
      merchant_clean_name: null,
      is_internal_transfer: true,
    };
  }

  // 2. Bank transaction code
  if (tx.bank_category) {
    const bankCatLower = tx.bank_category.toLowerCase();
    const mapped = BANK_CODE_MAP[bankCatLower];
    if (mapped === 'pin_opname') {
      return {
        category: 'pin_opname',
        sub_category: null,
        confidence: 0.9,
        source: 'bank_code',
        merchant_clean_name: null,
        is_internal_transfer: false,
      };
    }
    // 'incasso' in bank_code + known incasso pattern → schuld
    if (bankCatLower.includes('incasso') && searchText.match(/incasso|deurwaarder|cjib|lbio/)) {
      return {
        category: 'schuld',
        sub_category: 'incasso',
        confidence: 0.85,
        source: 'bank_code',
        merchant_clean_name: creditor || null,
        is_internal_transfer: false,
      };
    }
  }

  // 3. Keyword rules
  for (const rule of KEYWORD_RULES) {
    // Skip rules that don't match direction
    if (rule.direction === 'in' && !isCredit) continue;
    if (rule.direction === 'out' && isCredit) continue;

    for (const pattern of rule.patterns) {
      if (matchKeyword(creditor, pattern, rule.wholeWord) ||
          matchKeyword(debtor, pattern, rule.wholeWord) ||
          matchKeyword(info, pattern, rule.wholeWord)) {
        return {
          category: rule.category,
          sub_category: rule.sub_category || null,
          confidence: 0.85,
          source: 'rules',
          merchant_clean_name: creditor || debtor || null,
          is_internal_transfer: false,
        };
      }
    }
  }

  // 4. MCC code
  if (tx.mcc && MCC_MAP[tx.mcc]) {
    const mapped = MCC_MAP[tx.mcc];
    return {
      category: mapped.category,
      sub_category: mapped.sub || null,
      confidence: 0.7,
      source: 'mcc',
      merchant_clean_name: creditor || null,
      is_internal_transfer: false,
    };
  }

  // 5. Tikkie / Betaalverzoek handling (check direction)
  if (searchText.includes('tikkie') || searchText.includes('betaalverzoek')) {
    return {
      category: isCredit ? 'overig_inkomen' : 'onbekend',
      sub_category: isCredit ? 'betaalverzoek' : null,
      confidence: 0.8,
      source: 'rules',
      merchant_clean_name: null,
      is_internal_transfer: false,
    };
  }

  // 6. Salary detection (credit + typical patterns)
  if (isCredit && tx.amount > 50000) { // > €500
    const salaryPatterns = ['salaris', 'loon', 'salary', 'nettoloon', 'maandloon'];
    if (salaryPatterns.some(p => searchText.includes(p))) {
      return {
        category: 'salaris',
        sub_category: null,
        confidence: 0.9,
        source: 'rules',
        merchant_clean_name: debtor || null,
        is_internal_transfer: false,
      };
    }
  }

  return null; // No match → AI fallback
}

// ─── Mistral AI batch categorization ─────────────────────────

const MISTRAL_SYSTEM_PROMPT = `Je bent een Nederlandse financiële categorisatie-engine.
Je krijgt banktransacties en categoriseert ze ALLEEN in de gegeven categorieën.
Retourneer ALLEEN valide JSON. Geen uitleg, geen markdown.

Categorieën:
wonen | vaste_lasten | boodschappen | eten_drinken | vervoer | winkelen | vrije_tijd | zorg | abonnementen | schuld | salaris | overheid | overig_inkomen | eigen_rekening | pin_opname | zakelijk | overig | onbekend

Subcategorieën (optioneel):
wonen: huur, hypotheek, energie, water, gemeentebelasting
vaste_lasten: verzekering, zorgverzekering, telecom
eten_drinken: restaurant, bezorging, koffie
vervoer: ov, brandstof, fiets, parkeren
zorg: apotheek, huisarts
schuld: incasso, deurwaarder, cjib, belastingschuld, lening
overheid: toeslag, uitkering, kinderbijslag
overig_inkomen: betaalverzoek, terugbetaling

Regels:
- "Belastingdienst", "DUO", "CJIB", "LBIO" → overheid of schuld (kijk naar richting)
- "Tikkie", "Betaalverzoek" → overig_inkomen (als credit) of onbekend (als debit)
- "Incasso" in bank_code + amount < 0 → schuld of vaste_lasten
- PIN/geldautomaat → pin_opname
- salaris, loon → salaris
- Retourneer altijd een confidence score (0.0-1.0)
- merchant_clean: de schone naam van de wederpartij`;

export async function categorizeBatchWithAI(
  transactions: BankTx[],
  userId: string
): Promise<Map<string, CategoryResult>> {
  const results = new Map<string, CategoryResult>();

  if (transactions.length === 0) return results;

  // Batch in groups of 30
  const batchSize = 30;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    const prompt = `${MISTRAL_SYSTEM_PROMPT}

Categoriseer deze ${batch.length} transacties:
${JSON.stringify(batch.map(t => ({
  id: t.id,
  direction: t.amount >= 0 ? 'credit' : 'debit',
  amount_eur: (Math.abs(t.amount) / 100).toFixed(2),
  creditor: t.creditor_name?.slice(0, 60),
  debtor: t.debtor_name?.slice(0, 60),
  description: t.remittance_info?.slice(0, 80),
  mcc: t.mcc,
  bank_code: t.bank_category,
})))}

Retourneer JSON object met key "results": [{"id":"...","category":"...","sub":"...","conf":0.0-1.0,"merchant_clean":"..."}]`;

    try {
      const response = await callMistralText(prompt, userId, 'tx_categorize');
      const items = (response as { results?: Array<{ id: string; category: string; sub?: string; conf?: number; merchant_clean?: string }> }).results;

      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.id && item.category) {
            results.set(item.id, {
              category: item.category,
              sub_category: item.sub || null,
              confidence: item.conf || 0.6,
              source: 'ai',
              merchant_clean_name: item.merchant_clean || null,
              is_internal_transfer: item.category === 'eigen_rekening',
            });
          }
        }
      }
    } catch (err) {
      console.error('[Categorizer] Mistral batch failed:', err);
      // Set unknowns for failed batch
      for (const tx of batch) {
        results.set(tx.id, {
          category: 'onbekend',
          sub_category: null,
          confidence: 0,
          source: 'ai',
          merchant_clean_name: null,
          is_internal_transfer: false,
        });
      }
    }
  }

  return results;
}

// ─── Full categorization pipeline ────────────────────────────

export async function categorizeUserTransactions(userId: string): Promise<{ categorized: number; aiCalled: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Get user's IBANs for internal transfer detection
  const { data: connections } = await supabase
    .from('bank_connections')
    .select('account_ids, raw_accounts')
    .eq('user_id', userId)
    .eq('status', 'linked');

  const userIbans: string[] = [];
  if (connections) {
    for (const conn of connections) {
      if (conn.raw_accounts && Array.isArray(conn.raw_accounts)) {
        for (const acc of conn.raw_accounts) {
          if (acc.account_id?.iban) userIbans.push(acc.account_id.iban);
        }
      }
    }
  }

  // 2. Fetch uncategorized transactions
  const { data: uncategorized } = await supabase
    .from('bank_transactions')
    .select('id, transaction_id, user_id, amount, creditor_name, debtor_name, creditor_iban, debtor_iban, remittance_info, bank_category, mcc, pw_category, category_source')
    .eq('user_id', userId)
    .or('category_source.eq.unset,category_source.is.null')
    .limit(500);

  if (!uncategorized || uncategorized.length === 0) return { categorized: 0, aiCalled: 0 };

  // 3. Also check incasso agencies
  const { data: incassoAgencies } = await supabase
    .from('incasso_agencies')
    .select('name')
    .limit(300);

  const incassoNames = (incassoAgencies || []).map(a => a.name.toLowerCase());

  // 4. Run rules engine
  const needsAI: BankTx[] = [];
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const tx of uncategorized as BankTx[]) {
    // Check incasso agencies first
    const credLower = (tx.creditor_name || '').toLowerCase();
    const isIncassoAgency = incassoNames.some(name =>
      name.length > 4 ? credLower.includes(name) : credLower === name
    );

    if (isIncassoAgency && tx.amount < 0) {
      updates.push({
        id: tx.id,
        data: {
          pw_category: 'schuld',
          pw_sub_category: 'incasso',
          category_source: 'rules',
          category_confidence: 0.95,
          merchant_clean_name: tx.creditor_name,
          is_internal_transfer: false,
        },
      });
      continue;
    }

    const result = categorizeByRules(tx, userIbans);
    if (result) {
      updates.push({
        id: tx.id,
        data: {
          pw_category: result.category,
          pw_sub_category: result.sub_category,
          category_source: result.source,
          category_confidence: result.confidence,
          merchant_clean_name: result.merchant_clean_name,
          is_internal_transfer: result.is_internal_transfer,
        },
      });
    } else {
      needsAI.push(tx);
    }
  }

  // 5. Batch-apply rule results
  for (const update of updates) {
    await supabase
      .from('bank_transactions')
      .update(update.data)
      .eq('id', update.id);
  }

  // 6. AI fallback for unknowns
  let aiCalled = 0;
  if (needsAI.length > 0) {
    const aiResults = await categorizeBatchWithAI(needsAI, userId);
    aiCalled = needsAI.length;

    for (const [txId, result] of aiResults) {
      await supabase
        .from('bank_transactions')
        .update({
          pw_category: result.category,
          pw_sub_category: result.sub_category,
          category_source: result.source,
          category_confidence: result.confidence,
          merchant_clean_name: result.merchant_clean_name,
          is_internal_transfer: result.is_internal_transfer,
        })
        .eq('id', txId);
    }
  }

  // 7. Refresh analytics aggregations
  await supabase.rpc('refresh_user_analytics', { p_user_id: userId });

  return { categorized: updates.length + aiCalled, aiCalled };
}
