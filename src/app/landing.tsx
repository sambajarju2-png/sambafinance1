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
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-pw-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-blue">
            <Shield className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-pw-navy">PayWatch</span>
        </div>
        <Link
          href="/auth/login"
          className="rounded-button bg-pw-navy px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-pw-navy/90"
        >
          Inloggen
        </Link>
      </header>

      {/* Hero */}
      <section className="px-5 pb-12 pt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-pw-blue/20 bg-pw-blue/5 px-3 py-1 text-[11px] font-semibold text-pw-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-pw-green" />
          Gratis — Geen creditcard nodig
        </div>

        <h1 className="mt-4 text-[32px] font-extrabold leading-[1.1] tracking-tight text-pw-navy">
          Nooit meer verrast door een{' '}
          <span className="bg-gradient-to-r from-pw-blue to-blue-400 bg-clip-text text-transparent">
            incassobureau
          </span>
        </h1>

        <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-pw-muted">
          PayWatch scant je e-mail, volgt je rekeningen, en waarschuwt je voordat het te laat is. Bescherm jezelf tegen incassokosten en schulden.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/auth/signup"
            className="btn-press flex items-center gap-2 rounded-button bg-pw-blue px-5 py-3 text-[14px] font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/30"
          >
            Gratis starten
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <a
            href="#hoe-het-werkt"
            className="btn-press flex items-center gap-1 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[14px] font-semibold text-pw-text transition-colors hover:bg-pw-bg"
          >
            Meer info
          </a>
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex flex-wrap gap-4 text-[11px] font-medium text-pw-muted">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-pw-green" strokeWidth={2} />
            100% privacy-veilig
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-pw-blue" strokeWidth={2} />
            Gmail-integratie
          </span>
          <span className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-pw-purple" strokeWidth={2} />
            Slimme herinneringen
          </span>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-pw-border bg-pw-surface px-5 py-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[22px] font-extrabold text-pw-navy">€6.775</p>
            <p className="mt-0.5 text-[10px] text-pw-muted">Max WIK-kosten per rekening</p>
          </div>
          <div>
            <p className="text-[22px] font-extrabold text-pw-blue">14</p>
            <p className="mt-0.5 text-[10px] text-pw-muted">Categorieën bijgehouden</p>
          </div>
          <div>
            <p className="text-[22px] font-extrabold text-pw-green">AI</p>
            <p className="mt-0.5 text-[10px] text-pw-muted">Slimme e-mail scanner</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="hoe-het-werkt" className="px-5 py-12">
        <h2 className="text-[22px] font-bold text-pw-navy">Hoe werkt het?</h2>
        <p className="mt-2 text-[13px] text-pw-muted">In 3 stappen beschermd tegen incassokosten</p>

        <div className="mt-6 space-y-4">
          <StepCard
            number="1"
            icon={Mail}
            title="Koppel je Gmail"
            description="PayWatch scant automatisch je inbox op rekeningen en facturen. Geen handmatig invoeren meer."
            color="blue"
          />
          <StepCard
            number="2"
            icon={Bell}
            title="Ontvang herinneringen"
            description="3 dagen voor de vervaldatum krijg je een melding. En nog een keer op de dag zelf."
            color="purple"
          />
          <StepCard
            number="3"
            icon={Shield}
            title="Voorkom incassokosten"
            description="Betaal op tijd en bespaar tot €6.775 per rekening aan WIK-kosten en deurwaarderskosten."
            color="green"
          />
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-pw-border bg-pw-surface px-5 py-12">
        <h2 className="text-[22px] font-bold text-pw-navy">Alles wat je nodig hebt</h2>
        <p className="mt-2 text-[13px] text-pw-muted">Eén app voor al je rekeningen</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <FeatureCard icon={Mail} title="Gmail scanner" description="AI herkent rekeningen in je inbox" />
          <FeatureCard icon={Camera} title="Foto scanner" description="Scan papieren rekeningen met je camera" />
          <FeatureCard icon={TrendingUp} title="Cashflow overzicht" description="Zie wanneer welke rekening vervalt" />
          <FeatureCard icon={FileText} title="Conceptbrieven" description="AI schrijft bezwaar- en betalingsbrieven" />
          <FeatureCard icon={Flame} title="Streak systeem" description="Houd je motivatie vast met streaks" />
          <FeatureCard icon={Trophy} title="Prestaties" description="Verdien badges door slim te betalen" />
        </div>
      </section>

      {/* Escalation explanation */}
      <section className="px-5 py-12">
        <h2 className="text-[22px] font-bold text-pw-navy">De escalatieladder</h2>
        <p className="mt-2 text-[13px] text-pw-muted">
          Dit is wat er gebeurt als je een rekening te lang laat liggen
        </p>

        <div className="mt-6 space-y-3">
          <EscalationStep stage="Factuur" color="bg-pw-blue" days="0 dagen" cost="€0" />
          <EscalationStep stage="Herinnering" color="bg-pw-amber" days="14 dagen" cost="€0" />
          <EscalationStep stage="Aanmaning" color="bg-pw-orange" days="28 dagen" cost="+ €40 WIK" />
          <EscalationStep stage="Incassobureau" color="bg-pw-red" days="42+ dagen" cost="+ 15% WIK" />
          <EscalationStep stage="Deurwaarder" color="bg-pw-dark-red" days="90+ dagen" cost="+ €6.775" />
        </div>

        <div className="mt-6 rounded-card border-2 border-pw-blue/30 bg-pw-blue/5 p-4 text-center">
          <p className="text-[14px] font-bold text-pw-navy">
            PayWatch waarschuwt je bij stap 1.
          </p>
          <p className="mt-1 text-[12px] text-pw-muted">
            Zodat je nooit bij stap 5 uitkomt.
          </p>
        </div>
      </section>

      {/* Schuldhulp */}
      <section className="border-t border-pw-border bg-pw-surface px-5 py-12">
        <h2 className="text-[22px] font-bold text-pw-navy">Hulp nodig?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-pw-muted">
          PayWatch verbindt je met schuldhulpverlening in jouw gemeente. We hebben 43 gemeentes en 32 organisaties in ons netwerk. Gratis en anoniem.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-pw-muted">
          <span className="rounded-full border border-pw-border px-2.5 py-1">Amsterdam</span>
          <span className="rounded-full border border-pw-border px-2.5 py-1">Rotterdam</span>
          <span className="rounded-full border border-pw-border px-2.5 py-1">Den Haag</span>
          <span className="rounded-full border border-pw-border px-2.5 py-1">Utrecht</span>
          <span className="rounded-full border border-pw-border px-2.5 py-1">+ 39 meer</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 text-center">
        <h2 className="text-[26px] font-extrabold leading-tight text-pw-navy">
          Bescherm jezelf.<br />Start vandaag.
        </h2>
        <p className="mt-3 text-[14px] text-pw-muted">
          Gratis account. Geen creditcard. Geen verborgen kosten.
        </p>
        <Link
          href="/auth/signup"
          className="btn-press mt-6 inline-flex items-center gap-2 rounded-button bg-pw-blue px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30"
        >
          Maak gratis account
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-pw-border px-5 py-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Shield className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
          <span className="text-[12px] font-semibold text-pw-muted">PayWatch</span>
        </div>
        <p className="mt-2 text-[10px] text-pw-muted">
          © {new Date().getFullYear()} PayWatch. Je gegevens blijven van jou.
        </p>
      </footer>
    </div>
  );
}

function StepCard({
  number,
  icon: Icon,
  title,
  description,
  color,
}: {
  number: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: 'blue' | 'purple' | 'green';
}) {
  const colorMap = {
    blue: 'bg-pw-blue/10 text-pw-blue',
    purple: 'bg-purple-50 text-pw-purple',
    green: 'bg-green-50 text-pw-green',
  };

  return (
    <div className="flex gap-4 rounded-card border border-pw-border bg-pw-surface p-4">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-pw-muted">STAP {number}</span>
        </div>
        <p className="mt-0.5 text-[14px] font-semibold text-pw-text">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-pw-muted">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-card border border-pw-border bg-pw-bg p-3.5">
      <Icon className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
      <p className="mt-2 text-[13px] font-semibold text-pw-text">{title}</p>
      <p className="mt-0.5 text-[11px] text-pw-muted">{description}</p>
    </div>
  );
}

function EscalationStep({
  stage,
  color,
  days,
  cost,
}: {
  stage: string;
  color: string;
  days: string;
  cost: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3">
      <div className={`h-3 w-3 flex-shrink-0 rounded-full ${color}`} />
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-pw-text">{stage}</p>
        <p className="text-[10px] text-pw-muted">{days}</p>
      </div>
      <span className="text-[12px] font-bold text-pw-red">{cost}</span>
    </div>
  );
}
