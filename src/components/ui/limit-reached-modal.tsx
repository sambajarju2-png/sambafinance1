'use client';

import { useState } from 'react';
import { X, Zap, Crown, ArrowRight } from 'lucide-react';

export type LimitType =
  | 'chat'
  | 'voice'
  | 'bezwaarschrift'
  | 'ai_insight'
  | 'scan'
  | 'payment_confirmation'
  | 'email_inbox'
  | 'bank_account';

interface LimitReachedModalProps {
  limitType: LimitType;
  currentPlan?: string;
  lang?: string;
  onClose: () => void;
  onUpgrade: () => void;
}

const LIMIT_INFO: Record<LimitType, { nl: { title: string; desc: string; icon: string }; en: { title: string; desc: string; icon: string } }> = {
  chat: {
    nl: { title: 'Chatlimiet bereikt', desc: 'Je hebt je dagelijkse chatberichten opgebruikt. Upgrade om meer te chatten met PayBuddy.', icon: '💬' },
    en: { title: 'Chat limit reached', desc: "You've used up your daily chat messages. Upgrade to chat more with PayBuddy.", icon: '💬' },
  },
  voice: {
    nl: { title: 'Beltijd is op', desc: 'Je PayBuddy beltijd is op voor deze maand. Upgrade voor meer belminuten.', icon: '📞' },
    en: { title: 'Voice time used up', desc: 'Your PayBuddy call time is used up this month. Upgrade for more minutes.', icon: '📞' },
  },
  bezwaarschrift: {
    nl: { title: 'Bezwaarschriftenlimiet bereikt', desc: 'Je hebt je maandelijkse bezwaarschriften opgebruikt. Upgrade om meer brieven te genereren.', icon: '📝' },
    en: { title: 'Dispute letter limit reached', desc: "You've used your monthly dispute letters. Upgrade to generate more.", icon: '📝' },
  },
  ai_insight: {
    nl: { title: 'AI inzichtenlimiet bereikt', desc: 'Je hebt je maandelijkse AI inzichten opgebruikt. Upgrade voor meer analyses.', icon: '🧠' },
    en: { title: 'AI insights limit reached', desc: "You've used your monthly AI insights. Upgrade for more analyses.", icon: '🧠' },
  },
  scan: {
    nl: { title: 'Scanlimiet bereikt', desc: 'Je hebt je maandelijkse scans opgebruikt. Upgrade voor onbeperkt scannen.', icon: '📷' },
    en: { title: 'Scan limit reached', desc: "You've used your monthly scans. Upgrade for unlimited scanning.", icon: '📷' },
  },
  payment_confirmation: {
    nl: { title: 'Betalingsbewijzenlimiet bereikt', desc: 'Je hebt je maandelijkse betalingsbewijzen opgebruikt. Upgrade voor onbeperkt opslaan.', icon: '✅' },
    en: { title: 'Payment confirmation limit reached', desc: "You've used your monthly payment confirmations. Upgrade for unlimited.", icon: '✅' },
  },
  email_inbox: {
    nl: { title: 'E-mail inbox limiet bereikt', desc: 'Je hebt het maximum aantal e-mail inboxen bereikt. Upgrade om meer inboxen te koppelen.', icon: '📧' },
    en: { title: 'Email inbox limit reached', desc: "You've reached the maximum email inboxes. Upgrade to connect more.", icon: '📧' },
  },
  bank_account: {
    nl: { title: 'Bankrekening koppelen', desc: 'Bankrekeningen koppelen is beschikbaar vanaf het Pro-abonnement.', icon: '🏦' },
    en: { title: 'Bank account linking', desc: 'Linking bank accounts is available from the Pro plan.', icon: '🏦' },
  },
};

const PLAN_UPGRADE_TARGET: Record<string, { plan: string; nameNl: string; nameEn: string; icon: typeof Zap; color: string; bgColor: string }> = {
  gratis: { plan: 'pro', nameNl: 'Pro', nameEn: 'Pro', icon: Zap, color: 'text-pw-blue', bgColor: 'bg-pw-blue' },
  pro_monthly: { plan: 'premium', nameNl: 'Premium', nameEn: 'Premium', icon: Crown, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  pro_yearly: { plan: 'premium', nameNl: 'Premium', nameEn: 'Premium', icon: Crown, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  premium_monthly: { plan: 'premium', nameNl: 'Premium', nameEn: 'Premium', icon: Crown, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  premium_yearly: { plan: 'premium', nameNl: 'Premium', nameEn: 'Premium', icon: Crown, color: 'text-amber-500', bgColor: 'bg-amber-500' },
};

export default function LimitReachedModal({ limitType, currentPlan = 'gratis', lang = 'nl', onClose, onUpgrade }: LimitReachedModalProps) {
  const nl = lang === 'nl';
  const info = LIMIT_INFO[limitType][nl ? 'nl' : 'en'];
  const target = PLAN_UPGRADE_TARGET[currentPlan] || PLAN_UPGRADE_TARGET.gratis;
  const Icon = target.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 mb-0 sm:mb-0 rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E293B] px-6 pb-8 pt-6 shadow-xl animate-[slideUp_0.25s_ease-out]"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
          <X className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
            <span className="text-2xl">{info.icon}</span>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-center text-[18px] font-bold text-gray-900 dark:text-white mb-2">
          {info.title}
        </h3>
        <p className="text-center text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
          {info.desc}
        </p>

        {/* Upgrade target */}
        <div className={`rounded-2xl border border-pw-border dark:border-white/10 p-4 mb-5 ${target.plan === 'premium' ? 'bg-amber-50/50 dark:bg-amber-500/5' : 'bg-pw-blue/5 dark:bg-pw-blue/5'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${target.bgColor}/10`}>
              <Icon className={`h-4 w-4 ${target.color}`} strokeWidth={1.5} />
            </div>
            <div>
              <p className={`text-[14px] font-semibold ${target.color}`}>
                {nl ? `Upgrade naar ${target.nameNl}` : `Upgrade to ${target.nameEn}`}
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">
                {nl ? 'Probeer 7 dagen gratis' : '7-day free trial'}
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onUpgrade}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white active:scale-[0.98] transition-transform ${target.bgColor} shadow-lg ${target.plan === 'premium' ? 'shadow-amber-500/20' : 'shadow-pw-blue/20'}`}
        >
          {nl ? `Bekijk ${target.nameNl}-abonnement` : `View ${target.nameEn} plan`}
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="w-full mt-2.5 rounded-xl py-3 text-[14px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          {nl ? 'Niet nu' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
