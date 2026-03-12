'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DbBill } from '@/lib/types'
interface UseBillsReturn {
  bills:DbBill[];paidBills:DbBill[];loading:boolean;error:string|null;seeded:boolean
  refetch:()=>Promise<void>;markPaid:(id:string)=>Promise<void>;undoPaid:(id:string)=>Promise<void>
  bulkMarkPaid:(ids:string[])=>Promise<void>;updateBill:(id:string,updates:Partial<DbBill>)=>Promise<void>;seed:()=>Promise<void>
}
export function useBills(accessToken:string|null):UseBillsReturn {
  const [bills,setBills]=useState<DbBill[]>([])
  const [paidBills,setPaidBills]=useState<DbBill[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [seeded,setSeeded]=useState(false)
  const authHeaders=useCallback(():Record<string,string>=>{
    const h:Record<string,string>={'Content-Type':'application/json'}
    if(accessToken)h['Authorization']=`Bearer ${accessToken}`
    return h
  },[accessToken])
  const fetchBills=useCallback(async()=>{
    if(!accessToken){setLoading(false);return}
    try{
      setError(null);const headers=authHeaders();const t=Date.now()
      const [openRes,paidRes]=await Promise.all([
        fetch(`/api/bills?status=outstanding&_t=${t}`,{headers,cache:'no-store'}),
        fetch(`/api/bills?status=settled&_t=${t}`,{headers,cache:'no-store'}),
      ])
      if(!openRes.ok||!paidRes.ok){const errBody=await(openRes.ok?paidRes:openRes).json();throw new Error(errBody.error||'Failed to fetch bills')}
      const openData=await openRes.json();const paidData=await paidRes.json()
      setBills(openData.data);setPaidBills(paidData.data)
      setSeeded(openData.data.length>0||paidData.data.length>0)
    }catch(err:unknown){setError(err instanceof Error?err.message:'Unknown error')}
    finally{setLoading(false)}
  },[accessToken,authHeaders])
  useEffect(()=>{fetchBills()},[fetchBills])
  const markPaid=useCallback(async(id:string)=>{
    try{const res=await fetch(`/api/bills/${id}`,{method:'PATCH',headers:authHeaders(),body:JSON.stringify({status:'settled'})});if(!res.ok){const e=await res.json();throw new Error(e.error||'Failed')};await fetchBills()}catch(err:unknown){setError(err instanceof Error?err.message:'Unknown error')}
  },[authHeaders,fetchBills])
  const undoPaid=useCallback(async(id:string)=>{
    try{const res=await fetch(`/api/bills/${id}`,{method:'PATCH',headers:authHeaders(),body:JSON.stringify({status:'outstanding'})});if(!res.ok){const e=await res.json();throw new Error(e.error||'Failed')};await fetchBills()}catch(err:unknown){setError(err instanceof Error?err.message:'Unknown error')}
  },[authHeaders,fetchBills])
  const bulkMarkPaid=useCallback(async(ids:string[])=>{
    try{await Promise.all(ids.map(id=>fetch(`/api/bills/${id}`,{method:'PATCH',headers:authHeaders(),body:JSON.stringify({status:'settled'})})));await fetchBills()}catch(err:unknown){setError(err instanceof Error?err.message:'Unknown error')}
  },[fetchBills,authHeaders])
  const updateBill=useCallback(async(id:string,updates:Partial<DbBill>)=>{
    try{const res=await fetch(`/api/bills/${id}`,{method:'PATCH',headers:authHeaders(),body:JSON.stringify(updates)});if(!res.ok){const e=await res.json();throw new Error(e.error||'Failed')};await fetchBills()}catch(err:unknown){setError(err instanceof Error?err.message:'Unknown error')}
  },[authHeaders,fetchBills])
  const seed=useCallback(async()=>{
    try{setLoading(true);const res=await fetch('/api/seed',{method:'POST',headers:authHeaders()});if(!res.ok){const e=await res.json();throw new Error(e.error||'Seed failed')};setSeeded(true);await fetchBills()}catch(err:unknown){setError(err instanceof Error?err.message:'Unknown error')}finally{setLoading(false)}
  },[fetchBills,authHeaders])
  return {bills,paidBills,loading,error,seeded,refetch:fetchBills,markPaid,undoPaid,bulkMarkPaid,updateBill,seed}
}
