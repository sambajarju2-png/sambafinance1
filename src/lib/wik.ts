/**
 * Dutch WIK (Wet Incassokosten) Calculator
 *
 * Calculates the maximum allowed collection costs according to Dutch law.
 * These are the extra costs a collection agency can legally charge on top
 * of the original bill amount.
 *
 * The WIK uses a sliding scale based on the original amount.
 *
 * SERVER + CLIENT safe — no Node.js dependencies.
 */

/**
 * Calculate WIK (Wet Incassokosten) costs in cents.
 *
 * @param amountCents - The original bill amount in cents
 * @returns The maximum allowed collection costs in cents
 *
 * Scale:
 * - Over first €2,500:    15% (minimum €40)
 * - Over next €2,500:     10%
 * - Over next €5,000:     5%
 * - Over next €190,000:   1%
 * - Over €200,000:        0.5%
 * - Maximum: €6,775
 */
export function calculateWIKCosts(amountCents: number): number {
  const amount = amountCents / 100;

  if (amount <= 0) return 0;

  let costs = 0;

  if (amount <= 2500) {
    costs = Math.max(40, amount * 0.15);
  } else if (amount <= 5000) {
    costs = 375 + (amount - 2500) * 0.10;
  } else if (amount <= 10000) {
    costs = 625 + (amount - 5000) * 0.05;
  } else if (amount <= 200000) {
    costs = 875 + (amount - 10000) * 0.01;
  } else {
    costs = 2775 + (amount - 200000) * 0.005;
  }

  // Maximum allowed by law: €6,775
  const capped = Math.min(costs, 6775);

  // Return in cents, rounded to whole cents
  return Math.round(capped * 100);
}

/**
 * Get a human-readable description of the escalation stage.
 *
 * @param stage - The escalation stage
 * @param language - 'nl' or 'en'
 * @returns Description of what this stage means
 */
export function getStageDescription(
  stage: string,
  language: string = 'nl'
): { meaning: string; action: string; urgency: 'normal' | 'warning' | 'urgent' | 'critical' | 'legal' } {
  const descriptions: Record<string, Record<string, { meaning: string; action: string; urgency: 'normal' | 'warning' | 'urgent' | 'critical' | 'legal' }>> = {
    factuur: {
      nl: {
        meaning: 'Dit is een gewone factuur. Betaal voor de vervaldatum om extra kosten te voorkomen.',
        action: 'Betaal voor de vervaldatum',
        urgency: 'normal',
      },
      en: {
        meaning: 'This is a regular invoice. Pay before the due date to avoid extra costs.',
        action: 'Pay before the due date',
        urgency: 'normal',
      },
    },
    herinnering: {
      nl: {
        meaning: 'Je hebt een betalingsherinnering ontvangen. De oorspronkelijke vervaldatum is verstreken.',
        action: 'Betaal zo snel mogelijk of neem contact op met de afzender',
        urgency: 'warning',
      },
      en: {
        meaning: 'You received a payment reminder. The original due date has passed.',
        action: 'Pay as soon as possible or contact the sender',
        urgency: 'warning',
      },
    },
    aanmaning: {
      nl: {
        meaning: 'Dit is een formele aanmaning. Na deze stap kan een incassobureau worden ingeschakeld, met extra kosten.',
        action: 'Betaal binnen 14 dagen om incassokosten te voorkomen',
        urgency: 'urgent',
      },
      en: {
        meaning: 'This is a formal notice. After this step, a collection agency may be involved, with extra costs.',
        action: 'Pay within 14 days to avoid collection costs',
        urgency: 'urgent',
      },
    },
    incasso: {
      nl: {
        meaning: 'Een incassobureau is ingeschakeld. Er worden WIK-incassokosten bovenop het oorspronkelijke bedrag berekend.',
        action: 'Neem contact op met het incassobureau of schakel hulp in',
        urgency: 'critical',
      },
      en: {
        meaning: 'A collection agency has been involved. WIK collection costs are being charged on top of the original amount.',
        action: 'Contact the collection agency or seek help',
        urgency: 'critical',
      },
    },
    deurwaarder: {
      nl: {
        meaning: 'Een gerechtsdeurwaarder is ingeschakeld. Dit kan leiden tot beslaglegging of een rechtszaak.',
        action: 'Schakel juridische hulp in via het Juridisch Loket (0900-8020)',
        urgency: 'legal',
      },
      en: {
        meaning: 'A bailiff has been involved. This may lead to seizure of assets or legal proceedings.',
        action: 'Seek legal help through Juridisch Loket (0900-8020)',
        urgency: 'legal',
      },
    },
  };

  return descriptions[stage]?.[language] || descriptions.factuur[language] || descriptions.factuur.nl;
}
