'use client'
export type Household = 'joint' | 'mine' | 'partner'
interface HouseholdSwitcherProps { active: Household; onChange: (hh: Household) => void; partnerName: string }
const TABS: { id: Household; dot: string }[] = [{id:'joint',dot:'#2563EB'},{id:'mine',dot:'#059669'},{id:'partner',dot:'#7C3AED'}]
function getLabel(id: Household, pn: string): string { switch(id){case'joint':return'Samen';case'mine':return'Samba';case'partner':return pn} }
export default function HouseholdSwitcher({ active, onChange, partnerName }: HouseholdSwitcherProps) {
  return (
    <div className="flex gap-[3px] bg-surface-2 border border-border rounded-[10px] p-[3px]">
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all duration-150 whitespace-nowrap ${active===tab.id?'bg-surface text-navy shadow-card':'text-muted hover:text-navy'}`}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:tab.dot}}/>{getLabel(tab.id, partnerName)}
        </button>
      ))}
    </div>
  )
}
