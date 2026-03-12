'use client'
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { User, Session } from '@supabase/supabase-js'
interface AuthContextType {
  user: User|null; session: Session|null; loading: boolean
  signIn: (email:string,password:string)=>Promise<{error:string|null}>
  signUp: (email:string,password:string,name:string)=>Promise<{error:string|null}>
  signOut: ()=>Promise<void>
  resetPassword: (email:string)=>Promise<{error:string|null}>
}
const AuthContext = createContext<AuthContextType>({
  user:null,session:null,loading:true,
  signIn:async()=>({error:null}),signUp:async()=>({error:null}),signOut:async()=>{},resetPassword:async()=>({error:null}),
})
export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null)
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    getSupabaseBrowser().auth.getSession().then(({data:{session}})=>{setSession(session);setUser(session?.user??null);setLoading(false)})
    const {data:{subscription}}=getSupabaseBrowser().auth.onAuthStateChange((_event,session)=>{setSession(session);setUser(session?.user??null);setLoading(false)})
    return ()=>subscription.unsubscribe()
  },[])
  const signIn=useCallback(async(email:string,password:string)=>{
    const {error,data}=await getSupabaseBrowser().auth.signInWithPassword({email,password})
    if(error){
      const msg=error.message==='Invalid login credentials'?'Onjuist e-mailadres of wachtwoord':error.message==='Email not confirmed'?'Bevestig eerst je e-mailadres':error.message
      return {error:msg}
    }
    if(data.user) await createDefaultSettings(data.user.id,data.user.user_metadata?.name||'')
    return {error:null}
  },[])
  const signUp=useCallback(async(email:string,password:string,name:string)=>{
    const {error,data}=await getSupabaseBrowser().auth.signUp({email,password,options:{data:{name}}})
    if(error){
      const msg=error.message==='User already registered'?'Er bestaat al een account met dit e-mailadres':error.message.includes('Password')?'Wachtwoord moet minimaal 6 tekens bevatten':error.message
      return {error:msg}
    }
    if(data.user) await createDefaultSettings(data.user.id,name)
    return {error:null}
  },[])
  const signOut=useCallback(async()=>{await getSupabaseBrowser().auth.signOut()},[])
  const resetPassword=useCallback(async(email:string)=>{
    const {error}=await getSupabaseBrowser().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/`})
    return error?{error:error.message}:{error:null}
  },[])
  return <AuthContext.Provider value={{user,session,loading,signIn,signUp,signOut,resetPassword}}>{children}</AuthContext.Provider>
}
export function useAuth(){return useContext(AuthContext)}
async function createDefaultSettings(userId:string,name:string){
  try{await fetch('/api/settings/init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,name})})}catch{}
}
