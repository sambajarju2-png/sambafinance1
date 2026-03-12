export type BillCategory = 'Energie'|'Telecom'|'Verzekering'|'Lease'|'Abonnement'|'Huur'|'Belasting'|'Overig'|'Incasso'|'Zakelijk'|'Zorgverzekering'|'Software'
export type BillStatus = 'outstanding'|'action'|'settled'|'failed'|'review'
export type Urgency = 'critical'|'warn'|'info'
export type AssignedTo = 'mine'|'partner'|'joint'
export type Household = 'joint'|'mine'|'partner'
export interface MockBill {
  id:string;vendor:string;initials:string;avatarBg:string;avatarFg:string;category:string
  assignedTo:AssignedTo;amount:number|null;dueDate:string|null;description:string;reference:string
  iban:string|null;urgency:Urgency;isDuplicate:boolean;status:BillStatus;paidAt:string|null
}
export const MOCK_BILLS: MockBill[] = []
export const MOCK_PAID: MockBill[] = []
export const CATEGORY_DATA = [
  {name:'Zakelijk',amount:242000,color:'#2563EB',budget:250000},
  {name:'Incasso',amount:36628,color:'#DC2626',budget:40000},
  {name:'Energie',amount:21600,color:'#D97706',budget:25000},
  {name:'Lease',amount:18474,color:'#7C3AED',budget:20000},
  {name:'Zorgverzekering',amount:7700,color:'#059669',budget:10000},
  {name:'Telecom',amount:5650,color:'#0369A1',budget:8000},
  {name:'Software',amount:602,color:'#94A3B8',budget:5000},
]
export const CASHFLOW_DATA = [
  {month:'Jan',amount:124000,predicted:false},{month:'Feb',amount:98000,predicted:false},
  {month:'Mrt',amount:332052,predicted:false},{month:'Apr',amount:89050,predicted:true},
  {month:'Mei',amount:76000,predicted:true},{month:'Jun',amount:82000,predicted:true},
]
export function formatAmount(cents:number|null):string {
  if(cents===null)return'—'
  return `€\u00A0${(cents/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}
export function formatDate(dateStr:string|null):string {
  if(!dateStr)return'—'
  return new Date(dateStr).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'})
}
export function daysUntil(dateStr:string|null):number|null {
  if(!dateStr)return null
  const today=new Date();today.setHours(0,0,0,0)
  const target=new Date(dateStr);target.setHours(0,0,0,0)
  return Math.round((target.getTime()-today.getTime())/86400000)
}
export function getStats(bills:MockBill[]) {
  const open=bills.filter(b=>b.status!=='settled')
  const critical=open.filter(b=>b.urgency==='critical')
  const warn=open.filter(b=>b.urgency==='warn')
  const sumCents=(arr:MockBill[])=>arr.reduce((s,b)=>s+(b.amount??0),0)
  return {
    criticalAmount:sumCents(critical),criticalCount:critical.length,
    warnAmount:sumCents(warn),warnCount:warn.length,
    failedCount:open.filter(b=>b.description.toLowerCase().includes('mislukt')||b.description.toLowerCase().includes('stornering')).length,
    totalAmount:sumCents(open),totalCount:open.length,
  }
}
