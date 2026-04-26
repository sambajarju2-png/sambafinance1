'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  Shield, ChevronRight, ChevronLeft, Check, Loader2,
  Mail, Camera, ClipboardList, Users, Briefcase, MapPin,
  Home, Wallet, Receipt, UserPlus, Trophy, Heart,
  HelpCircle, Plus, Minus, Search, X,
  HeartPulse, Zap, Droplet, Phone, ShieldCheck, Car,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type UserType = 'consumer' | 'buddy' | 'professional' | null;
interface Props { initialName: string; initialLanguage: 'nl' | 'en'; }

// ─── Spring (iOS feel) ───────────────────────────────────────────────────────
const sp = { type: 'spring' as const, stiffness: 300, damping: 30 };

// ─── Lottie (standard JSON format — no WASM needed) ─────────────────────────
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
const LOTTIE_MAP: Record<string, string> = {
  welcome: '/lottie/safe.json',
  house: '/lottie/home.json',
  income: '/lottie/wallet.json',
  scan: '/lottie/email.json',
  summary: '/lottie/success.json',
  bDone: '/lottie/success.json',
  pDone: '/lottie/success.json',
};

function LottieHero({ step }: { step: string }) {
  const src = LOTTIE_MAP[step];
  const [data, setData] = useState<object | null>(null);
  useEffect(() => {
    if (!src) return;
    fetch(src).then(r => r.json()).then(setData).catch(() => {});
  }, [src]);
  if (!src || !data) return null;
  return (
    <div className="flex justify-center mb-4">
      <Lottie animationData={data} loop={!['summary','bDone','pDone'].includes(step)} autoplay style={{ width: 140, height: 140 }} />
    </div>
  );
}

// ─── Gemeente ────────────────────────────────────────────────────────────────
const GEMS = ['Amsterdam','Rotterdam','Den Haag','Utrecht','Eindhoven','Groningen','Tilburg','Almere','Breda','Nijmegen','Apeldoorn','Haarlem','Arnhem','Enschede','Amersfoort','Zaanstad','Haarlemmermeer','Den Bosch','Zoetermeer','Zwolle','Leiden','Maastricht','Dordrecht','Ede','Leeuwarden','Alphen aan den Rijn','Emmen','Westland','Delft','Deventer','Sittard-Geleen','Helmond','Venlo','Oss','Roosendaal','Heerlen','Schiedam','Spijkenisse','Vlaardingen','Almelo','Gouda','Lelystad','Hilversum'].sort();

// ─── Translations (compact) ─────────────────────────────────────────────────
const L: Record<string, Record<string, string>> = {
nl:{welcome:'Welkom bij PayWatch',tagline:'Nooit meer verrast door een incassobureau',lang:'Kies je taal',branch:'Waarvoor ben je hier?',
cons:'Ik wil mijn rekeningen beheren',consSub:'Rekeningen bijhouden, schulden voorkomen, toeslagen checken',
bud:'Iemand heeft mij uitgenodigd',budSub:'Bekijk het rekeningoverzicht van iemand anders',
pro:'Ik help anderen professioneel',proSub:'Schuldhulpverlener, budgetcoach of maatschappelijk werker',
name:'Hoe heet je?',fn:'Voornaam',ln:'Achternaam (optioneel)',dob:'Geboortedatum (optioneel)',dobX:'Voor toeslagen en juridische brieven',
city:'In welke gemeente woon je?',cityX:'We zoeken gratis schuldhulp bij jou in de buurt',search:'Zoek gemeente...',skip:'Overslaan',
house:'Je huishouden',partner:'Heb je een partner?',kids:'Kinderen onder 18',
hRent:'Huur',hOwn:'Koop',hPar:'Bij ouders',hOth:'Anders',rent:'Maandelijkse huur',kinder:'Kinderopvang?',
income:'Je inkomen',salary:'Netto salaris',partnerInc:'Partner inkomen',uitk:'Uitkering/bijstand',duo:'DUO/studiefinanciering',other:'Overig',
dFrom:'Rond dag',dTo:'tot dag',totInc:'Totaal maandinkomen',
exp:'Vaste lasten',expX:'Pas aan of sla over — we vullen gemiddelden in',
zorg:'Zorgverzekering',ener:'Energie',water:'Water',tel:'Telefoon + internet',verz:'Verzekeringen',verv:'Vervoer',
totExp:'Totaal vaste lasten',avg:'gem.',
scan:'Hoe voeg je rekeningen toe?',gmail:'Koppel Gmail',gmailX:'Read-only. Alles op EU-servers.',outl:'Koppel Outlook',cam:'Scan met camera',camX:'Scan tot 5 rekeningen tegelijk',man:'Handmatig',manX:'Voeg bedragen zelf toe',
scanInfo:'Je kunt op elk moment je e-mail koppelen via het dashboard. PayWatch scant dan automatisch je inbox op facturen.',
safe:'Vangnet',safeX:'Nodig iemand uit die meekijkt. Ze kunnen niets wijzigen.',budEmail:'E-mailadres buddy',
done:'Je bent klaar!',doneSub:'PayWatch houdt nu je rekeningen in de gaten. We waarschuwen je voordat het misgaat.',inc:'Maandinkomen',costs:'Vaste lasten',free:'Vrij besteedbaar',scanning:'Scanning',buddy:'Buddy',
on:'Gekoppeld',off:'Nog niet',inv:'Uitgenodigd',noB:'Geen buddy',go:'Naar mijn dashboard',
stat1:'1,4 miljoen',stat1x:'Nederlanders hebben problematische schulden',stat2:'€43.300',stat2x:'Gemiddelde schuld bij aanmelding schuldhulp',stat3:'73%',stat3x:'Wacht te lang met hulp zoeken',
pw1:'Automatisch rekeningen scannen via je inbox',pw2:'Waarschuwingen voordat een factuur escaleert',pw3:'Overzicht van al je vaste lasten op één plek',
invC:'Uitnodiging accepteren',code:'Uitnodigingscode',conn:'Je bent verbonden!',connX:'Je kunt nu het overzicht bekijken',view:'Bekijk dashboard',
org:'Organisatie',role:'Functie',sw:'Maatschappelijk werker',dc:'Schuldhulpverlener',bc:'Budgetcoach',
how:'Zo werkt het',p1:'Je cliënten maken hun eigen account',p2:'Zij nodigen jou uit als buddy',p3:'Jij krijgt een read-only overzicht',p4:'Je monitort escalatierisico\'s',
proD:'Je bent ingesteld als professional',
next:'Volgende',back:'Terug',saving:'Opslaan...',pm:'/maand',
hiH:'Ziet er goed uit! Laten we dit zo houden.',hiM:'Elke euro telt. Wij helpen je op koers te blijven.',hiL:'Geen zorgen — vul dit later aan op je dashboard.',
kidH:'Je hebt mogelijk recht op kindgerelateerde toeslagen.',
},
en:{welcome:'Welcome to PayWatch',tagline:'Never be surprised by a collection agency again',lang:'Choose your language',branch:'What brings you here?',
cons:'I want to manage my own bills',consSub:'Track bills, prevent debt, check benefit eligibility',
bud:'Someone invited me as their buddy',budSub:"View someone's bill overview to help them stay on track",
pro:'I help others professionally',proSub:'Debt counselor, budget coach, or social worker',
name:"What's your name?",fn:'First name',ln:'Last name (optional)',dob:'Date of birth (optional)',dobX:'For benefit calculations and legal letters',
city:'Which municipality do you live in?',cityX:"We'll find free debt help near you",search:'Search municipality...',skip:'Skip',
house:'Your household',partner:'Do you have a partner?',kids:'Children under 18',
hRent:'Renting',hOwn:'Homeowner',hPar:'With parents',hOth:'Other',rent:'Monthly rent',kinder:'Childcare?',
income:'Your income',salary:'Net monthly salary',partnerInc:'Partner income',uitk:'Government benefits',duo:'Student finance (DUO)',other:'Other income',
dFrom:'Around day',dTo:'to day',totInc:'Total monthly income',
exp:'Fixed expenses',expX:"Adjust or skip — we've filled in Dutch averages",
zorg:'Health insurance',ener:'Energy',water:'Water',tel:'Phone + internet',verz:'Other insurance',verv:'Transport',
totExp:'Total fixed costs',avg:'avg',
scan:'How do you add bills?',gmail:'Connect Gmail',gmailX:'Read-only. All on EU servers.',outl:'Connect Outlook',cam:'Scan with camera',camX:'Scan up to 5 bills at once',man:'Manual entry',manX:'Add amounts yourself',
scanInfo:'You can connect your email at any time from the dashboard. PayWatch will automatically scan your inbox for invoices.',
safe:'Safety net',safeX:"Invite someone to keep you accountable. They can only view your bills.",budEmail:"Buddy's email",
done:"You're all set!",doneSub:'PayWatch is now watching your bills. We\'ll alert you before things escalate.',inc:'Monthly income',costs:'Fixed costs',free:'Disposable income',scanning:'Scanning',buddy:'Buddy',
on:'Connected',off:'Not yet',inv:'Invited',noB:'No buddy',go:'Go to my dashboard',
stat1:'1.4 million',stat1x:'Dutch people have problematic debts',stat2:'€43,300',stat2x:'Average debt at time of seeking help',stat3:'73%',stat3x:'Wait too long before seeking help',
pw1:'Automatically scan bills from your inbox',pw2:'Warnings before an invoice escalates',pw3:'Overview of all fixed costs in one place',
invC:'Accept invitation',code:'Invite code',conn:"You're connected!",connX:'You can now view their bill overview',view:'View dashboard',
org:'Organization',role:'Role',sw:'Social worker',dc:'Debt counselor',bc:'Budget coach',
how:'How it works',p1:'Your clients create their own account',p2:'They invite you as their buddy',p3:'You get read-only access',p4:'You monitor escalation risks',
proD:"You're set up as a professional",
next:'Next',back:'Back',saving:'Saving...',pm:'/month',
hiH:"Looking good! Let's keep it that way.",hiM:"Every euro counts. We'll help you stay on track.",hiL:"No worries — add this later on your dashboard.",
kidH:'You may qualify for child-related benefits.',
}};

// ─── Expense config ──────────────────────────────────────────────────────────
const EXP_CFG = [
  { key:'zorg', cat:'zorgverzekering', icon:HeartPulse, def:150 },
  { key:'ener', cat:'energie', icon:Zap, def:150 },
  { key:'water', cat:'water', icon:Droplet, def:25 },
  { key:'tel', cat:'telecom', icon:Phone, def:50 },
  { key:'verz', cat:'verzekering', icon:ShieldCheck, def:50 },
  { key:'verv', cat:'vervoer', icon:Car, def:0 },
];

// ─── Reusable components (MUST be outside main component to prevent unmount/remount on re-render) ──
function Inp({label,val,set,ph,type='text',note}:{label:string;val:string;set:(v:string)=>void;ph?:string;type?:string;note?:string}) {
  return (
    <div className="mb-5">
      <label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-1.5">{label}</label>
      {note&&<p className="text-[11px] text-pw-muted mb-1.5">{note}</p>}
      <input
        type={type}
        inputMode={type==='number'?'decimal':undefined}
        value={val}
        onChange={e=>set(e.target.value)}
        placeholder={ph}
        autoComplete="off"
        enterKeyHint="next"
        autoCapitalize={type==='text'?'words':'off'}
        autoCorrect="off"
        className="w-full rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-4 py-3.5 text-[15px] text-pw-text dark:text-gray-100 placeholder:text-pw-muted/40 focus:border-pw-blue focus:outline-none focus:ring-2 focus:ring-pw-blue/20 transition-colors"
      />
    </div>
  );
}

function Tog({label,val,set}:{label:string;val:boolean;set:(v:boolean)=>void}) {
  return (
    <button onClick={()=>set(!val)} className="flex items-center justify-between w-full rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-4 py-3.5 mb-4 active:scale-[0.98] transition-transform">
      <span className="text-[14px] font-medium text-pw-text dark:text-gray-100">{label}</span>
      <div className={`w-12 h-7 rounded-full relative transition-colors ${val?'bg-pw-blue':'bg-pw-border dark:bg-gray-600'}`}>
        <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${val?'translate-x-[22px]':'translate-x-0.5'}`}/>
      </div>
    </button>
  );
}

function BranchCard({icon:I,label,sub,onClick}:{icon:React.ElementType;label:string;sub:string;onClick:()=>void}) {
  return (
    <button onClick={onClick} className="w-full flex items-start gap-4 rounded-2xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 p-5 text-left mb-3 active:scale-[0.97] transition-all hover:shadow-lg hover:border-pw-blue/30">
      <div className="w-11 h-11 rounded-xl bg-pw-bg dark:bg-gray-700 text-pw-blue flex items-center justify-center shrink-0"><I className="w-5 h-5" strokeWidth={1.5}/></div>
      <div className="flex-1"><p className="text-[15px] font-semibold text-pw-text dark:text-gray-100">{label}</p><p className="text-[12px] text-pw-muted mt-1 leading-relaxed">{sub}</p></div>
      <ChevronRight className="w-5 h-5 text-pw-muted shrink-0 mt-2"/>
    </button>
  );
}

function ScanBtn({icon:I,label,sub,id,scans,setScans}:{icon:React.ElementType;label:string;sub?:string;id:string;scans:Set<string>;setScans:(s:Set<string>)=>void}) {
  const s=scans.has(id);
  return (
    <button onClick={()=>{const n=new Set(scans);s?n.delete(id):n.add(id);setScans(n);}} className={`w-full flex items-center gap-3.5 rounded-xl border p-4 mb-3 transition-all active:scale-[0.97] ${s?'border-pw-blue bg-pw-blue/5 dark:bg-blue-900/20':'border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s?'bg-pw-blue text-white':'bg-pw-bg dark:bg-gray-700 text-pw-muted'}`}><I className="w-5 h-5" strokeWidth={1.5}/></div>
      <div className="flex-1 text-left"><p className="text-[14px] font-semibold text-pw-text dark:text-gray-100">{label}</p>{sub&&<p className="text-[11px] text-pw-muted mt-0.5">{sub}</p>}</div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${s?'border-pw-blue bg-pw-blue':'border-pw-border dark:border-gray-500'}`}>{s&&<Check className="w-3.5 h-3.5 text-white" strokeWidth={3}/>}</div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingWizard({ initialName, initialLanguage }: Props) {
  // ── State ──
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1|-1>(1);
  const [vis, setVis] = useState(true); // CSS fade flag
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [lang, setLang] = useState<'nl'|'en'>(initialLanguage);
  const t = L[lang];
  const np = initialName.trim().split(/\s+/);
  const [fn, setFn] = useState(np[0]||'');
  const [ln, setLn] = useState(np.slice(1).join(' ')||'');
  const [dob, setDob] = useState('');
  const [gem, setGem] = useState('');
  const [gemQ, setGemQ] = useState('');
  const [gemDD, setGemDD] = useState(false);
  const [hasPart, setHasPart] = useState(false);
  const [kids, setKids] = useState(0);
  const [hType, setHType] = useState<'hRent'|'hOwn'|'hPar'|'hOth'>('hRent');
  const [hRent, setHRent] = useState('');
  const [kinderO, setKinderO] = useState(false);
  const [sal, setSal] = useState('');
  const [partInc, setPartInc] = useState('');
  const [uitk, setUitk] = useState('');
  const [duo, setDuo] = useState('');
  const [oth, setOth] = useState('');
  const [dF, setDF] = useState('');
  const [dT, setDT] = useState('');
  const [exps, setExps] = useState<Record<string,number>>(Object.fromEntries(EXP_CFG.map(e=>[e.cat,e.def])));
  const [scans, setScans] = useState<Set<string>>(new Set());
  const [budE, setBudE] = useState('');
  const [invCode, setInvCode] = useState('');
  const [orgN, setOrgN] = useState('');
  const [proR, setProR] = useState('');

  // ── Steps ──
  const PATHS: Record<string,string[]> = {
    '':['welcome','branch'],
    consumer:['welcome','branch','name','city','house','income','exp','scan','safe','summary'],
    buddy:['welcome','branch','bName','bInv','bDone'],
    professional:['welcome','branch','pName','pCity','pHow','pDone'],
  };
  const steps = PATHS[userType||''];
  const tot = steps.length;
  const cur = steps[step]||'welcome';
  const prog = step/(tot-1)*100;
  const last = step===tot-1 && !!userType;
  const skipOk = ['city','pCity','exp','scan','safe'].includes(cur);

  // Totals
  const tInc = ((+sal||0)+(hasPart?(+partInc||0):0)+(+uitk||0)+(+duo||0)+(+oth||0))*100;
  const tExp = Object.values(exps).reduce((a,b)=>a+b,0)*100;
  const disp = Math.max(0,tInc-tExp);
  const fmt = (c:number) => `€${(c/100).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

  const canNext = cur==='welcome'||cur==='branch'||
    (['name','bName','pName'].includes(cur)&&fn.trim().length>0)||
    ['city','pCity','house','income','exp','scan','safe','summary','bInv','bDone','pHow','pDone'].includes(cur);

  // ── Nav (CSS fade — inputs never unmount, keyboard stays on iOS) ──
  const go = useCallback((nextStep: number, d: 1|-1) => {
    setVis(false);
    setTimeout(() => {
      setDir(d);
      setStep(nextStep);
      setVis(true);
    }, 120);
  }, []);
  function next() { go(Math.min(step+1,tot-1), 1); }
  function back() { if(!step)return; if(step===2&&userType){setUserType(null);go(1,-1);} else go(step-1,-1); }
  function pick(ut:UserType) { setUserType(ut); go(2,1); }

  // Personalize (summary only)
  const insight = () => !tInc ? t.hiL : disp>80000 ? t.hiH : t.hiM;

  // Keyboard — Enter to proceed, Escape to go back
  const canNextRef = useRef(canNext);
  const savingRef = useRef(saving);
  const curRef = useRef(cur);
  const lastRef = useRef(last);
  canNextRef.current = canNext;
  savingRef.current = saving;
  curRef.current = cur;
  lastRef.current = last;

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.key==='Enter'&&canNextRef.current&&!savingRef.current&&curRef.current!=='branch'){e.preventDefault();lastRef.current?complete():next();}
      if(e.key==='Escape'&&step>0){e.preventDefault();back();}
    };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[step]);

  // Save
  async function complete() {
    setSaving(true); setErr(false);
    try {
      await fetch('/api/settings/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first_name:fn.trim(),last_name:ln.trim(),date_of_birth:dob||undefined})});
      if(userType==='consumer') {
        await fetch('/api/finances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({netto_inkomen:Math.round((+sal||0)*100),partner_inkomen:hasPart?Math.round((+partInc||0)*100):0,uitkering_inkomen:Math.round((+uitk||0)*100),duo_inkomen:Math.round((+duo||0)*100),overig_inkomen:Math.round((+oth||0)*100),salary_day_from:+dF||null,salary_day_to:+dT||null,has_partner:hasPart,num_children:kids,monthly_rent:Math.round((+hRent||0)*100),has_kinderopvang:kinderO})});
        for(const[cat,amt] of Object.entries(exps)){if(amt>0) await fetch('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat,name:cat,amount:amt*100,monthly_amount:amt*100,interval:'monthly'})});}
      }
      await fetch('/api/onboarding/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first_name:fn.trim(),last_name:ln.trim(),language:lang,gemeente:gem||undefined,user_type:userType,scan_preference:[...scans].join(',')||'none'})});
      window.location.href='/overzicht';
    } catch { setSaving(false); setErr(true); }
  }

  // ── Step content (NO animation wrapper here — just plain JSX) ──
  function stepContent() {
    switch(cur) {
      case 'welcome': return (<>
        <LottieHero step="welcome"/>
        <h1 className="text-[28px] font-extrabold text-pw-text dark:text-white text-center tracking-tight mb-2">{t.welcome}</h1>
        <p className="text-[14px] text-pw-muted text-center mb-10 px-4">{t.tagline}</p>
        <p className="text-[13px] text-pw-muted text-center mb-4">{t.lang}</p>
        <div className="flex gap-3">{(['nl','en'] as const).map(l=>(
          <button key={l} onClick={()=>{setLang(l);document.cookie=`paywatch-locale=${l};path=/;max-age=31536000;samesite=lax`;}}
            className={`flex-1 py-4 rounded-xl text-[15px] font-semibold transition-all active:scale-[0.96] ${lang===l?'bg-pw-blue text-white shadow-[0_6px_20px_rgba(37,99,235,0.3)]':'border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 text-pw-text dark:text-gray-100'}`}>
            {l==='nl'?'🇳🇱 Nederlands':'🇬🇧 English'}
          </button>))}</div>
      </>);

      case 'branch': return (<>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.branch}</h1>
        <BranchCard icon={ClipboardList} label={t.cons} sub={t.consSub} onClick={()=>pick('consumer')}/>
        <BranchCard icon={Users} label={t.bud} sub={t.budSub} onClick={()=>pick('buddy')}/>
        <BranchCard icon={Briefcase} label={t.pro} sub={t.proSub} onClick={()=>pick('professional')}/>
      </>);

      case 'name': case 'bName': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center"><Heart className="w-8 h-8 text-pink-500" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.name}</h1>
        <Inp label={t.fn} val={fn} set={setFn} ph="bijv. Samba"/>
        <Inp label={t.ln} val={ln} set={setLn} ph="bijv. Jarju"/>
        {cur==='name'&&<Inp label={t.dob} val={dob} set={setDob} type="date" note={t.dobX}/>}
      </>);

      case 'pName': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-pw-blue/10 flex items-center justify-center"><Briefcase className="w-8 h-8 text-pw-blue" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.name}</h1>
        <Inp label={t.fn} val={fn} set={setFn} ph="bijv. Samba"/>
        <Inp label={t.ln} val={ln} set={setLn} ph="bijv. Jarju"/>
        <Inp label={t.org} val={orgN} set={setOrgN} ph="bijv. Gemeente Rotterdam"/>
        <div className="mb-4"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-2">{t.role}</label>
          <div className="grid grid-cols-2 gap-2">{['sw','dc','bc','hOth'].map(r=>(
            <button key={r} onClick={()=>setProR(r)} className={`py-3 px-3 rounded-xl border text-[13px] font-medium transition-all active:scale-[0.96] ${proR===r?'border-pw-blue bg-pw-blue/5 text-pw-blue':'border-pw-border dark:border-gray-600 text-pw-text dark:text-gray-200'}`}>{t[r]||r}</button>
          ))}</div></div>
      </>);

      case 'city': case 'pCity': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><MapPin className="w-8 h-8 text-emerald-600" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-2">{t.city}</h1>
        <p className="text-[13px] text-pw-muted text-center mb-8">{t.cityX}</p>
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-4 w-4 h-4 text-pw-muted" strokeWidth={1.5}/>
          <input value={gem||gemQ} onChange={e=>{setGemQ(e.target.value);setGem('');setGemDD(true);}} onFocus={()=>setGemDD(true)} placeholder={t.search} autoComplete="off" enterKeyHint="done" autoCapitalize="off"
            className="w-full pl-10 pr-10 py-3.5 rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 text-[15px] text-pw-text dark:text-gray-100 placeholder:text-pw-muted/40 focus:border-pw-blue focus:outline-none focus:ring-2 focus:ring-pw-blue/20"/>
          {gem&&<button onClick={()=>{setGem('');setGemQ('');}} className="absolute right-3.5 top-4"><X className="w-4 h-4 text-pw-muted"/></button>}
          {gemDD&&!gem&&<div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 shadow-xl">
            {GEMS.filter(c=>c.toLowerCase().includes(gemQ.toLowerCase())).map(c=>(
              <button key={c} onClick={()=>{setGem(c);setGemQ('');setGemDD(false);}} className="w-full text-left px-4 py-3 text-[14px] text-pw-text dark:text-gray-200 hover:bg-pw-bg dark:hover:bg-gray-700 transition-colors border-b border-pw-border/20 last:border-0">{c}</button>
            ))}</div>}
        </div>
        {gem&&<div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"><Check className="w-4 h-4 text-emerald-600" strokeWidth={2}/><span className="text-[14px] font-medium text-emerald-700 dark:text-emerald-300">{gem}</span></div>}
      </>);

      case 'house': return (<>
        <LottieHero step="house"/>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.house}</h1>
        <Tog label={t.partner} val={hasPart} set={setHasPart}/>
        <div className="mb-5"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-2">{t.kids}</label>
          <div className="flex items-center gap-4">
            <button onClick={()=>setKids(Math.max(0,kids-1))} className="w-11 h-11 rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"><Minus className="w-4 h-4 text-pw-text dark:text-gray-200"/></button>
            <span className="text-[22px] font-bold text-pw-text dark:text-gray-100 w-8 text-center">{kids}</span>
            <button onClick={()=>setKids(Math.min(10,kids+1))} className="w-11 h-11 rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"><Plus className="w-4 h-4 text-pw-text dark:text-gray-200"/></button>
          </div></div>
        <div className="mb-5"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-2">{L[lang].house}</label>
          <div className="grid grid-cols-2 gap-2.5">{(['hRent','hOwn','hPar','hOth'] as const).map(h=>(
            <button key={h} onClick={()=>setHType(h)} className={`py-3 rounded-xl border text-[13px] font-medium transition-all active:scale-[0.96] ${hType===h?'border-pw-blue bg-pw-blue/5 text-pw-blue':'border-pw-border dark:border-gray-600 text-pw-text dark:text-gray-200'}`}>{t[h]}</button>
          ))}</div></div>
        {hType==='hRent'&&<Inp label={t.rent} val={hRent} set={setHRent} ph="bijv. 950" type="number"/>}
        {kids>0&&<Tog label={t.kinder} val={kinderO} set={setKinderO}/>}
      </>);

      case 'income': return (<>
        <LottieHero step="income"/>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.income}</h1>
        <Inp label={t.salary} val={sal} set={setSal} ph="bijv. 2400" type="number"/>
        {hasPart&&<Inp label={t.partnerInc} val={partInc} set={setPartInc} ph="0" type="number"/>}
        <Inp label={t.uitk} val={uitk} set={setUitk} ph="0" type="number"/>
        <Inp label={t.duo} val={duo} set={setDuo} ph="0" type="number"/>
        <Inp label={t.other} val={oth} set={setOth} ph="0" type="number"/>
        <div className="flex gap-2.5 mb-5">
          <div className="flex-1"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-1.5">{t.dFrom}</label><input type="number" inputMode="numeric" min="1" max="31" value={dF} onChange={e=>setDF(e.target.value)} placeholder="22" className="w-full rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-3.5 py-3 text-[15px] text-pw-text dark:text-gray-100 focus:border-pw-blue focus:outline-none"/></div>
          <div className="flex-1"><label className="block text-[12px] font-semibold text-pw-text dark:text-gray-200 mb-1.5">{t.dTo}</label><input type="number" inputMode="numeric" min="1" max="31" value={dT} onChange={e=>setDT(e.target.value)} placeholder="25" className="w-full rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-3.5 py-3 text-[15px] text-pw-text dark:text-gray-100 focus:border-pw-blue focus:outline-none"/></div>
        </div>
        {tInc>0&&<div className="p-4 rounded-xl bg-pw-blue/5 dark:bg-blue-900/20 border border-pw-blue/20"><div className="flex justify-between items-center"><span className="text-[13px] text-pw-muted">{t.totInc}</span><span className="text-[18px] font-bold text-pw-blue">{fmt(tInc)}</span></div></div>}
      </>);

      case 'exp': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center"><Receipt className="w-8 h-8 text-violet-600" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-2">{t.exp}</h1>
        <p className="text-[13px] text-pw-muted text-center mb-6">{t.expX}</p>
        <div className="rounded-2xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 px-4 divide-y divide-pw-border/30 dark:divide-gray-700/50">
          {EXP_CFG.map(({key,cat,icon:I})=>(<div key={cat} className="flex items-center gap-3 py-3.5">
            <I className="w-4 h-4 text-pw-muted shrink-0" strokeWidth={1.5}/>
            <span className="text-[14px] text-pw-text dark:text-gray-200 flex-1">{t[key]}</span>
            <span className="text-[10px] text-pw-muted/50 mr-1">{t.avg}</span>
            <div className="flex items-center"><span className="text-[13px] text-pw-muted mr-0.5">€</span><input type="number" inputMode="numeric" value={exps[cat]||''} onChange={e=>setExps({...exps,[cat]:+e.target.value||0})} className="w-14 text-right rounded-lg border border-pw-border dark:border-gray-600 bg-pw-bg dark:bg-gray-700 px-2 py-1.5 text-[14px] text-pw-text dark:text-gray-100 focus:border-pw-blue focus:outline-none"/></div>
          </div>))}
        </div>
        <div className="mt-4 p-4 rounded-xl bg-pw-blue/5 dark:bg-blue-900/20 border border-pw-blue/20"><div className="flex justify-between items-center"><span className="text-[13px] text-pw-muted">{t.totExp}</span><span className="text-[18px] font-bold text-pw-blue">{fmt(tExp)}{t.pm}</span></div></div>
      </>);

      case 'scan': return (<>
        <LottieHero step="scan"/>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-6">{t.scan}</h1>

        <ScanBtn icon={Mail} label={t.gmail} sub={t.gmailX} id="gmail" scans={scans} setScans={setScans}/>
        <ScanBtn icon={Mail} label={t.outl} sub={t.gmailX} id="outlook" scans={scans} setScans={setScans}/>
        <ScanBtn icon={Camera} label={t.cam} sub={t.camX} id="camera" scans={scans} setScans={setScans}/>
        <ScanBtn icon={ClipboardList} label={t.man} sub={t.manX} id="manual" scans={scans} setScans={setScans}/>

        {(scans.has('gmail')||scans.has('outlook'))&&(
          <div className="mt-2 p-3.5 rounded-xl bg-pw-blue/5 dark:bg-blue-900/20 border border-pw-blue/20">
            <p className="text-[12px] text-pw-muted leading-relaxed">{t.scanInfo}</p>
          </div>
        )}
      </>);

      case 'safe': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center"><UserPlus className="w-8 h-8 text-teal-600" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-2">{t.safe}</h1>
        <p className="text-[13px] text-pw-muted text-center mb-8 px-2">{t.safeX}</p>
        <Inp label={t.budEmail} val={budE} set={setBudE} ph="naam@email.com" type="email"/>
      </>);

      case 'summary': {
        return (<>
        <LottieHero step="summary"/>
        <h1 className="text-[26px] font-extrabold text-pw-text dark:text-white text-center tracking-tight mb-1">{t.done}</h1>
        <p className="text-[13px] text-pw-muted text-center mb-6 px-4">{t.doneSub}</p>

        {/* What PayWatch does for you */}
        <div className="rounded-2xl bg-pw-blue/5 dark:bg-blue-900/15 border border-pw-blue/15 p-4 mb-4">
          <div className="space-y-2.5">
            {[t.pw1,t.pw2,t.pw3].map((txt,i)=>(
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-pw-blue flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" strokeWidth={3}/></div>
                <p className="text-[13px] text-pw-text dark:text-gray-200">{txt}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Financial summary */}
        {tInc>0&&<div className="rounded-2xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 p-5 space-y-0 divide-y divide-pw-border/30 dark:divide-gray-700/50 mb-4">
          <div className="flex justify-between items-center py-2.5"><span className="text-[13px] text-pw-muted">{t.inc}</span><span className="text-[16px] font-bold text-pw-text dark:text-gray-100">{fmt(tInc)}</span></div>
          <div className="flex justify-between items-center py-2.5"><span className="text-[13px] text-pw-muted">{t.costs}</span><span className="text-[16px] font-semibold text-pw-text dark:text-gray-200">−{fmt(tExp)}</span></div>
          <div className="flex justify-between items-center py-3"><span className="text-[14px] font-medium text-pw-text dark:text-gray-200">{t.free}</span><span className="text-[22px] font-extrabold text-pw-blue">{fmt(disp)}</span></div>
        </div>}

        {/* Debt statistics — why this matters */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[{v:t.stat1,x:t.stat1x},{v:t.stat2,x:t.stat2x},{v:t.stat3,x:t.stat3x}].map((s,i)=>(
            <div key={i} className="rounded-xl bg-pw-surface dark:bg-gray-800 border border-pw-border dark:border-gray-700 p-3 text-center">
              <p className="text-[16px] font-extrabold text-pw-navy dark:text-white">{s.v}</p>
              <p className="text-[10px] text-pw-muted leading-tight mt-1">{s.x}</p>
            </div>
          ))}
        </div>

        {kids>0&&tInc>0&&<div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"><p className="text-[12px] text-purple-700 dark:text-purple-300">{t.kidH}</p></div>}
      </>);}

      case 'bInv': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-pw-blue/10 flex items-center justify-center"><Users className="w-8 h-8 text-pw-blue" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.invC}</h1>
        <Inp label={t.code} val={invCode} set={setInvCode} ph="ABCD-1234"/>
      </>);
      case 'bDone': return (<>
        <LottieHero step="bDone"/>
        <h1 className="text-[26px] font-extrabold text-pw-text dark:text-white text-center tracking-tight mb-2">{t.conn}</h1>
        <p className="text-[14px] text-pw-muted text-center">{t.connX}</p>
      </>);
      case 'pHow': return (<>
        <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl bg-pw-blue/10 flex items-center justify-center"><HelpCircle className="w-8 h-8 text-pw-blue" strokeWidth={1.5}/></div></div>
        <h1 className="text-[24px] font-bold text-pw-text dark:text-white text-center tracking-tight mb-8">{t.how}</h1>
        <div className="space-y-3">{[t.p1,t.p2,t.p3,t.p4].map((txt,i)=>(<div key={i} className="flex items-start gap-3.5 p-4 rounded-xl bg-pw-surface dark:bg-gray-800 border border-pw-border dark:border-gray-600"><div className="w-7 h-7 rounded-full bg-pw-blue text-white text-[13px] font-bold flex items-center justify-center shrink-0">{i+1}</div><p className="text-[14px] text-pw-text dark:text-gray-200 leading-relaxed">{txt}</p></div>))}</div>
      </>);
      case 'pDone': return (<>
        <LottieHero step="pDone"/>
        <h1 className="text-[26px] font-extrabold text-pw-text dark:text-white text-center tracking-tight mb-2">{t.proD}</h1>
      </>);
      default: return null;
    }
  }

  return (
    <main className="flex h-full flex-col bg-pw-bg dark:bg-gray-900">
      {/* Progress */}
      {step>0&&<div className="px-5 pt-3 pb-1">
        <div className="h-1.5 w-full bg-pw-border/30 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div className="h-full bg-pw-blue rounded-full origin-left" animate={{scaleX:prog/100}} transition={sp}/>
        </div>
        <p className="text-[11px] text-pw-muted text-center mt-1">{step}/{tot-1}</p>
      </div>}

      {/* Step content — CSS transition, no mount/unmount (fixes iOS keyboard) */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="px-5 py-4 transition-opacity duration-100 ease-out"
          style={{ opacity: vis ? 1 : 0 }}
        >
          {stepContent()}
        </div>
      </div>

      {/* Footer — flex-pinned, no sticky (avoids iOS keyboard conflicts) */}
      <div className="shrink-0 px-5 pt-2 pb-4 bg-pw-bg dark:bg-gray-900" style={{paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
        {err&&<p className="text-red-500 text-[12px] text-center">Er ging iets mis. Probeer het opnieuw.</p>}
        {skipOk&&!last&&<button onClick={next} className="w-full py-2.5 text-[14px] font-semibold text-pw-muted active:scale-[0.97] transition-transform">{t.skip}</button>}
        {cur!=='branch'&&<div className="flex gap-3">
          {step>0&&<button onClick={back} className="w-14 h-14 rounded-xl border border-pw-border dark:border-gray-600 bg-pw-surface dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform shrink-0"><ChevronLeft className="w-5 h-5 text-pw-text dark:text-gray-200" strokeWidth={1.5}/></button>}
          <button onClick={last?complete:next} disabled={!canNext||saving}
            className={`flex-1 h-14 rounded-xl text-[15px] font-semibold text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-all ${canNext&&!saving?'bg-pw-blue shadow-[0_6px_20px_rgba(37,99,235,0.3)]':'bg-pw-blue/40'}`}>
            {saving?<><Loader2 className="w-4 h-4 animate-spin"/>{t.saving}</>:last?<>{t.go}<ChevronRight className="w-4 h-4"/></>:<>{t.next}<ChevronRight className="w-4 h-4"/></>}
          </button>
        </div>}
      </div>
    </main>
  );
}
