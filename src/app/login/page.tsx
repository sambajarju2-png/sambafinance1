'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { CreditCard, Loader2, Eye, EyeOff } from 'lucide-react'
export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<'login'|'register'|'forgot'>('login')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false); const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false)
  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    if (mode==='forgot') { const {error}=await resetPassword(email); if(error)setError(error); else setSuccess(true); setLoading(false); return }
    if (mode==='login') { const {error}=await signIn(email,password); if(error)setError(error) }
    else { if(!name.trim()){setError('Vul je naam in');setLoading(false);return}; const {error}=await signUp(email,password,name.trim()); if(error)setError(error); else setSuccess(true) }
    setLoading(false)
  }
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-gradient-to-br from-brand-blue-hover to-blue-700 rounded-[9px] flex items-center justify-center shadow-[0_2px_10px_rgba(37,99,235,.4)]"><CreditCard className="w-[18px] h-[18px] text-white" /></div>
        <span className="text-[20px] font-extrabold text-navy tracking-tight">Pay<span className="text-blue-400">Watch</span></span>
      </div>
      <div className="w-full max-w-[380px] bg-surface border border-border rounded-card shadow-card overflow-hidden">
        <div className="flex border-b border-border">
          <button onClick={()=>{setMode('login');setError(null);setSuccess(false)}} className={`flex-1 py-3.5 text-[13px] font-bold text-center border-b-2 transition-colors ${mode==='login'?'text-brand-blue border-brand-blue':'text-muted border-transparent hover:text-navy'}`}>Inloggen</button>
          <button onClick={()=>{setMode('register');setError(null);setSuccess(false)}} className={`flex-1 py-3.5 text-[13px] font-bold text-center border-b-2 transition-colors ${mode==='register'?'text-brand-blue border-brand-blue':'text-muted border-transparent hover:text-navy'}`}>Registreren</button>
        </div>
        <div className="px-6 py-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-status-green-pale flex items-center justify-center mx-auto mb-3"><span className="text-[20px]">✓</span></div>
              <h3 className="text-[15px] font-bold text-navy mb-1.5">{mode==='forgot'?'E-mail verzonden':'Account aangemaakt'}</h3>
              <p className="text-[13px] text-muted mb-4">{mode==='forgot'?'Controleer je inbox voor de wachtwoord-reset link.':'Je kunt nu inloggen met je e-mailadres en wachtwoord.'}</p>
              <button onClick={()=>{setMode('login');setSuccess(false)}} className="text-[13px] font-bold text-brand-blue hover:text-brand-blue-hover transition-colors">Ga naar inloggen →</button>
            </div>
          ) : (
            <>
              <h2 className="text-[16px] font-bold text-navy mb-1">{mode==='login'?'Welkom terug':mode==='register'?'Maak een account':'Wachtwoord vergeten'}</h2>
              <p className="text-[13px] text-muted mb-5">{mode==='login'?'Log in om je betalingen te beheren':mode==='register'?'Begin met het bijhouden van je huishoudelijke financiën':'Vul je e-mailadres in om een reset-link te ontvangen'}</p>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode==='register'&&(<div><label className="block text-[12px] font-bold text-navy uppercase tracking-[.05em] mb-1.5">Naam</label><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Bijv. Samba Jarju" className="w-full px-3.5 py-2.5 border border-border rounded-lg text-[13px] text-txt bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans placeholder:text-muted-light" autoComplete="name"/></div>)}
                <div><label className="block text-[12px] font-bold text-navy uppercase tracking-[.05em] mb-1.5">E-mailadres</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="naam@voorbeeld.nl" required className="w-full px-3.5 py-2.5 border border-border rounded-lg text-[13px] text-txt bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans placeholder:text-muted-light" autoComplete="email"/></div>
                {mode!=='forgot'&&(<div><label className="block text-[12px] font-bold text-navy uppercase tracking-[.05em] mb-1.5">Wachtwoord</label><div className="relative"><input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'Minimaal 6 tekens':'••••••••'} required minLength={6} className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-lg text-[13px] text-txt bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans placeholder:text-muted-light" autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-light hover:text-muted transition-colors">{showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div>{mode==='login'&&(<button type="button" onClick={()=>{setMode('forgot');setError(null);setSuccess(false)}} className="mt-1.5 text-[12px] text-brand-blue font-semibold hover:text-brand-blue-hover transition-colors">Wachtwoord vergeten?</button>)}</div>)}
                {error&&(<div className="px-3.5 py-2.5 bg-status-red-pale border border-status-red-mid rounded-lg text-[12.5px] text-status-red font-medium">{error}</div>)}
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-navy text-white text-[13px] font-bold hover:bg-navy-light disabled:opacity-60 transition-colors">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:mode==='login'?'Inloggen':mode==='forgot'?'Stuur reset-link':'Account aanmaken'}</button>
                {mode==='forgot'&&(<button type="button" onClick={()=>{setMode('login');setError(null)}} className="w-full text-center text-[12.5px] text-brand-blue font-semibold hover:text-brand-blue-hover transition-colors mt-1">← Terug naar inloggen</button>)}
              </form>
            </>
          )}
        </div>
      </div>
      <p className="text-[11.5px] text-muted-light mt-6">Huishoudelijke financiën overzichtelijk beheerd</p>
    </div>
  )
}
