/**
 * Country and City Data
 * Contains localized country and city information
 */

export interface LocalizedLabel {
  en: string;
  ar: string;
}

export interface CountryData {
  value: string;
  label: LocalizedLabel;
  cities: {
    en: string[];
    ar: string[];
  };
}

export const COUNTRIES: CountryData[] = [
  {
    value: 'Yemen',
    label: { en: 'Yemen', ar: 'اليمن' },
    cities: {
      en: ['Sana\'a', 'Aden', 'Taiz', 'Hodeidah', 'Ibb', 'Dhamar', 'Mukalla', 'Seiyun', 'Amran', 'Hajjah'],
      ar: ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'ذمار', 'المكلا', 'سيئون', 'عمران', 'حجة']
    }
  },
  {
    value: 'Saudi Arabia',
    label: { en: 'Saudi Arabia', ar: 'المملكة العربية السعودية' },
    cities: {
      en: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha', 'Jizan'],
      ar: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'تبوك', 'أبها', 'جازان']
    }
  },
  {
    value: 'Egypt',
    label: { en: 'Egypt', ar: 'مصر' },
    cities: {
      en: ['Cairo', 'Alexandria', 'Giza', 'Shubra El Kheima', 'Port Said', 'Suez', 'Luxor', 'Mansoura', 'Tanta'],
      ar: ['القاهرة', 'الإسكندرية', 'الجيزة', 'شبرا الخيمة', 'بورسعيد', 'السويس', 'الأقصر', 'المنصورة', 'طنطا']
    }
  },
  {
    value: 'UAE',
    label: { en: 'UAE', ar: 'الإمارات العربية المتحدة' },
    cities: {
      en: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah'],
      ar: ['دبي', 'أبو ظبي', 'الشارقة', 'العين', 'عجمان', 'رأس الخيمة', 'الفجيرة']
    }
  }
];
