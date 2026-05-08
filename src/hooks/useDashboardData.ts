import useSWR from 'swr';
import type { Bill } from '@/lib/bills';

export interface MatchItem {
  transaction_id: string;
  bill_id: string;
  bank_name: string;
  creditor_name: string;
  creditor_iban: string;
  tx_amount: number;
  tx_date: string;
  tx_description: string;
  bill_vendor: string;
  bill_amount: number;
  bill_due_date: string;
  match_type: 'exact' | 'partial';
}

export interface FinancesData {
  has_finances: boolean;
  totaal_inkomen: number;
  totaal_vaste_lasten: number;
  totaal_open_rekeningen: number;
  totaal_betaald_deze_maand: number;
  vrij_besteedbaar: number;
  expenses_count: number;
  bills_count: number;
  expenses_in_incasso: Array<{ id: string; name: string; amount: number }>;
  toeslagen: unknown;
  salary_window: { from: number; to: number } | null;
}

export interface DashboardData {
  bills: Bill[];
  plan: string;
  has_bank: boolean;
  finances: FinancesData | null;
  matches: MatchItem[];
  analytics: { income: number; expenses: number; net: number } | null;
}

const CACHE_KEY = 'pw-dashboard-cache';

const fetcher = async (url: string): Promise<DashboardData> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Dashboard fetch failed');
  const data = await res.json();
  // Persist for cold-start
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
  return data;
};

export function useDashboardData() {
  // Seed SWR with sessionStorage so page renders instantly on revisit
  const fallback = (() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? { '/api/dashboard': JSON.parse(raw) } : undefined;
    } catch {
      return undefined;
    }
  })();

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    '/api/dashboard',
    fetcher,
    {
      fallback,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 20_000,   // don't re-fetch more than once per 20s
      refreshInterval: 0,          // no auto-polling — pull-to-refresh handles it
      keepPreviousData: true,      // never flash loading state on revisit
    }
  );

  return {
    data,
    isLoading: isLoading && !data, // true only on genuine cold start with no cache
    error,
    refresh: () => mutate(),
  };
}
