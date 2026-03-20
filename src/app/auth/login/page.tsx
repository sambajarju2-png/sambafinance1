import AuthForm from '../auth-form';
import TrustBadges, { TrustText } from '@/components/trust-badges';
import AuthHeader from '@/components/auth-header';

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AuthHeader />
      <TrustBadges />
      <div className="flex-1"><AuthForm mode="login" /></div>
      <TrustText />
    </div>
  );
}
