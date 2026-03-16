import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <h1 className="text-hero text-navy">404</h1>
      <p className="text-body text-muted mt-2 mb-6">Pagina niet gevonden</p>
      <Link
        href="/dashboard"
        className="btn-press px-4 py-2.5 bg-blue text-white text-[13px] font-semibold rounded-btn"
      >
        Terug naar overzicht
      </Link>
    </div>
  );
}
