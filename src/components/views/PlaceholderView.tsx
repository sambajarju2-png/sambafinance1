'use client'
import { Construction } from 'lucide-react'
export default function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-blue-pale flex items-center justify-center mb-4"><Construction className="w-6 h-6 text-brand-blue" /></div>
      <h2 className="text-[16px] font-bold text-navy mb-1.5">{title}</h2>
      <p className="text-[13px] text-muted max-w-[300px]">{description}</p>
    </div>
  )
}
