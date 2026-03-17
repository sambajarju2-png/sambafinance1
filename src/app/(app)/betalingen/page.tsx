import { Suspense } from 'react';
import BillList from './bill-list';

export default function BetalingenPage() {
  return (
    <Suspense fallback={<div className="space-y-2"><div className="skeleton h-7 w-32 rounded-input" /><div className="skeleton h-[72px] rounded-card" /><div className="skeleton h-[72px] rounded-card" /></div>}>
      <BillList />
    </Suspense>
  );
}
