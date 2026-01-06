/**
 * Onboarding Localization Strings
 * All text content for the onboarding flow
 */

export interface OnboardingTranslations {
  steps: { 1: string; 2: string; 3: string; 4: string };
  logout: string;
  org: {
    title: string;
    subtitle: string;
    name: string;
    country: string;
    currency: string;
    continue: string;
  };
  branch: {
    title: string;
    subtitle: string;
    name: string;
    namePH: string;
    loc: string;
    locPH: string;
    add: string;
    listEmpty: string;
    back: string;
    next: string;
    invalidCity: string;
    single: string;
    bulk: string;
    bulkPH: string;
    bulkColumns: string;
    downloadSample: string;
    addBulk: string;
  };
  team: {
    title: string;
    subtitle: string;
    single: string;
    bulk: string;
    name: string;
    namePH: string;
    email: string;
    emailPH: string;
    role: string;
    branch: string;
    branchPH: string;
    roles: {
      branch_admin: string;
      section_admin: string;
    };
    bulkPH: string;
    bulkColumns: string;
    downloadSample: string;
    add: string;
    addBulk: string;
    listEmpty: string;
    skip: string;
    finish: string;
    skipWarningTitle: string;
    skipWarningText: string;
    yesProceed: string;
    noStay: string;
  };
  prov: {
    title: string;
    doneTitle: string;
    doneDesc: string;
    button: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
  footer: string;
  graph: {
    hq: string;
    location: string;
    noManager: string;
    staff: string;
    branches: string;
  };
}

export const ONBOARDING_I18N: Record<'en' | 'ar', OnboardingTranslations> = {
  en: {
    steps: { 1: 'Organization', 2: 'Branch Network', 3: 'Build Team', 4: 'Provisioning' },
    logout: 'Sign Out',
    org: {
      title: 'Create your Organization',
      subtitle: 'Set up your pharmacy chain details.',
      name: 'Organization Name',
      country: 'Country',
      currency: 'Currency',
      continue: 'Continue'
    },
    branch: {
      title: 'Branch Structure',
      subtitle: 'Define your network topology.',
      name: 'Branch Name',
      namePH: 'e.g. Sana\'a Central',
      loc: 'Location / City',
      locPH: 'Search City...',
      add: 'Add Branch Node',
      listEmpty: 'No branches added yet.',
      back: 'Back',
      next: 'Next Step',
      invalidCity: 'Please select a valid city from the list.',
      single: 'Single Branch',
      bulk: 'Bulk Import',
      bulkPH: 'Drag and drop Excel (.xlsx) or CSV file here',
      bulkColumns: 'Columns: Name, Location, Code (Optional)',
      downloadSample: 'Download Sample Template',
      addBulk: 'Processing Branches...'
    },
    team: {
      title: 'Build your Team',
      subtitle: 'Invite key staff members to help manage your pharmacy.',
      single: 'Single Invite',
      bulk: 'Bulk Import',
      name: 'Full Name',
      namePH: 'Ex. Dr. Sara',
      email: 'Email',
      emailPH: 'email@pharmacy.com',
      role: 'Role',
      branch: 'Assign Branch',
      branchPH: 'Select Branch',
      roles: {
        branch_admin: 'Branch Manager',
        section_admin: 'Pharmacist / Staff'
      },
      bulkPH: 'Drag and drop Excel (.xlsx) or CSV file here',
      bulkColumns: 'Columns: Name, Email, Role, Branch',
      downloadSample: 'Download Sample Template',
      add: 'Add Member',
      addBulk: 'Processing...',
      listEmpty: 'No team members added yet.',
      skip: 'Skip for now',
      finish: 'Finish Setup',
      skipWarningTitle: 'Warning',
      skipWarningText: 'All data for the Build Team will be lost. Do you want to proceed?',
      yesProceed: 'Yes, Proceed',
      noStay: 'No, Stay'
    },
    prov: {
      title: 'Setting up...',
      doneTitle: 'You\'re all set!',
      doneDesc: 'Your pharmacy ecosystem is ready.',
      button: 'Go to Dashboard',
      step1: 'Creating secure tenant database...',
      step2: 'Provisioning {0} branches...',
      step3: 'Inviting {0} team members...',
      step4: 'Finalizing dashboard configuration...'
    },
    footer: '© 2025 Thuraya Systems.',
    graph: {
      hq: 'HQ',
      location: 'Location',
      noManager: 'No manager',
      staff: 'Staff',
      branches: 'Branches'
    }
  },
  ar: {
    steps: { 1: 'المؤسسة', 2: 'شبكة الفروع', 3: 'فريق العمل', 4: 'التجهيز' },
    logout: 'تسجيل الخروج',
    org: {
      title: 'إنشاء المؤسسة',
      subtitle: 'قم بإعداد تفاصيل سلسلة الصيدليات الخاصة بك.',
      name: 'اسم المؤسسة',
      country: 'الدولة',
      currency: 'العملة',
      continue: 'استمرار'
    },
    branch: {
      title: 'هيكل الفروع',
      subtitle: 'حدد هيكلية شبكة الفروع الخاصة بك.',
      name: 'اسم الفرع',
      namePH: 'مثال: فرع صنعاء الرئيسي',
      loc: 'الموقع / المدينة',
      locPH: 'ابحث عن المدينة...',
      add: 'إضافة فرع',
      listEmpty: 'لم يتم إضافة فروع بعد.',
      back: 'رجوع',
      next: 'الخطوة التالية',
      invalidCity: 'يرجى اختيار مدينة صحيحة من القائمة.',
      single: 'فرع فردي',
      bulk: 'استيراد جماعي',
      bulkPH: 'اسحب وأفلت ملف Excel (.xlsx) أو CSV هنا',
      bulkColumns: 'الأعمدة: الاسم، الموقع، الكود (اختياري)',
      downloadSample: 'تحميل نموذج Excel',
      addBulk: 'جاري معالجة الفروع...'
    },
    team: {
      title: 'بناء الفريق',
      subtitle: 'قم بدعوة الموظفين الرئيسيين لإدارة الصيدلية.',
      single: 'دعوة فردية',
      bulk: 'إضافة جماعية',
      name: 'الاسم الكامل',
      namePH: 'مثال: د. سارة',
      email: 'البريد الإلكتروني',
      emailPH: 'email@pharmacy.com',
      role: 'الدور الوظيفي',
      branch: 'تعيين الفرع',
      branchPH: 'اختر الفرع',
      roles: {
        branch_admin: 'مدير فرع',
        section_admin: 'صيدلي / موظف'
      },
      bulkPH: 'اسحب وأفلت ملف Excel (.xlsx) أو CSV هنا',
      bulkColumns: 'الأعمدة: الاسم، البريد، الدور، الفرع',
      downloadSample: 'تحميل نموذج Excel',
      add: 'إضافة عضو',
      addBulk: 'جاري المعالجة...',
      listEmpty: 'لم يتم إضافة أعضاء بعد.',
      skip: 'تخطي الآن',
      finish: 'إنهاء الإعداد',
      skipWarningTitle: 'تحذير',
      skipWarningText: 'سيتم فقد جميع بيانات فريق العمل. هل تريد المتابعة؟',
      yesProceed: 'نعم، متابعة',
      noStay: 'لا، البقاء'
    },
    prov: {
      title: 'جاري الإعداد...',
      doneTitle: 'تم بنجاح!',
      doneDesc: 'نظام الصيدلية الخاص بك جاهز.',
      button: 'الذهاب للوحة التحكم',
      step1: 'جاري إنشاء قاعدة بيانات آمنة...',
      step2: 'تهيئة {0} فروع...',
      step3: 'جاري دعوة {0} أعضاء للفريق...',
      step4: 'إكمال إعدادات لوحة التحكم...'
    },
    footer: '© 2025 ثريا للأنظمة.',
    graph: {
      hq: 'المركز الرئيسي',
      location: 'الموقع',
      noManager: 'لا يوجد مدير',
      staff: 'الموظفين',
      branches: 'الفروع'
    }
  }
};
