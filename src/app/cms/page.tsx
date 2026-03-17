import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function CmsIndexPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F8FAFB] px-6 text-center">
      <Shield className="h-10 w-10 text-[#2563EB]" strokeWidth={1.5} />
      <h1 className="mt-4 text-[22px] font-bold text-[#0A2540]">PayWatch Helpcentrum</h1>
      <p className="mt-2 text-[14px] text-[#64748B]">
        Hier vind je binnenkort hulppagina&apos;s, veelgestelde vragen en meer.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-[#0A2540] px-5 py-2.5 text-[13px] font-semibold text-white"
      >
        Terug naar home
      </Link>
    </div>
  );
}
