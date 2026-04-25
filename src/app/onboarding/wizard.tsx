'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe, Shield, ChevronRight, ChevronLeft, Check, Loader2,
  Mail, Camera, ClipboardList, Users, Briefcase, MapPin,
  Home, Wallet, Receipt, UserPlus, Trophy, Heart,
  Building2, HelpCircle, Plus, Minus, Search, X,
} from 'lucide-react';

type UserType = 'consumer' | 'buddy' | 'professional' | null;

interface Props {
  initialName: string;
  initialLanguage: 'nl' | 'en';
}

const GEMEENTES = [
  'Amsterdam','Rotterdam','Den Haag','Utrecht','Eindhoven','Groningen','Tilburg','Almere','Breda','Nijmegen',
  'Apeldoorn','Haarlem','Arnhem','Enschede','Amersfoort','Zaanstad','Haarlemmermeer','Den Bosch','Zoetermeer',
  'Zwolle','Leiden','Maastricht','Dordrecht','Ede','Leeuwarden','Alphen aan den Rijn','Emmen','Westland',
  'Delft','Deventer','Sittard-Geleen','Helmond','Venlo','Oss','Roosendaal','Heerlen','Schiedam','Spijkenisse',
  'Vlaardingen','Almelo','Gouda','Lelystad','Hilversum',
].sort();

const T = {
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
    yourHousehold:'Je huishouden', hasPartner:'Heb je een partner?',
    children:'Kinderen onder 18', housing:'Woonsituatie',
    rent:'Huur', own:'Koop', parents:'Bij ouders', other:'Anders',
    monthlyRent:'Maandelijkse huur', childcare:'Kinderopvang?', yes:'Ja', no:'Nee',
    yourIncome:'Je inkomen', netSalary:'Netto salaris per maand',
    partnerIncome:'Partner inkomen', benefits:'Uitkering/bijstand',
    studentFinance:'DUO/studiefinanciering', otherIncome:'Overig inkomen',
    salaryWindow:'Wanneer krijg je salaris?', dayFrom:'Rond dag', dayTo:'tot dag',
    totalIncome:'Totaal maandinkomen',
    fixedExpenses:'Vaste lasten', quickSetup:'Pas aan of sla over — we vullen gemiddelden in',
    healthInsurance:'Zorgverzekering', energy:'Energie (gas + stroom)',
    water:'Water', telecom:'Telefoon + internet', insurance:'Verzekeringen', transport:'Vervoer',
    totalExpenses:'Totaal vaste lasten',
    howToAddBills:'Hoe wil je rekeningen toevoegen?',
    connectGmail:'Koppel Gmail', gmailExplain:'We scannen je inbox — read-only. Alles op EU-servers.',
    connectOutlook:'Koppel Outlook', scanCamera:'Scan met camera', addManually:'Handmatig toevoegen',
    addLater:'Ik voeg later rekeningen toe',
    safetyNet:'Vangnet', safetyExplain:'Nodig iemand uit die meekijkt. Ze zien alleen je rekeningen.',
    buddyEmail:"E-mailadres van je buddy", maybeLater:'Misschien later',
    allSet:'Je bent klaar!',
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
    yourHousehold:'Your household', hasPartner:'Do you have a partner?',
    children:'Children under 18', housing:'Housing situation',
    rent:'Renting', own:'Homeowner', parents:'With parents', other:'Other',
    monthlyRent:'Monthly rent', childcare:'Childcare?', yes:'Yes', no:'No',
    yourIncome:'Your income', netSalary:'Net monthly salary',
    partnerIncome:'Partner income', benefits:'Government benefits',
    studentFinance:'Student finance (DUO)', otherIncome:'Other income',
    salaryWindow:'When do you get paid?', dayFrom:'Around day', dayTo:'to day',
    totalIncome:'Total monthly income',
    fixedExpenses:'Fixed expenses', quickSetup:"Adjust or skip — we've filled in Dutch averages",
    healthInsurance:'Health insurance', energy:'Energy (gas + electricity)',
    water:'Water', telecom:'Phone + internet', insurance:'Other insurance', transport:'Transport',
    totalExpenses:'Total fixed costs',
    howToAddBills:'How do you want to add bills?',
    connectGmail:'Connect Gmail', gmailExplain:'We scan your inbox — read-only. All on EU servers.',
    connectOutlook:'Connect Outlook', scanCamera:'Scan with camera', addManually:'Add manually',
    addLater:"I'll add bills later",
    safetyNet:'Safety net', safetyExplain:"Invite someone to keep you accountable. They can only view your bills.",
    buddyEmail:"Buddy's email address", maybeLater:'Maybe later',
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
  },
};

export default function OnboardingWizard({ initialName, initialLanguage }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'next'|'prev'>('next');
  const [animKey, setAnimKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [language, setLanguage] = useState<'nl'|'en'>(initialLanguage);
  const t = T[language] as Record<string, string>;
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
  const [expenses, setExpenses] = useState({ zorgverzekering:150, energie:150, water:25, telecom:50, verzekering:50, vervoer:0 });
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
  const canNext = cur === 'welcome' || cur === 'branch' ||
    (['name','buddy-name','pro-name'].includes(cur) && firstName.trim().length > 0) ||
    ['city','pro-city','household','income','expenses','scanning','safetynet','summary','buddy-invite','buddy-done','pro-how','pro-done'].includes(cur);

  const totalInc = ((parseFloat(netSalary)||0) + (hasPartner?(parseFloat(partnerIncome)||0):0) + (parseFloat(benefitsVal)||0) + (parseFloat(studentFinance)||0) + (parseFloat(otherIncome)||0)) * 100;
  const totalExp = Object.values(expenses).reduce((a,b) => a+b, 0) * 100;
  const fmtE = (c: number) => `€${(c/100).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

  function goNext() { setDir('next'); setAnimKey(k=>k+1); setStep(s=>Math.min(s+1,total-1)); }
  function goBack() {
    if (step===0) return;
    setDir('prev'); setAnimKey(k=>k+1);
    if (step===2 && userType) { setUserType(null); setStep(1); }
    else setStep(s=>Math.max(s-1,0));
  }
  function pickType(type: UserType) { setUserType(type); setDir('next'); setAnimKey(k=>k+1); setStep(2); }

  async function handleComplete() {
    setSaving(true);
    try {
      await fetch('/api/settings/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first_name:firstName.trim(),last_name:lastName.trim(),date_of_birth:dob||undefined})});
      if (userType==='consumer') {
        await fetch('/api/finances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          netto_inkomen:Math.round((parseFloat(netSalary)||0)*100),
          partner_inkomen:hasPartner?Math.round((parseFloat(partnerIncome)||0)*100):0,
          uitkering_inkomen:Math.round((parseFloat(benefitsVal)||0)*100),
          duo_inkomen:Math.round((parseFloat(studentFinance)||0)*100),
          overig_inkomen:Math.round((parseFloat(otherIncome)||0)*100),
          salary_day_from:parseInt(salaryDayFrom)||null,salary_day_to:parseInt(salaryDayTo)||null,
          has_partner:hasPartner,num_children:numChildren,
          monthly_rent:Math.round((parseFloat(monthlyRent)||0)*100),has_kinderopvang:hasChildcare,
        })});
        for (const [cat,amt] of Object.entries(expenses)) {
          if (amt > 0) await fetch('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat,name:cat,amount:amt*100,monthly_amount:amt*100,interval:'monthly'})});
        }
      }
      await fetch('/api/onboarding/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first_name:firstName.trim(),last_name:lastName.trim(),language,gemeente:gemeente||undefined,user_type:userType,scan_preference:Array.from(scanPrefs).join(',')||'none'})});
      window.location.href = '/overzicht';
    } catch { setSaving(false); }
  }

  // ── UI Helpers ──
  function Input({label,value,onChange,placeholder,type='text',explain}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;explain?:string}) {
    return (<div className="mb-4"><label className="block text-[12px] font-semibold text-pw-text mb-1.5">{label}</label>{explain&&<p className="text-[11px] text-pw-muted mb-1.5">{explain}</p>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-[8px] border border-pw-border bg-pw-surface px-3.5 py-3 text-[14px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue transition-colors" /></div>);
  }
  function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}) {
    return (<button onClick={()=>onChange(!value)} className="flex items-center justify-between w-full rounded-[8px] border border-pw-border bg-pw-surface px-3.5 py-3 mb-3 active:scale-[0.98] transition-transform"><span className="text-[14px] font-medium text-pw-text">{label}</span><div className={`w-11 h-6 rounded-full transition-colors ${value?'bg-pw-blue':'bg-pw-border'} relative`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${value?'translate-x-[22px]':'translate-x-0.5'}`}/></div></button>);
  }
  function Card({icon:I,label,sub,onClick}:{icon:React.ElementType;label:string;sub:string;onClick:()=>void}) {
    return (<button onClick={onClick} className="w-full flex items-start gap-3.5 rounded-[14px] border border-pw-border bg-pw-surface p-4 text-left transition-all active:scale-[0.97] mb-3 hover:border-pw-blue/30"><div className="w-10 h-10 rounded-xl bg-pw-bg text-pw-muted flex items-center justify-center shrink-0"><I className="w-5 h-5" strokeWidth={1.5}/></div><div className="flex-1 min-w-0"><p className="text-[14px] font-semibold text-pw-text">{label}</p><p className="text-[12px] text-pw-muted mt-0.5">{sub}</p></div><ChevronRight className="w-5 h-5 text-pw-muted shrink-0 mt-1"/></button>);
  }
  function ExpRow({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}) {
    return (<div className="flex items-center justify-between py-2.5 border-b border-pw-border/50 last:border-0"><span className="text-[13px] text-pw-text">{label}</span><div className="flex items-center gap-1"><span className="text-[13px] text-pw-muted mr-1">€</span><input type="number" inputMode="numeric" value={value||''} onChange={e=>onChange(parseInt(e.target.value)||0)} className="w-16 text-right rounded-[6px] border border-pw-border bg-pw-bg px-2 py-1.5 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none"/></div></div>);
  }
  function ScanOpt({icon:I,label,sub,id}:{icon:React.ElementType;label:string;sub?:string;id:string}) {
    const sel = scanPrefs.has(id);
    return (<button onClick={()=>{const n=new Set(scanPrefs);sel?n.delete(id):n.add(id);setScanPrefs(n);}} className={`w-full flex items-center gap-3 rounded-[10px] border p-3.5 mb-2.5 transition-all active:scale-[0.97] ${sel?'border-pw-blue bg-pw-blue/5':'border-pw-border bg-pw-surface'}`}><div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sel?'bg-pw-blue text-white':'bg-pw-bg text-pw-muted'}`}><I className="w-4 h-4" strokeWidth={1.5}/></div><div className="flex-1 text-left"><p className="text-[13px] font-semibold text-pw-text">{label}</p>{sub&&<p className="text-[11px] text-pw-muted">{sub}</p>}</div><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel?'border-pw-blue bg-pw-blue':'border-pw-border'}`}>{sel&&<Check className="w-3 h-3 text-white" strokeWidth={3}/>}</div></button>);
  }
  function SumRow({label,value,big}:{label:string;value:string;big?:boolean}) {
    return (<div className="flex items-center justify-between py-2.5 border-b border-pw-border/30 last:border-0"><span className="text-[13px] text-pw-muted">{label}</span><span className={big?'text-[18px] font-extrabold text-pw-blue':'text-[14px] font-semibold text-pw-text'}>{value}</span></div>);
  }
  function StepWrap({children,icon:I,title,sub}:{children:React.ReactNode;icon?:React.ElementType;title?:string;sub?:string}) {
    return (<div key={animKey} className={`flex-1 flex flex-col px-5 py-6 ${dir==='next'?'ob-enter-next':'ob-enter-prev'}`}>{I&&<div className="flex justify-center mb-5"><div className="w-16 h-16 rounded-2xl bg-pw-blue/10 flex items-center justify-center"><I className="w-8 h-8 text-pw-blue" strokeWidth={1.5}/></div></div>}{title&&<h1 className="text-[22px] font-bold text-pw-text text-center mb-1.5">{title}</h1>}{sub&&<p className="text-[13px] text-pw-muted text-center mb-6">{sub}</p>}<div className="flex-1">{children}</div></div>);
  }

  function renderStep() {
    switch(cur) {
      case 'welcome': return (<StepWrap icon={Shield} title={t.welcome} sub={t.tagline}><div className="mt-4 space-y-3"><p className="text-[13px] text-pw-muted text-center mb-4">{t.chooseLanguage}</p><div className="flex gap-3">{(['nl','en'] as const).map(l=>(<button key={l} onClick={()=>{setLanguage(l);document.cookie=`paywatch-locale=${l};path=/;max-age=31536000;samesite=lax`;}} className={`flex-1 py-3.5 rounded-[10px] border text-[14px] font-semibold transition-all active:scale-[0.97] ${language===l?'border-pw-blue bg-pw-blue text-white':'border-pw-border bg-pw-surface text-pw-text'}`}>{l==='nl'?'🇳🇱 Nederlands':'🇬🇧 English'}</button>))}</div></div></StepWrap>);

      case 'branch': return (<StepWrap title={t.whatBringsYou}><Card icon={ClipboardList} label={t.consumer} sub={t.consumerSub} onClick={()=>pickType('consumer')}/><Card icon={Users} label={t.buddy} sub={t.buddySub} onClick={()=>pickType('buddy')}/><Card icon={Briefcase} label={t.professional} sub={t.professionalSub} onClick={()=>pickType('professional')}/></StepWrap>);

      case 'name': case 'buddy-name': return (<StepWrap icon={Heart} title={t.yourName}><Input label={t.firstName} value={firstName} onChange={setFirstName} placeholder="bijv. Samba"/><Input label={t.lastName} value={lastName} onChange={setLastName} placeholder="bijv. Jarju"/>{cur==='name'&&<Input label={t.dateOfBirth} value={dob} onChange={setDob} type="date" explain={t.dobExplain}/>}</StepWrap>);

      case 'pro-name': return (<StepWrap icon={Briefcase} title={t.yourName}><Input label={t.firstName} value={firstName} onChange={setFirstName} placeholder="bijv. Samba"/><Input label={t.lastName} value={lastName} onChange={setLastName} placeholder="bijv. Jarju"/><Input label={t.organization} value={orgName} onChange={setOrgName} placeholder="bijv. Gemeente Rotterdam"/><div className="mb-4"><label className="block text-[12px] font-semibold text-pw-text mb-2">{t.role}</label><div className="grid grid-cols-2 gap-2">{['socialWorker','debtCounselor','budgetCoach','other'].map(r=>(<button key={r} onClick={()=>setProRole(r)} className={`py-2.5 px-3 rounded-[8px] border text-[12px] font-medium transition-all active:scale-[0.97] ${proRole===r?'border-pw-blue bg-pw-blue/5 text-pw-blue':'border-pw-border bg-pw-surface text-pw-text'}`}>{(t as Record<string,string>)[r]||r}</button>))}</div></div></StepWrap>);

      case 'city': case 'pro-city': return (<StepWrap icon={MapPin} title={t.yourCity} sub={t.cityExplain}><div className="relative mb-4"><Search className="absolute left-3 top-3 w-4 h-4 text-pw-muted" strokeWidth={1.5}/><input value={gemeente||citySearch} onChange={e=>{setCitySearch(e.target.value);setGemeente('');setShowCityDD(true);}} onFocus={()=>setShowCityDD(true)} placeholder={t.searchCity} className="w-full pl-9 pr-9 py-3 rounded-[8px] border border-pw-border bg-pw-surface text-[14px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"/>{gemeente&&<button onClick={()=>{setGemeente('');setCitySearch('');}} className="absolute right-3 top-3"><X className="w-4 h-4 text-pw-muted"/></button>}{showCityDD&&!gemeente&&<div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-[10px] border border-pw-border bg-pw-surface shadow-lg">{filteredCities.map(c=>(<button key={c} onClick={()=>{setGemeente(c);setCitySearch('');setShowCityDD(false);}} className="w-full text-left px-3.5 py-2.5 text-[13px] text-pw-text hover:bg-pw-bg transition-colors border-b border-pw-border/30 last:border-0">{c}</button>))}</div>}</div>{gemeente&&<div className="flex items-center gap-2 p-3 rounded-[10px] bg-pw-green/10 border border-pw-green/20"><Check className="w-4 h-4 text-pw-green" strokeWidth={2}/><span className="text-[13px] font-medium text-pw-green">{gemeente}</span></div>}</StepWrap>);

      case 'household': return (<StepWrap icon={Home} title={t.yourHousehold}><Toggle label={t.hasPartner} value={hasPartner} onChange={setHasPartner}/><div className="mb-4"><label className="block text-[12px] font-semibold text-pw-text mb-2">{t.children}</label><div className="flex items-center gap-3"><button onClick={()=>setNumChildren(Math.max(0,numChildren-1))} className="w-9 h-9 rounded-lg border border-pw-border bg-pw-surface flex items-center justify-center active:scale-95"><Minus className="w-4 h-4 text-pw-text"/></button><span className="text-[18px] font-bold text-pw-text w-8 text-center">{numChildren}</span><button onClick={()=>setNumChildren(Math.min(10,numChildren+1))} className="w-9 h-9 rounded-lg border border-pw-border bg-pw-surface flex items-center justify-center active:scale-95"><Plus className="w-4 h-4 text-pw-text"/></button></div></div><div className="mb-4"><label className="block text-[12px] font-semibold text-pw-text mb-2">{t.housing}</label><div className="grid grid-cols-2 gap-2">{(['rent','own','parents','other'] as const).map(h=>(<button key={h} onClick={()=>setHousing(h)} className={`py-2.5 rounded-[8px] border text-[12px] font-medium transition-all active:scale-[0.97] ${housing===h?'border-pw-blue bg-pw-blue/5 text-pw-blue':'border-pw-border bg-pw-surface text-pw-text'}`}>{(t as Record<string,string>)[h]}</button>))}</div></div>{housing==='rent'&&<Input label={t.monthlyRent} value={monthlyRent} onChange={setMonthlyRent} placeholder="bijv. 950" type="number"/>}{numChildren>0&&<Toggle label={t.childcare} value={hasChildcare} onChange={setHasChildcare}/>}</StepWrap>);

      case 'income': return (<StepWrap icon={Wallet} title={t.yourIncome}><Input label={t.netSalary} value={netSalary} onChange={setNetSalary} placeholder="bijv. 2400" type="number"/>{hasPartner&&<Input label={t.partnerIncome} value={partnerIncome} onChange={setPartnerIncome} placeholder="0" type="number"/>}<Input label={t.benefits} value={benefitsVal} onChange={setBenefitsVal} placeholder="0" type="number"/><Input label={t.studentFinance} value={studentFinance} onChange={setStudentFinance} placeholder="0" type="number"/><Input label={t.otherIncome} value={otherIncome} onChange={setOtherIncome} placeholder="0" type="number"/><div className="flex gap-2 mb-4"><div className="flex-1"><label className="block text-[12px] font-semibold text-pw-text mb-1.5">{t.dayFrom}</label><input type="number" inputMode="numeric" min="1" max="31" value={salaryDayFrom} onChange={e=>{const v=parseInt(e.target.value);setSalaryDayFrom(v>31?'31':e.target.value);}} placeholder="22" className="w-full rounded-[8px] border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none"/></div><div className="flex-1"><label className="block text-[12px] font-semibold text-pw-text mb-1.5">{t.dayTo}</label><input type="number" inputMode="numeric" min="1" max="31" value={salaryDayTo} onChange={e=>{const v=parseInt(e.target.value);setSalaryDayTo(v>31?'31':e.target.value);}} placeholder="25" className="w-full rounded-[8px] border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none"/></div></div>{totalInc>0&&<div className="p-3 rounded-[10px] bg-pw-blue/5 border border-pw-blue/20"><div className="flex justify-between"><span className="text-[12px] text-pw-muted">{t.totalIncome}</span><span className="text-[16px] font-bold text-pw-blue">{fmtE(totalInc)}</span></div></div>}</StepWrap>);

      case 'expenses': return (<StepWrap icon={Receipt} title={t.fixedExpenses} sub={t.quickSetup}><div className="rounded-[10px] border border-pw-border bg-pw-surface px-3.5"><ExpRow label={t.healthInsurance} value={expenses.zorgverzekering} onChange={v=>setExpenses({...expenses,zorgverzekering:v})}/><ExpRow label={t.energy} value={expenses.energie} onChange={v=>setExpenses({...expenses,energie:v})}/><ExpRow label={t.water} value={expenses.water} onChange={v=>setExpenses({...expenses,water:v})}/><ExpRow label={t.telecom} value={expenses.telecom} onChange={v=>setExpenses({...expenses,telecom:v})}/><ExpRow label={t.insurance} value={expenses.verzekering} onChange={v=>setExpenses({...expenses,verzekering:v})}/><ExpRow label={t.transport} value={expenses.vervoer} onChange={v=>setExpenses({...expenses,vervoer:v})}/></div><div className="mt-3 p-3 rounded-[10px] bg-pw-blue/5 border border-pw-blue/20"><div className="flex justify-between"><span className="text-[12px] text-pw-muted">{t.totalExpenses}</span><span className="text-[16px] font-bold text-pw-blue">{fmtE(totalExp)}{t.perMonth}</span></div></div></StepWrap>);

      case 'scanning': return (<StepWrap icon={Mail} title={t.howToAddBills}><ScanOpt icon={Mail} label={t.connectGmail} sub={t.gmailExplain} id="gmail"/><ScanOpt icon={Mail} label={t.connectOutlook} sub={t.gmailExplain} id="outlook"/><ScanOpt icon={Camera} label={t.scanCamera} id="camera"/><ScanOpt icon={ClipboardList} label={t.addManually} id="manual"/></StepWrap>);

      case 'safetynet': return (<StepWrap icon={UserPlus} title={t.safetyNet} sub={t.safetyExplain}><Input label={t.buddyEmail} value={buddyEmail} onChange={setBuddyEmail} placeholder="naam@email.com" type="email"/></StepWrap>);

      case 'summary': return (<StepWrap icon={Trophy} title={t.allSet}><div className="rounded-[14px] border border-pw-border bg-pw-surface p-4"><SumRow label={t.monthlyIncomeLabel} value={fmtE(totalInc)}/><SumRow label={t.fixedCostsLabel} value={`-${fmtE(totalExp)}`}/><SumRow label={t.disposableLabel} value={fmtE(Math.max(0,totalInc-totalExp))} big/><SumRow label={t.scanningLabel} value={scanPrefs.size>0?t.connected:t.notConnected}/><SumRow label={t.buddyLabel} value={buddyEmail?t.invited:t.noBuddy}/></div></StepWrap>);

      case 'buddy-invite': return (<StepWrap icon={Users} title={t.acceptInvite}><Input label={t.inviteCode} value={inviteCode} onChange={setInviteCode} placeholder="ABCD-1234"/></StepWrap>);
      case 'buddy-done': return (<StepWrap icon={Check} title={t.buddyConnected} sub={t.buddyDoneText}><div className="flex justify-center mt-6"><div className="w-20 h-20 rounded-full bg-pw-green/10 flex items-center justify-center"><Check className="w-10 h-10 text-pw-green" strokeWidth={2}/></div></div></StepWrap>);
      case 'pro-how': return (<StepWrap icon={HelpCircle} title={t.howItWorks}><div className="space-y-3">{[t.proStep1,t.proStep2,t.proStep3,t.proStep4].map((txt,i)=>(<div key={i} className="flex items-start gap-3 p-3 rounded-[10px] bg-pw-surface border border-pw-border"><div className="w-6 h-6 rounded-full bg-pw-blue text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i+1}</div><p className="text-[13px] text-pw-text">{txt}</p></div>))}</div></StepWrap>);
      case 'pro-done': return (<StepWrap icon={Check} title={t.proReady}><div className="flex justify-center mt-6"><div className="w-20 h-20 rounded-full bg-pw-green/10 flex items-center justify-center"><Check className="w-10 h-10 text-pw-green" strokeWidth={2}/></div></div></StepWrap>);
      default: return null;
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-pw-bg">
      <style jsx global>{`
        @keyframes ob-next{0%{opacity:0;transform:translateX(40px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes ob-prev{0%{opacity:0;transform:translateX(-40px)}100%{opacity:1;transform:translateX(0)}}
        .ob-enter-next{animation:ob-next .35s cubic-bezier(.16,1,.3,1) both}
        .ob-enter-prev{animation:ob-prev .35s cubic-bezier(.16,1,.3,1) both}
      `}</style>
      {step>0&&<div className="px-5 pt-4"><div className="h-1 w-full bg-pw-border/50 rounded-full overflow-hidden"><div className="h-full bg-pw-blue rounded-full transition-all duration-500 ease-out" style={{width:`${progress}%`}}/></div><p className="text-[11px] text-pw-muted text-center mt-1.5">{step}/{total-1}</p></div>}
      <div className="flex-1 flex flex-col">{renderStep()}</div>
      <div className="px-5 pb-8 pt-2 space-y-2">
        {skippable&&!isLast&&<button onClick={goNext} className="w-full py-2.5 text-[13px] font-semibold text-pw-muted active:scale-[0.97] transition-transform">{t.skip}</button>}
        {cur!=='branch'&&<div className="flex gap-3">
          {step>0&&<button onClick={goBack} className="w-12 h-12 rounded-[8px] border border-pw-border bg-pw-surface flex items-center justify-center active:scale-95 transition-transform shrink-0"><ChevronLeft className="w-5 h-5 text-pw-text" strokeWidth={1.5}/></button>}
          <button onClick={isLast?handleComplete:goNext} disabled={!canNext||saving} className={`flex-1 h-12 rounded-[8px] text-[14px] font-semibold text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-all ${canNext&&!saving?'bg-pw-blue':'bg-pw-blue/40'}`}>
            {saving?<><Loader2 className="w-4 h-4 animate-spin"/>{t.saving}</>:isLast?<>{t.goToDashboard}<ChevronRight className="w-4 h-4"/></>:<>{t.next}<ChevronRight className="w-4 h-4"/></>}
          </button>
        </div>}
      </div>
    </main>
  );
}
