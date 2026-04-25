'use client';

import { useState, useCallback, useEffect, Children, cloneElement } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import {
  Shield, ChevronRight, ChevronLeft, Check, Loader2,
  Mail, Camera, ClipboardList, Users, Briefcase, MapPin,
  Home, Wallet, Receipt, UserPlus, Trophy, Heart,
  Building2, HelpCircle, Plus, Minus, Search, X,
  HeartPulse, Zap, Droplet, Phone, ShieldCheck, Car,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type UserType = 'consumer' | 'buddy' | 'professional' | null;
interface Props { initialName: string; initialLanguage: 'nl' | 'en'; }

// ─── Spring configs ──────────────────────────────────────────────────────────
const spring = { type: 'spring' as const, stiffness: 300, damping: 30 };
const springFast = { type: 'spring' as const, stiffness: 400, damping: 25 };
const pageVariants = {
  enter: (d: string) => ({ x: d === 'next' ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: string) => ({ x: d === 'next' ? -30 : 30, opacity: 0 }),
};
const fieldContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const fieldItem = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: springFast } };

// ─── Count-up hook ───────────────────────────────────────────────────────────
function useCountUp(target: number) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => Math.round(v));
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const ctrl = animate(mv, target / 100, { duration: 1, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on('change', v => setDisplay(v));
    return () => { ctrl.stop(); unsub(); };
  }, [target]);
  return display;
}

// ─── Gemeente list ───────────────────────────────────────────────────────────
const GEMEENTES = ['Amsterdam','Rotterdam','Den Haag','Utrecht','Eindhoven','Groningen','Tilburg','Almere','Breda','Nijmegen','Apeldoorn','Haarlem','Arnhem','Enschede','Amersfoort','Zaanstad','Haarlemmermeer','Den Bosch','Zoetermeer','Zwolle','Leiden','Maastricht','Dordrecht','Ede','Leeuwarden','Alphen aan den Rijn','Emmen','Westland','Delft','Deventer','Sittard-Geleen','Helmond','Venlo','Oss','Roosendaal','Heerlen','Schiedam','Spijkenisse','Vlaardingen','Almelo','Gouda','Lelystad','Hilversum'].sort();

// ─── Translations ────────────────────────────────────────────────────────────
const T: Record<string, Record<string, string>> = {
  nl: {
    welcome:'Welkom bij PayWatch', tagline:'Nooit meer verrast door een incassobureau',
    chooseLanguage:'Kies je taal', whatBringsYou:'Waarvoor ben je hier?',
    consumer:'Ik wil mijn rekeningen beheren', consumerSub:'Rekeningen bijhouden, schulden voorkomen, toeslagen checken',
    buddy:'Iemand heeft mij uitgenodigd als buddy', buddySub:'Bekijk het rekeningoverzicht van iemand anders',
    professional:'Ik help anderen professioneel', professionalSub:'Maatschappelijk werker, schuldhulpverlener of budgetcoach',
    yourName:'Hoe heet je?', firstName:'Voornaam', lastName:'Achternaam (optioneel)',
    dateOfBirth:'Geboortedatum (optioneel)', dobExplain:'Nodig voor toeslagen en juridische brieven',
    yourCity:'In welke gemeente woon je?', cityExplain:'We zoeken gratis schuldhulp bij jou in de buurt',
    searchCity:'Zoek je gemeente...', skip:'Overslaan',
    yourHousehold:'Hoe ziet je huishouden eruit?', hasPartner:'Heb je een partner?',
    children:'Kinderen onder 18', housing:'Woonsituatie',
    rent:'Huur', own:'Koop', parents:'Bij ouders', other:'Anders',
    monthlyRent:'Maandelijkse huur', childcare:'Kinderopvang?',
    yourIncome:'Je inkomen', netSalary:'Netto salaris per maand',
    partnerIncome:'Partner inkomen', benefits:'Uitkering/bijstand',
    studentFinance:'DUO/studiefinanciering', otherIncome:'Overig inkomen',
    dayFrom:'Rond dag', dayTo:'tot dag', totalIncome:'Totaal maandinkomen',
    fixedExpenses:'Vaste lasten', quickSetup:'Pas aan of sla over — we vullen gemiddelden in',
    healthInsurance:'Zorgverzekering', energy:'Energie', water:'Water',
    telecom:'Telefoon + internet', insurance:'Verzekeringen', transport:'Vervoer',
    totalExpenses:'Totaal vaste lasten', avg:'gem. NL',
    howToAddBills:'Hoe wil je rekeningen toevoegen?',
    connectGmail:'Koppel Gmail', gmailExplain:'We scannen je inbox — read-only. Alles op EU-servers.',
    connectOutlook:'Koppel Outlook', scanCamera:'Scan met camera', addManually:'Handmatig toevoegen',
    safetyNet:'Vangnet', safetyExplain:'Nodig iemand uit die meekijkt. Ze zien alleen je rekeningen.',
    buddyEmail:'E-mailadres van je buddy',
    allSet:'Je bent er helemaal klaar voor!',
    monthlyIncomeLabel:'Maandinkomen', fixedCostsLabel:'Vaste lasten',
    disposableLabel:'Vrij besteedbaar', scanningLabel:'Scanning', buddyLabel:'Buddy',
    connected:'Gekoppeld', notConnected:'Nog niet gekoppeld',
    invited:'Uitgenodigd', noBuddy:'Geen buddy',
    goToDashboard:'Naar mijn dashboard',
    acceptInvite:'Uitnodiging accepteren', inviteCode:'Voer je uitnodigingscode in',
    buddyConnected:'Je bent verbonden!', buddyDoneText:'Je kunt nu het rekeningoverzicht bekijken',
    organization:'Organisatie', role:'Functie',
    socialWorker:'Maatschappelijk werker', debtCounselor:'Schuldhulpverlener', budgetCoach:'Budgetcoach',
    howItWorks:'Zo werkt het',
    proStep1:'Je cliënten maken hun eigen PayWatch-account',
    proStep2:'Zij nodigen jou uit als buddy',
    proStep3:'Jij krijgt een read-only overzicht',
    proStep4:'Je monitort escalatierisico\'s voor al je cliënten',
    proReady:'Je bent ingesteld als professional',
    next:'Volgende', back:'Terug', saving:'Opslaan...', perMonth:'/maand',
    insightHigh:'Ziet er goed uit! Laten we dit zo houden.',
    insightMid:'Elke euro telt. Wij helpen je op koers te blijven.',
    insightLow:'Geen zorgen — je kunt dit later nog aanvullen.',
    childBenefitHint:'Je hebt mogelijk recht op kindgerelateerde toeslagen. We checken dit op je dashboard.',
    skippedHint:'Vul je profiel later aan om alle functies te ontgrendelen.',
  },
  en: {
    welcome:'Welcome to PayWatch', tagline:'Never be surprised by a collection agency again',
    chooseLanguage:'Choose your language', whatBringsYou:'What brings you here?',
    consumer:'I want to manage my own bills', consumerSub:'Track bills, prevent debt, check benefit eligibility',
    buddy:'Someone invited me as their buddy', buddySub:"View someone's bill overview to help them stay on track",
    professional:'I help others professionally', professionalSub:'Social worker, debt counselor, or budget coach',
    yourName:"What's your name?", firstName:'First name', lastName:'Last name (optional)',
    dateOfBirth:'Date of birth (optional)', dobExplain:'Used for benefit calculations and legal letters',
    yourCity:'Which municipality do you live in?', cityExplain:"We'll find free debt help services near you",
    searchCity:'Search your municipality...', skip:'Skip',
    yourHousehold:'Tell us about your household', hasPartner:'Do you have a partner?',
    children:'Children under 18', housing:'Housing situation',
    rent:'Renting', own:'Homeowner', parents:'With parents', other:'Other',
    monthlyRent:'Monthly rent', childcare:'Childcare?',
    yourIncome:'Your income', netSalary:'Net monthly salary',
    partnerIncome:'Partner income', benefits:'Government benefits',
    studentFinance:'Student finance (DUO)', otherIncome:'Other income',
    dayFrom:'Around day', dayTo:'to day', totalIncome:'Total monthly income',
    fixedExpenses:'Fixed expenses', quickSetup:"Adjust or skip — we've filled in Dutch averages",
    healthInsurance:'Health insurance', energy:'Energy', water:'Water',
    telecom:'Phone + internet', insurance:'Other insurance', transport:'Transport',
    totalExpenses:'Total fixed costs', avg:'NL avg',
    howToAddBills:'How do you want to add bills?',
    connectGmail:'Connect Gmail', gmailExplain:'We scan your inbox — read-only. All on EU servers.',
    connectOutlook:'Connect Outlook', scanCamera:'Scan with camera', addManually:'Add manually',
    safetyNet:'Safety net', safetyExplain:"Invite someone to keep you accountable. They can only view your bills.",
    buddyEmail:"Buddy's email address",
    allSet:"You're all set!",
    monthlyIncomeLabel:'Monthly income', fixedCostsLabel:'Fixed costs',
    disposableLabel:'Disposable income', scanningLabel:'Scanning', buddyLabel:'Buddy',
    connected:'Connected', notConnected:'Not connected yet',
    invited:'Invited', noBuddy:'No buddy',
    goToDashboard:'Go to my dashboard',
    acceptInvite:'Accept invitation', inviteCode:'Enter your invite code',
    buddyConnected:"You're connected!", buddyDoneText:'You can now view their bill overview',
    organization:'Organization', role:'Role',
    socialWorker:'Social worker', debtCounselor:'Debt counselor', budgetCoach:'Budget coach',
    howItWorks:'How it works',
    proStep1:'Your clients create their own PayWatch account',
    proStep2:'They invite you as their buddy',
    proStep3:'You get read-only access to their bill overview',
    proStep4:'You can monitor escalation risks across all clients',
    proReady:"You're set up as a professional",
    next:'Next', back:'Back', saving:'Saving...', perMonth:'/month',
    insightHigh:"Looking good! Let's keep it that way.",
    insightMid:"Every euro counts. We'll help you stay on track.",
    insightLow:"No worries — you can add this later.",
    childBenefitHint:'You may qualify for child-related benefits. We\'ll check on your dashboard.',
    skippedHint:'Complete your profile later to unlock all features.',
  },
};

// ─── Expense icons ───────────────────────────────────────────────────────────
const EXP_ICONS: Record<string, React.ElementType> = { zorgverzekering:HeartPulse, energie:Zap, water:Droplet, telecom:Phone, verzekering:ShieldCheck, vervoer:Car };
const EXP_DEFAULTS: Record<string, number> = { zorgverzekering:150, energie:150, water:25, telecom:50, verzekering:50, vervoer:0 };

// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingWizard({ initialName, initialLanguage }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'next'|'prev'>('next');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [language, setLanguage] = useState<'nl'|'en'>(initialLanguage);
  const t = T[language];
  const nameParts = initialName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [dob, setDob] = useState('');
  const [gemeente, setGemeente] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [showCityDD, setShowCityDD] = useState(false);
  const [hasPartner, setHasPartner] = useState(false);
  const [numChildren, setNumChildren] = useState(0);
  const [housing, setHousing] = useState<'rent'|'own'|'parents'|'other'>('rent');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [hasChildcare, setHasChildcare] = useState(false);
  const [netSalary, setNetSalary] = useState('');
  const [partnerIncome, setPartnerIncome] = useState('');
  const [benefitsVal, setBenefitsVal] = useState('');
  const [studentFinance, setStudentFinance] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [salaryDayFrom, setSalaryDayFrom] = useState('');
  const [salaryDayTo, setSalaryDayTo] = useState('');
  const [expenses, setExpenses] = useState(EXP_DEFAULTS);
  const [scanPrefs, setScanPrefs] = useState<Set<string>>(new Set());
  const [buddyEmail, setBuddyEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [proRole, setProRole] = useState('');

  const filteredCities = GEMEENTES.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  const STEPS: Record<string, string[]> = {
    '': ['welcome','branch'],
    consumer: ['welcome','branch','name','city','household','income','expenses','scanning','safetynet','summary'],
    buddy: ['welcome','branch','buddy-name','buddy-invite','buddy-done'],
    professional: ['welcome','branch','pro-name','pro-city','pro-how','pro-done'],
  };
  const steps = STEPS[userType || ''];
  const total = steps.length;
  const cur = steps[step] || 'welcome';
  const progress = step / (total - 1) * 100;
  const isLast = step === total - 1 && !!userType;
  const skippable = ['city','pro-city','expenses','scanning','safetynet'].includes(cur);

  const totalInc = ((parseFloat(netSalary)||0) + (hasPartner?(parseFloat(partnerIncome)||0):0) + (parseFloat(benefitsVal)||0) + (parseFloat(studentFinance)||0) + (parseFloat(otherIncome)||0)) * 100;
  const totalExp = Object.values(expenses).reduce((a,b)=>a+b,0) * 100;
  const disposable = Math.max(0, totalInc - totalExp);
  const fmtE = (c: number) => `€${(c/100).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

  const canNext = cur === 'welcome' || cur === 'branch' ||
    (['name','buddy-name','pro-name'].includes(cur) && firstName.trim().length > 0) ||
    ['city','pro-city','household','income','expenses','scanning','safetynet','summary','buddy-invite','buddy-done','pro-how','pro-done'].includes(cur);

  function goNext() { setDir('next'); setStep(s=>Math.min(s+1,total-1)); }
  function goBack() { if(step===0)return; setDir('prev'); if(step===2&&userType){setUserType(null);setStep(1);} else setStep(s=>Math.max(s-1,0)); }
  function pickType(type: UserType) { setUserType(type); setDir('next'); setStep(2); }

  // Personalized titles
  const pTitle = (key: string) => {
    const base = t[key] || key;
    if (!firstName.trim()) return base;
    if (['yourCity','yourHousehold','yourIncome'].includes(key))
      return `${firstName}, ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
    return base;
  };

  // Summary insight
  const getInsight = () => {
    if (!totalInc) return t.insightLow;
    if (disposable > 80000) return t.insightHigh;
    return t.insightMid;
  };

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canNext && !saving && cur !== 'branch') { e.preventDefault(); isLast ? handleComplete() : goNext(); }
      if (e.key === 'Escape' && step > 0) { e.preventDefault(); goBack(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [canNext, saving, step, isLast, cur]);

  async function handleComplete() {
    setSaving(true); setSaveError(false);
    try {
      await fetch('/api/settings/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first_name:firstName.trim(),last_name:lastName.trim(),date_of_birth:dob||undefined})});
      if (userType==='consumer') {
        await fetch('/api/finances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({netto_inkomen:Math.round((parseFloat(netSalary)||0)*100),partner_inkomen:hasPartner?Math.round((parseFloat(partnerIncome)||0)*100):0,uitkering_inkomen:Math.round((parseFloat(benefitsVal)||0)*100),duo_inkomen:Math.round((parseFloat(studentFinance)||0)*100),overig_inkomen:Math.round((parseFloat(otherIncome)||0)*100),salary_day_from:parseInt(salaryDayFrom)||null,salary_day_to:parseInt(salaryDayTo)||null,has_partner:hasPartner,num_children:numChildren,monthly_rent:Math.round((parseFloat(monthlyRent)||0)*100),has_kinderopvang:hasChildcare})});
        for (const [cat,amt] of Object.entries(expenses)) { if(amt>0) await fetch('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat,name:cat,amount:amt*100,monthly_amount:amt*100,interval:'monthly'})}); }
      }
      await fetch('/api/onboarding/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first_name:firstName.trim(),last_name:lastName.trim(),language,gemeente:gemeente||undefined,user_type:userType,scan_preference:Array.from(scanPrefs).join(',')||'none'})});
      window.location.href = '/overzicht';
    } catch { setSaving(false); setSaveError(true); }
  }

  // ── UI Components (with Motion) ──
  function Stagger({ children }: { children: React.ReactNode }) {
    return (<motion.div variants={fieldContainer} initial="hidden" animate="visible" className="space-y-4">{Children.map(children, child => child ? <motion.div variants={fieldItem}>{child}</motion.div> : null)}</motion.div>);
  }

  function Input({label,value,onChange,placeholder,type='text',explain}: {label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;explain?:string}) {
    return (<div><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-1.5">{label}</label>{explain&&<p className="text-[11px] text-pw-muted mb-1.5">{explain}</p>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-[10px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-3.5 py-3 text-[14px] text-pw-text dark:text-gray-100 placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-2 focus:ring-pw-blue/20 transition-colors"/></div>);
  }

  function Toggle({label,value,onChange}: {label:string;value:boolean;onChange:(v:boolean)=>void}) {
    return (<motion.button whileTap={{scale:0.97}} onClick={()=>onChange(!value)} className="flex items-center justify-between w-full rounded-[10px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-4 py-3">
      <span className="text-[14px] font-medium text-pw-text dark:text-gray-100">{label}</span>
      <motion.div className="w-12 h-7 rounded-full relative" animate={{backgroundColor:value?'#2563EB':'#E2E8F0'}} transition={springFast}>
        <motion.div className="w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-sm" animate={{x:value?22:2}} transition={springFast}/>
      </motion.div>
    </motion.button>);
  }

  function Card({icon:I,label,sub,onClick}: {icon:React.ElementType;label:string;sub:string;onClick:()=>void}) {
    return (<motion.button whileTap={{scale:0.97}} whileHover={{y:-2}} onClick={onClick} className="w-full flex items-start gap-3.5 rounded-[14px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 p-4 text-left transition-shadow hover:shadow-md mb-3">
      <div className="w-10 h-10 rounded-xl bg-pw-bg dark:bg-gray-700 text-pw-muted flex items-center justify-center shrink-0"><I className="w-5 h-5" strokeWidth={1.5}/></div>
      <div className="flex-1 min-w-0"><p className="text-[14px] font-semibold text-pw-text dark:text-gray-100">{label}</p><p className="text-[12px] text-pw-muted mt-0.5">{sub}</p></div>
      <ChevronRight className="w-5 h-5 text-pw-muted shrink-0 mt-1"/>
    </motion.button>);
  }

  function ExpRow({catKey,label,value,onChange}: {catKey:string;label:string;value:number;onChange:(v:number)=>void}) {
    const Icon = EXP_ICONS[catKey] || Receipt;
    return (<div className="flex items-center gap-3 py-2.5 border-b border-pw-border/30 dark:border-gray-700/50 last:border-0">
      <Icon className="w-4 h-4 text-pw-muted shrink-0" strokeWidth={1.5}/>
      <span className="text-[13px] text-pw-text dark:text-gray-200 flex-1">{label}</span>
      <span className="text-[10px] text-pw-muted/60">{t.avg}</span>
      <div className="flex items-center gap-1"><span className="text-[13px] text-pw-muted">€</span><input type="number" inputMode="numeric" value={value||''} onChange={e=>onChange(parseInt(e.target.value)||0)} className="w-16 text-right rounded-[6px] border border-pw-border dark:border-gray-600 bg-pw-bg dark:bg-gray-700 px-2 py-1.5 text-[13px] text-pw-text dark:text-gray-100 focus:border-pw-blue focus:outline-none"/></div>
    </div>);
  }

  function ScanOpt({icon:I,label,sub,id}: {icon:React.ElementType;label:string;sub?:string;id:string}) {
    const sel = scanPrefs.has(id);
    return (<motion.button whileTap={{scale:0.97}} onClick={()=>{const n=new Set(scanPrefs);sel?n.delete(id):n.add(id);setScanPrefs(n);}} className={`w-full flex items-center gap-3 rounded-[12px] border p-3.5 mb-2.5 transition-all ${sel?'border-pw-blue bg-pw-blue/5 dark:bg-blue-900/20':'border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sel?'bg-pw-blue text-white':'bg-pw-bg dark:bg-gray-700 text-pw-muted'}`}><I className="w-4 h-4" strokeWidth={1.5}/></div>
      <div className="flex-1 text-left"><p className="text-[13px] font-semibold text-pw-text dark:text-gray-100">{label}</p>{sub&&<p className="text-[11px] text-pw-muted">{sub}</p>}</div>
      <motion.div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel?'border-pw-blue bg-pw-blue':'border-pw-border dark:border-gray-500'}`}>
        <AnimatePresence>{sel&&<motion.div initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} transition={springFast}><Check className="w-3 h-3 text-white" strokeWidth={3}/></motion.div>}</AnimatePresence>
      </motion.div>
    </motion.button>);
  }

  function StepWrap({children,icon:I,title,sub}: {children:React.ReactNode;icon?:React.ElementType;title?:string;sub?:string}) {
    return (<div className="flex-1 flex flex-col px-5 py-6">
      {I&&<motion.div initial={{scale:0.6,opacity:0}} animate={{scale:1,opacity:1}} transition={{...spring,delay:0.1}} className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pw-blue/10 to-blue-100 dark:from-pw-blue/20 dark:to-blue-950/50 flex items-center justify-center"><I className="w-10 h-10 text-pw-blue" strokeWidth={1.5}/></div>
      </motion.div>}
      {title&&<motion.h1 initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="text-[24px] font-bold text-pw-text dark:text-gray-50 text-center mb-2 tracking-tight">{title}</motion.h1>}
      {sub&&<motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.25}} className="text-[13px] text-pw-muted text-center mb-8 px-4 max-w-[300px] mx-auto leading-relaxed">{sub}</motion.p>}
      <div className="flex-1">{children}</div>
    </div>);
  }

  // ── Summary count-up row ──
  function CountRow({label,cents,big,negative}: {label:string;cents:number;big?:boolean;negative?:boolean}) {
    const val = useCountUp(cents);
    return (<div className="flex items-center justify-between py-3 border-b border-pw-border/30 dark:border-gray-700/50 last:border-0">
      <span className="text-[13px] text-pw-muted">{label}</span>
      <span className={big?'text-[22px] font-extrabold text-pw-blue':'text-[15px] font-semibold text-pw-text dark:text-gray-100'}>{negative?'−':''}€{val.toLocaleString('nl-NL')}</span>
    </div>);
  }

  // ── Render ──
  function renderStep() {
    switch(cur) {
      case 'welcome': return (<StepWrap icon={Shield} title={t.welcome} sub={t.tagline}><Stagger><p className="text-[13px] text-pw-muted text-center">{t.chooseLanguage}</p><div className="flex gap-3">{(['nl','en'] as const).map(l=>(<motion.button key={l} whileTap={{scale:0.96}} onClick={()=>{setLanguage(l);document.cookie=`paywatch-locale=${l};path=/;max-age=31536000;samesite=lax`;}} className={`flex-1 py-3.5 rounded-[10px] border text-[14px] font-semibold transition-all ${language===l?'border-pw-blue bg-pw-blue text-white shadow-[0_4px_16px_rgba(37,99,235,0.25)]':'border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 text-pw-text dark:text-gray-100'}`}>{l==='nl'?'🇳🇱 Nederlands':'🇬🇧 English'}</motion.button>))}</div></Stagger></StepWrap>);

      case 'branch': return (<StepWrap title={t.whatBringsYou}><Stagger><Card icon={ClipboardList} label={t.consumer} sub={t.consumerSub} onClick={()=>pickType('consumer')}/><Card icon={Users} label={t.buddy} sub={t.buddySub} onClick={()=>pickType('buddy')}/><Card icon={Briefcase} label={t.professional} sub={t.professionalSub} onClick={()=>pickType('professional')}/></Stagger></StepWrap>);

      case 'name': case 'buddy-name': return (<StepWrap icon={Heart} title={t.yourName}><Stagger><Input label={t.firstName} value={firstName} onChange={setFirstName} placeholder="bijv. Samba"/><Input label={t.lastName} value={lastName} onChange={setLastName} placeholder="bijv. Jarju"/>{cur==='name'&&<Input label={t.dateOfBirth} value={dob} onChange={setDob} type="date" explain={t.dobExplain}/>}</Stagger></StepWrap>);

      case 'pro-name': return (<StepWrap icon={Briefcase} title={t.yourName}><Stagger><Input label={t.firstName} value={firstName} onChange={setFirstName} placeholder="bijv. Samba"/><Input label={t.lastName} value={lastName} onChange={setLastName} placeholder="bijv. Jarju"/><Input label={t.organization} value={orgName} onChange={setOrgName} placeholder="bijv. Gemeente Rotterdam"/><div><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-2">{t.role}</label><div className="grid grid-cols-2 gap-2">{['socialWorker','debtCounselor','budgetCoach','other'].map(r=>(<motion.button key={r} whileTap={{scale:0.96}} onClick={()=>setProRole(r)} className={`py-2.5 px-3 rounded-[8px] border text-[12px] font-medium ${proRole===r?'border-pw-blue bg-pw-blue/5 text-pw-blue':'border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 text-pw-text dark:text-gray-200'}`}>{t[r]||r}</motion.button>))}</div></div></Stagger></StepWrap>);

      case 'city': case 'pro-city': return (<StepWrap icon={MapPin} title={pTitle('yourCity')} sub={t.cityExplain}><Stagger><div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-pw-muted" strokeWidth={1.5}/><input value={gemeente||citySearch} onChange={e=>{setCitySearch(e.target.value);setGemeente('');setShowCityDD(true);}} onFocus={()=>setShowCityDD(true)} placeholder={t.searchCity} className="w-full pl-9 pr-9 py-3 rounded-[10px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 text-[14px] text-pw-text dark:text-gray-100 placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-2 focus:ring-pw-blue/20"/>{gemeente&&<button onClick={()=>{setGemeente('');setCitySearch('');}} className="absolute right-3 top-3.5"><X className="w-4 h-4 text-pw-muted"/></button>}<AnimatePresence>{showCityDD&&!gemeente&&<motion.div initial={{opacity:0,y:-8,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-4}} transition={springFast} className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-[12px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 shadow-lg">{filteredCities.map(c=>(<button key={c} onClick={()=>{setGemeente(c);setCitySearch('');setShowCityDD(false);}} className="w-full text-left px-3.5 py-2.5 text-[13px] text-pw-text dark:text-gray-200 hover:bg-pw-bg dark:hover:bg-gray-700 transition-colors border-b border-pw-border/30 dark:border-gray-700/50 last:border-0">{c}</button>))}</motion.div>}</AnimatePresence></div><AnimatePresence>{gemeente&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="flex items-center gap-2 p-3 rounded-[10px] bg-pw-green/10 border border-pw-green/20"><Check className="w-4 h-4 text-pw-green" strokeWidth={2}/><span className="text-[13px] font-medium text-pw-green">{gemeente}</span></motion.div>}</AnimatePresence></Stagger></StepWrap>);

      case 'household': return (<StepWrap icon={Home} title={pTitle('yourHousehold')}><Stagger><Toggle label={t.hasPartner} value={hasPartner} onChange={setHasPartner}/><div><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-2">{t.children}</label><div className="flex items-center gap-3"><motion.button whileTap={{scale:0.9}} onClick={()=>setNumChildren(Math.max(0,numChildren-1))} className="w-10 h-10 rounded-lg border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 flex items-center justify-center"><Minus className="w-4 h-4 text-pw-text dark:text-gray-200"/></motion.button><AnimatePresence mode="wait"><motion.span key={numChildren} initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} className="text-[20px] font-bold text-pw-text dark:text-gray-100 w-8 text-center">{numChildren}</motion.span></AnimatePresence><motion.button whileTap={{scale:0.9}} onClick={()=>setNumChildren(Math.min(10,numChildren+1))} className="w-10 h-10 rounded-lg border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 flex items-center justify-center"><Plus className="w-4 h-4 text-pw-text dark:text-gray-200"/></motion.button></div></div><div><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-2">{t.housing}</label><div className="grid grid-cols-2 gap-2">{(['rent','own','parents','other'] as const).map(h=>(<motion.button key={h} whileTap={{scale:0.96}} onClick={()=>setHousing(h)} className={`py-2.5 rounded-[8px] border text-[12px] font-medium ${housing===h?'border-pw-blue bg-pw-blue/5 text-pw-blue':'border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 text-pw-text dark:text-gray-200'}`}>{t[h]}</motion.button>))}</div></div><AnimatePresence>{housing==='rent'&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={spring} className="overflow-hidden"><Input label={t.monthlyRent} value={monthlyRent} onChange={setMonthlyRent} placeholder="bijv. 950" type="number"/></motion.div>}</AnimatePresence><AnimatePresence>{numChildren>0&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={spring} className="overflow-hidden"><Toggle label={t.childcare} value={hasChildcare} onChange={setHasChildcare}/></motion.div>}</AnimatePresence></Stagger></StepWrap>);

      case 'income': return (<StepWrap icon={Wallet} title={pTitle('yourIncome')}><Stagger><Input label={t.netSalary} value={netSalary} onChange={setNetSalary} placeholder="bijv. 2400" type="number"/><AnimatePresence>{hasPartner&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={spring} className="overflow-hidden"><Input label={t.partnerIncome} value={partnerIncome} onChange={setPartnerIncome} placeholder="0" type="number"/></motion.div>}</AnimatePresence><Input label={t.benefits} value={benefitsVal} onChange={setBenefitsVal} placeholder="0" type="number"/><Input label={t.studentFinance} value={studentFinance} onChange={setStudentFinance} placeholder="0" type="number"/><Input label={t.otherIncome} value={otherIncome} onChange={setOtherIncome} placeholder="0" type="number"/><div className="flex gap-2"><div className="flex-1"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-1.5">{t.dayFrom}</label><input type="number" inputMode="numeric" min="1" max="31" value={salaryDayFrom} onChange={e=>{const v=parseInt(e.target.value);setSalaryDayFrom(v>31?'31':e.target.value);}} placeholder="22" className="w-full rounded-[8px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-3 py-2.5 text-[14px] text-pw-text dark:text-gray-100 focus:border-pw-blue focus:outline-none"/></div><div className="flex-1"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-1.5">{t.dayTo}</label><input type="number" inputMode="numeric" min="1" max="31" value={salaryDayTo} onChange={e=>{const v=parseInt(e.target.value);setSalaryDayTo(v>31?'31':e.target.value);}} placeholder="25" className="w-full rounded-[8px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-3 py-2.5 text-[14px] text-pw-text dark:text-gray-100 focus:border-pw-blue focus:outline-none"/></div></div><AnimatePresence>{totalInc>0&&<motion.div key={totalInc} initial={{scale:1.03}} animate={{scale:1}} transition={spring} className="p-3 rounded-[12px] bg-pw-blue/5 dark:bg-blue-900/20 border border-pw-blue/20"><div className="flex justify-between"><span className="text-[12px] text-pw-muted">{t.totalIncome}</span><span className="text-[16px] font-bold text-pw-blue">{fmtE(totalInc)}</span></div></motion.div>}</AnimatePresence></Stagger></StepWrap>);

      case 'expenses': return (<StepWrap icon={Receipt} title={t.fixedExpenses} sub={t.quickSetup}><Stagger><div className="rounded-[12px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-3.5">{Object.entries(expenses).map(([k,v])=>(<ExpRow key={k} catKey={k} label={t[k==='zorgverzekering'?'healthInsurance':k==='energie'?'energy':k==='water'?'water':k==='telecom'?'telecom':k==='verzekering'?'insurance':'transport']} value={v} onChange={nv=>setExpenses({...expenses,[k]:nv})}/>))}</div><motion.div key={totalExp} initial={{scale:1.03}} animate={{scale:1}} className="p-3 rounded-[12px] bg-pw-blue/5 dark:bg-blue-900/20 border border-pw-blue/20"><div className="flex justify-between"><span className="text-[12px] text-pw-muted">{t.totalExpenses}</span><span className="text-[16px] font-bold text-pw-blue">{fmtE(totalExp)}{t.perMonth}</span></div></motion.div></Stagger></StepWrap>);

      case 'scanning': return (<StepWrap icon={Mail} title={t.howToAddBills}><Stagger><ScanOpt icon={Mail} label={t.connectGmail} sub={t.gmailExplain} id="gmail"/><ScanOpt icon={Mail} label={t.connectOutlook} sub={t.gmailExplain} id="outlook"/><ScanOpt icon={Camera} label={t.scanCamera} id="camera"/><ScanOpt icon={ClipboardList} label={t.addManually} id="manual"/></Stagger></StepWrap>);

      case 'safetynet': return (<StepWrap icon={UserPlus} title={t.safetyNet} sub={t.safetyExplain}><Stagger><Input label={t.buddyEmail} value={buddyEmail} onChange={setBuddyEmail} placeholder="naam@email.com" type="email"/></Stagger></StepWrap>);

      case 'summary': return (<StepWrap icon={Trophy} title={firstName ? `${firstName}, ${t.allSet.charAt(0).toLowerCase()}${t.allSet.slice(1)}` : t.allSet}><div className="space-y-4"><motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3}} className="text-center text-[14px] text-pw-muted dark:text-gray-400 mb-2">{getInsight()}</motion.p><div className="rounded-[16px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 p-5"><CountRow label={t.monthlyIncomeLabel} cents={totalInc}/><CountRow label={t.fixedCostsLabel} cents={totalExp} negative/><div className="pt-2 mt-2 border-t border-pw-border/50 dark:border-gray-700"><CountRow label={t.disposableLabel} cents={disposable} big/></div></div>{numChildren>0&&totalInc>0&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.5}} className="p-3 rounded-[10px] bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"><p className="text-[12px] text-purple-700 dark:text-purple-300">{t.childBenefitHint}</p></motion.div>}<div className="text-center text-[13px] text-pw-muted space-y-1"><p>{t.scanningLabel}: {scanPrefs.size>0?t.connected:t.notConnected}</p><p>{t.buddyLabel}: {buddyEmail?t.invited:t.noBuddy}</p></div></div></StepWrap>);

      case 'buddy-invite': return (<StepWrap icon={Users} title={t.acceptInvite}><Stagger><Input label={t.inviteCode} value={inviteCode} onChange={setInviteCode} placeholder="ABCD-1234"/></Stagger></StepWrap>);
      case 'buddy-done': return (<StepWrap icon={Check} title={t.buddyConnected} sub={t.buddyDoneText}><div className="flex justify-center mt-6"><motion.div initial={{scale:0}} animate={{scale:1}} transition={{...spring,delay:0.2}} className="w-20 h-20 rounded-full bg-pw-green/10 flex items-center justify-center"><Check className="w-10 h-10 text-pw-green" strokeWidth={2}/></motion.div></div></StepWrap>);
      case 'pro-how': return (<StepWrap icon={HelpCircle} title={t.howItWorks}><Stagger>{[t.proStep1,t.proStep2,t.proStep3,t.proStep4].map((txt,i)=>(<div key={i} className="flex items-start gap-3 p-3 rounded-[10px] bg-pw-surface dark:bg-gray-800 border border-pw-border dark:border-gray-600"><div className="w-6 h-6 rounded-full bg-pw-blue text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i+1}</div><p className="text-[13px] text-pw-text dark:text-gray-200">{txt}</p></div>))}</Stagger></StepWrap>);
      case 'pro-done': return (<StepWrap icon={Check} title={t.proReady}><div className="flex justify-center mt-6"><motion.div initial={{scale:0}} animate={{scale:1}} transition={{...spring,delay:0.2}} className="w-20 h-20 rounded-full bg-pw-green/10 flex items-center justify-center"><Check className="w-10 h-10 text-pw-green" strokeWidth={2}/></motion.div></div></StepWrap>);
      default: return null;
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-pw-bg dark:bg-gray-900">
      {step>0&&<div className="px-5 pt-4"><div className="h-1 w-full bg-pw-border/30 dark:bg-gray-700 rounded-full overflow-hidden"><motion.div className="h-full bg-pw-blue rounded-full origin-left" initial={{scaleX:0}} animate={{scaleX:progress/100}} transition={{type:'spring',stiffness:180,damping:22}}/></div><p className="text-[11px] text-pw-muted text-center mt-1.5">{step}/{total-1}</p></div>}

      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={`${userType}-${cur}`} custom={dir} variants={pageVariants} initial="enter" animate="center" exit="exit" transition={spring} className="flex-1 flex flex-col">
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-5 pb-8 pt-2 space-y-2">
        {saveError&&<motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-red-500 text-[12px] text-center">Er ging iets mis. Probeer het opnieuw.</motion.p>}
        {skippable&&!isLast&&<motion.button whileTap={{scale:0.97}} onClick={goNext} className="w-full py-2.5 text-[13px] font-semibold text-pw-muted">{t.skip}</motion.button>}
        {cur!=='branch'&&<div className="flex gap-3">
          {step>0&&<motion.button whileTap={{scale:0.93}} onClick={goBack} className="w-12 h-12 rounded-[10px] border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 flex items-center justify-center shrink-0"><ChevronLeft className="w-5 h-5 text-pw-text dark:text-gray-200" strokeWidth={1.5}/></motion.button>}
          <motion.button whileTap={{scale:0.97}} onClick={isLast?handleComplete:goNext} disabled={!canNext||saving} className={`flex-1 h-12 rounded-[10px] text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all ${canNext&&!saving?'bg-pw-blue shadow-[0_4px_16px_rgba(37,99,235,0.25)]':'bg-pw-blue/40'}`}>
            {saving?<><Loader2 className="w-4 h-4 animate-spin"/>{t.saving}</>:isLast?<>{t.goToDashboard}<ChevronRight className="w-4 h-4"/></>:<>{t.next}<ChevronRight className="w-4 h-4"/></>}
          </motion.button>
        </div>}
      </div>
    </main>
  );
}
