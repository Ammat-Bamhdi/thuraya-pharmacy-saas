/**
 * Currency Data
 * Contains currency information with localization
 */

import { LocalizedLabel } from './countries.const';

export interface CurrencyData {
  value: string;
  label: LocalizedLabel;
}

export const CURRENCIES: CurrencyData[] = [
  { value: 'YER', label: { en: 'Yemeni Rial (YER)', ar: 'ريال يمني (YER)' } },
  { value: 'USD', label: { en: 'US Dollar (USD)', ar: 'دولار أمريكي (USD)' } },
  { value: 'SAR', label: { en: 'Saudi Riyal (SAR)', ar: 'ريال سعودي (SAR)' } },
  { value: 'EGP', label: { en: 'Egyptian Pound (EGP)', ar: 'جنيه مصري (EGP)' } },
  { value: 'AED', label: { en: 'UAE Dirham (AED)', ar: 'درهم إماراتي (AED)' } }
];
