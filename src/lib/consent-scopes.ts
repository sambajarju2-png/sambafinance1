import { pick } from '@/lib/i18n-pick';

/**
 * Canonical B2B consent scopes (the granular 5). Single source of truth shared by
 * every surface that lets a user choose what an organisation may see:
 *   - the invite-acceptance flow (src/app/invite/[token])
 *   - the manual "enter org code" flow (src/components/chat/hulp-inbox)
 * Keep this in sync with the b2b_consents.scope CHECK constraint. `full_access`
 * and `aggregated` are legacy values that are NOT user-selectable here.
 */
export const CONSENT_SCOPE_KEYS = [
  'contact_info',
  'view_bills',
  'financial_overview',
  'payment_plans',
  'messaging',
  'assisted_entry',
] as const;

export type ConsentScopeKey = (typeof CONSENT_SCOPE_KEYS)[number];

/** contact_info is the always-required minimum so the org can reach the user. */
export const REQUIRED_CONSENT_SCOPES: ConsentScopeKey[] = ['contact_info'];

/**
 * Privacy-first defaults. contact_info is required. The core debt-help data
 * (bills, financial profile, payment plans) defaults on so the connection is
 * useful; messaging (the org seeing coach chat) is opt-in / off by default.
 */
export const DEFAULT_CONSENT_SCOPES: Record<ConsentScopeKey, boolean> = {
  contact_info: true,
  view_bills: true,
  financial_overview: true,
  payment_plans: true,
  messaging: false,
  assisted_entry: false,
};

export interface ConsentScopeLabel {
  label: string;
  desc: string;
  required?: boolean;
}

/** Localized labels + descriptions for each scope, in the user's language. */
export function consentScopeLabels(lang: string): Record<ConsentScopeKey, ConsentScopeLabel> {
  return {
    contact_info: {
      label: pick(lang, { nl: 'Naam en contactgegevens', en: 'Name and contact details', pl: 'Imię i dane kontaktowe', tr: 'Ad ve iletişim bilgileri', fr: 'Nom et coordonnées', ar: 'الاسم وبيانات التواصل' }),
      desc: pick(lang, { nl: 'Zodat je coach je kan bereiken', en: 'So your coach can reach you', pl: 'Aby twój opiekun mógł się z tobą skontaktować', tr: 'Koçunun sana ulaşabilmesi için', fr: 'Pour que ton coach puisse te joindre', ar: 'حتى يتمكن مدربك من الوصول إليك' }),
      required: true,
    },
    view_bills: {
      label: pick(lang, { nl: 'Rekeningen en betalingsstatus', en: 'Bills and payment status', pl: 'Rachunki i status płatności', tr: 'Faturalar ve ödeme durumu', fr: 'Factures et statut de paiement', ar: 'الفواتير وحالة الدفع' }),
      desc: pick(lang, { nl: 'Openstaande facturen, escalatiefase', en: 'Outstanding invoices, escalation stage', pl: 'Nieopłacone faktury, etap eskalacji', tr: 'Ödenmemiş faturalar, yükseltme aşaması', fr: "Factures impayées, phase d'escalade", ar: 'الفواتير غير المدفوعة، مرحلة التصعيد' }),
    },
    financial_overview: {
      label: pick(lang, { nl: 'Financieel profiel', en: 'Financial profile', pl: 'Profil finansowy', tr: 'Finansal profil', fr: 'Profil financier', ar: 'الملف المالي' }),
      desc: pick(lang, { nl: 'Inkomen, vaste lasten, toeslagen', en: 'Income, fixed costs, allowances', pl: 'Dochód, stałe wydatki, dodatki', tr: 'Gelir, sabit giderler, yardımlar', fr: 'Revenus, charges fixes, aides', ar: 'الدخل، المصاريف الثابتة، المساعدات' }),
    },
    payment_plans: {
      label: pick(lang, { nl: 'Betalingsregelingen', en: 'Payment plans', pl: 'Plany płatności', tr: 'Ödeme planları', fr: 'Plans de paiement', ar: 'خطط الدفع' }),
      desc: pick(lang, { nl: 'Actieve regelingen en voortgang', en: 'Active plans and progress', pl: 'Aktywne plany i postępy', tr: 'Aktif planlar ve ilerleme', fr: 'Plans actifs et progression', ar: 'الخطط النشطة والتقدّم' }),
    },
    messaging: {
      label: pick(lang, { nl: 'Berichten en chat', en: 'Messages and chat', pl: 'Wiadomości i czat', tr: 'Mesajlar ve sohbet', fr: 'Messages et chat', ar: 'الرسائل والدردشة' }),
      desc: pick(lang, { nl: 'Communicatie met je coach', en: 'Communication with your coach', pl: 'Komunikacja z twoim opiekunem', tr: 'Koçunla iletişim', fr: 'Communication avec ton coach', ar: 'التواصل مع مدربك' }),
    },
    assisted_entry: {
      label: pick(lang, { nl: 'Mijn coach mag gegevens voor mij bijwerken', en: 'My coach may update info for me', pl: 'Mój opiekun może aktualizować dane za mnie', tr: 'Koçum benim için bilgileri güncelleyebilir', fr: 'Mon coach peut mettre à jour mes infos pour moi', ar: 'يمكن لمدربي تحديث معلوماتي نيابة عني' }),
      desc: pick(lang, { nl: 'Bijvoorbeeld je taal of inkomensgegevens invullen', en: 'For example filling in your language or income details', pl: 'Na przykład uzupełnić język lub dane o dochodach', tr: 'Örneğin dilini veya gelir bilgilerini girebilir', fr: 'Par exemple remplir ta langue ou tes revenus', ar: 'مثل إدخال لغتك أو بيانات دخلك' }),
    },
  };
}
