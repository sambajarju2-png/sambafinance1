'use client';

import Link from 'next/link';
import {
  Shield,
  Mail,
  Camera,
  Bell,
  TrendingUp,
  FileText,
  Flame,
  Trophy,
  ChevronRight,
  ArrowRight,
  Lock,
  CheckCircle,
  Heart,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-hidden bg-[#F8FAFB]">
      {/* ============================== HEADER ============================== */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 md:px-12 md:py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A2540]">
            <Shield className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[18px] font-extrabold tracking-tight text-[#0A2540]">PayWatch</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden text-[13px] font-semibold text-[#0A2540]/70 transition-colors hover:text-[#0A2540] sm:block"
          >
            Inloggen
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full bg-[#0A2540] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#0A2540]/90 hover:shadow-lg hover:shadow-[#0A2540]/20"
          >
            Start gratis
          </Link>
        </div>
      </header>

      {/* ============================== HERO ============================== */}
      <section className="relative px-5 pb-16 pt-12 md:px-12 md:pt-20">
        {/* Subtle gradient glow */}
        <div className="absolute -top-20 left-1/2 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#2563EB]/8 via-[#059669]/5 to-transparent blur-3xl" />

        <div className="relative mx-auto max-w-[640px] text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#059669]/20 bg-[#059669]/5 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#059669] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
            </span>
            <span className="text-[12px] font-semibold text-[#059669]">Bescherm je financiën — 100% gratis</span>
          </div>

          {/* Headline */}
          <h1 className="mt-8 text-[36px] font-extrabold leading-[1.08] tracking-tight text-[#0A2540] md:text-[52px]">
            Rust in je hoofd over{' '}
            <span className="relative inline-block">
              <span className="relative z-10">elke rekening</span>
              <span className="absolute -bottom-1 left-0 right-0 z-0 h-3 rounded bg-[#2563EB]/10 md:h-4" />
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-[480px] text-[16px] leading-relaxed text-[#64748B] md:text-[18px]">
            PayWatch scant je e-mail, volgt je rekeningen en waarschuwt je op tijd. Zodat jij nooit meer te maken krijgt met incassokosten of deurwaarders.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/signup"
              className="btn-press flex items-center gap-2.5 rounded-full bg-[#2563EB] px-7 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#2563EB]/25 transition-all hover:shadow-xl hover:shadow-[#2563EB]/30"
            >
              Gratis beginnen
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="#hoe-het-werkt"
              className="flex items-center gap-1.5 text-[14px] font-semibold text-[#64748B] transition-colors hover:text-[#0A2540]"
            >
              Hoe werkt het?
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </a>
          </div>

          {/* Trust */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-[12px] font-medium text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              Privacy-veilig
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" strokeWidth={2} />
              Geen creditcard
            </span>
            <span className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" strokeWidth={2} />
              Gebouwd in Nederland
            </span>
          </div>
        </div>
      </section>

      {/* ============================== SOCIAL PROOF BAR ============================== */}
      <section className="border-y border-[#E2E8F0] bg-white px-5 py-7 md:px-12">
        <div className="mx-auto grid max-w-[640px] grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-[26px] font-extrabold text-[#0A2540]">€6.775</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">Max WIK-kosten<br />per rekening</p>
          </div>
          <div>
            <p className="text-[26px] font-extrabold text-[#2563EB]">43</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">Gemeentes met<br />schuldhulp</p>
          </div>
          <div>
            <p className="text-[26px] font-extrabold text-[#059669]">AI</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">Slimme e-mail<br />& foto scanner</p>
          </div>
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section id="hoe-het-werkt" className="px-5 py-16 md:px-12">
        <div className="mx-auto max-w-[640px]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#2563EB]">Hoe werkt het?</p>
          <h2 className="mt-2 text-[26px] font-extrabold leading-tight text-[#0A2540] md:text-[32px]">
            In 3 stappen financiële rust
          </h2>

          <div className="mt-10 space-y-6">
            {[
              {
                n: '01', icon: Mail, color: 'bg-[#2563EB]/8 text-[#2563EB]',
                title: 'Koppel je Gmail',
                desc: 'Onze AI scant automatisch je inbox en herkent facturen, herinneringen en aanmaningen. Geen handmatig invoeren.',
              },
              {
                n: '02', icon: Bell, color: 'bg-[#7C3AED]/8 text-[#7C3AED]',
                title: 'Ontvang slimme herinneringen',
                desc: '3 dagen voor de vervaldatum, de dag ervoor, en op de dag zelf. Zodat je altijd op tijd bent.',
              },
              {
                n: '03', icon: Shield, color: 'bg-[#059669]/8 text-[#059669]',
                title: 'Voorkom kosten & schulden',
                desc: 'Betaal op tijd en bespaar tot €6.775 per rekening aan incassokosten. PayWatch berekent automatisch je WIK-risico.',
              },
            ].map((step) => (
              <div key={step.n} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${step.color}`}>
                    <step.icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  {step.n !== '03' && <div className="mt-2 h-full w-px bg-[#E2E8F0]" />}
                </div>
                <div className="pb-6">
                  <span className="text-[11px] font-bold text-[#94A3B8]">STAP {step.n}</span>
                  <h3 className="mt-1 text-[17px] font-bold text-[#0A2540]">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#64748B]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== FEATURES ============================== */}
      <section className="border-t border-[#E2E8F0] bg-white px-5 py-16 md:px-12">
        <div className="mx-auto max-w-[640px]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#059669]">Functies</p>
          <h2 className="mt-2 text-[26px] font-extrabold text-[#0A2540] md:text-[32px]">
            Alles in één app
          </h2>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { icon: Mail, title: 'Gmail scanner', desc: 'AI herkent facturen automatisch' },
              { icon: Camera, title: 'Foto scanner', desc: 'Scan papieren rekeningen' },
              { icon: TrendingUp, title: 'Cashflow', desc: 'Zie wanneer wat vervalt' },
              { icon: FileText, title: 'Conceptbrieven', desc: 'AI schrijft bezwaar & betalingsregelingen' },
              { icon: Flame, title: 'Streaks', desc: 'Motivatie door op-tijd-betaling' },
              { icon: Trophy, title: '20 prestaties', desc: 'Verdien badges en beloon jezelf' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFB] p-4">
                <f.icon className="h-5 w-5 text-[#0A2540]/40" strokeWidth={1.5} />
                <p className="mt-3 text-[13px] font-bold text-[#0A2540]">{f.title}</p>
                <p className="mt-0.5 text-[11px] text-[#94A3B8]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== ESCALATION LADDER ============================== */}
      <section className="px-5 py-16 md:px-12">
        <div className="mx-auto max-w-[640px]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#DC2626]">Waarom het belangrijk is</p>
          <h2 className="mt-2 text-[26px] font-extrabold text-[#0A2540] md:text-[32px]">
            De escalatieladder
          </h2>
          <p className="mt-2 text-[14px] text-[#64748B]">
            Dit is wat er gebeurt als een rekening te lang blijft liggen.
          </p>

          <div className="mt-8 space-y-2">
            {[
              { stage: 'Factuur', days: 'Dag 0', cost: '€0', color: 'bg-[#2563EB]', opacity: 'opacity-100' },
              { stage: 'Herinnering', days: 'Dag 14', cost: '€0', color: 'bg-[#D97706]', opacity: 'opacity-90' },
              { stage: 'Aanmaning', days: 'Dag 28', cost: '+ €40 WIK', color: 'bg-[#EA580C]', opacity: 'opacity-80' },
              { stage: 'Incassobureau', days: 'Dag 42+', cost: '+ 15% WIK', color: 'bg-[#DC2626]', opacity: 'opacity-70' },
              { stage: 'Deurwaarder', days: 'Dag 90+', cost: '+ €6.775', color: 'bg-[#991B1B]', opacity: 'opacity-60' },
            ].map((s, i) => (
              <div key={s.stage} className={`flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5 ${s.opacity}`}>
                <div className={`h-3 w-3 flex-shrink-0 rounded-full ${s.color}`} />
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[#0A2540]">{s.stage}</p>
                  <p className="text-[11px] text-[#94A3B8]">{s.days}</p>
                </div>
                <span className={`text-[13px] font-bold ${i >= 2 ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}>
                  {s.cost}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border-2 border-[#2563EB]/20 bg-[#2563EB]/5 p-5 text-center">
            <Zap className="mx-auto h-6 w-6 text-[#2563EB]" strokeWidth={2} />
            <p className="mt-2 text-[16px] font-bold text-[#0A2540]">
              PayWatch waarschuwt je bij stap 1
            </p>
            <p className="mt-1 text-[13px] text-[#64748B]">
              Zodat je nooit bij stap 5 uitkomt.
            </p>
          </div>
        </div>
      </section>

      {/* ============================== SCHULDHULP ============================== */}
      <section className="border-t border-[#E2E8F0] bg-white px-5 py-16 md:px-12">
        <div className="mx-auto max-w-[640px]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#7C3AED]">Schuldhulpverlening</p>
          <h2 className="mt-2 text-[26px] font-extrabold text-[#0A2540]">
            Hulp nodig? We verbinden je.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#64748B]">
            PayWatch kent schuldhulporganisaties in 43 gemeentes. We verbinden je direct met gratis hulp in jouw buurt. Anoniem en zonder wachttijd.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', '+ 36 meer'].map((g) => (
              <span key={g} className="rounded-full border border-[#E2E8F0] bg-[#F8FAFB] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                {g}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== FINAL CTA ============================== */}
      <section className="relative overflow-hidden bg-[#0A2540] px-5 py-20 text-center md:px-12">
        <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-[#2563EB]/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-[#059669]/20 blur-3xl" />

        <div className="relative mx-auto max-w-[480px]">
          <h2 className="text-[30px] font-extrabold leading-tight text-white md:text-[38px]">
            Bescherm jezelf.<br />
            <span className="bg-gradient-to-r from-[#60A5FA] to-[#34D399] bg-clip-text text-transparent">
              Begin vandaag.
            </span>
          </h2>
          <p className="mt-4 text-[15px] text-[#94A3B8]">
            Gratis. Geen creditcard. Gebouwd voor Nederlandse huishoudens.
          </p>
          <Link
            href="/auth/signup"
            className="btn-press mt-8 inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-[15px] font-bold text-[#0A2540] shadow-2xl transition-all hover:shadow-white/10"
          >
            Maak gratis account
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFB] px-5 py-8 md:px-12">
        <div className="mx-auto flex max-w-[640px] items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#94A3B8]" strokeWidth={1.5} />
            <span className="text-[13px] font-bold text-[#94A3B8]">PayWatch</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            © {new Date().getFullYear()} — Je gegevens blijven van jou.
          </p>
        </div>
      </footer>
    </div>
  );
}
