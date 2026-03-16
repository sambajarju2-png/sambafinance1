'use server';

import { setUserLocale, type Locale } from './routing';

export async function switchLocale(locale: Locale): Promise<void> {
  await setUserLocale(locale);
}
