/**
 * Shown in place of a feature's UI when the user's organisation doesn't grant it
 * (org-feature gating). Only ever rendered when ENFORCE_ORG_FEATURES is on and the
 * connected user's orgs don't include the feature.
 */
export default function FeatureUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[15px] font-semibold text-pw-navy">Niet beschikbaar</p>
      <p className="mt-1 max-w-xs text-[13px] text-pw-muted">
        Deze functie is niet beschikbaar via jouw organisatie.
      </p>
    </div>
  );
}
