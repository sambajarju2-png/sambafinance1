import AuthForm from '../auth-form';
import TrustBadges, { TrustText } from '@/components/trust-badges';

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TrustBadges />
      <div className="flex-1"><AuthForm mode="signup" /></div>
      <TrustText />
    </div>
  );
}
