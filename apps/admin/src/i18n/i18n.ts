import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

const supportedLanguages = ['en', 'ar'] as const;

const resources = {
  en: {
    translation: {
      appName: 'Materiabill',
      auth: {
        eyebrow: 'Inframodern satellite app',
        title: 'Materiabill',
        body: 'Sign in with Inframodern to open your contractor workspace.',
        cta: 'Continue with Inframodern',
      },
      shell: {
        home: 'Workspace home',
        projects: 'Projects',
        activity: 'Activity',
        people: 'People',
        settings: 'Settings',
        workspace: 'Workspace',
        signOut: 'Sign out',
        signedInAs: 'Signed in as',
        primaryNav: 'Primary navigation',
      },
      workspace: {
        switchFailed: 'Workspace switch failed.',
        loading: 'Loading workspace...',
        loadFailed: 'Workspace shell could not load.',
        retry: 'Retry',
        accessBlocked: 'Workspace access is blocked.',
        routeBlocked: 'You do not have access to this section.',
      },
      confirm: {
        cancel: 'Cancel',
        confirm: 'Confirm',
        signOutTitle: 'Sign out?',
        signOutMessage: 'Your server-side session cookie will be cleared.',
      },
      toast: {
        signedOut: 'Signed out.',
        signOutFailed: 'Sign out failed.',
      },
      pages: {
        placeholder: 'This shell route is ready for a later task.',
      },
      language: {
        english: 'English',
        arabic: 'العربية',
      },
    },
  },
  ar: {
    translation: {
      appName: 'ماتيريابيل',
      auth: {
        eyebrow: 'تطبيق مرتبط بإنفرامودرن',
        title: 'ماتيريابيل',
        body: 'سجل الدخول عبر إنفرامودرن لفتح مساحة عمل المقاول.',
        cta: 'المتابعة عبر إنفرامودرن',
      },
      shell: {
        home: 'الرئيسية',
        projects: 'المشاريع',
        activity: 'النشاط',
        people: 'الأشخاص',
        settings: 'الإعدادات',
        workspace: 'مساحة العمل',
        signOut: 'تسجيل الخروج',
        signedInAs: 'تم تسجيل الدخول باسم',
        primaryNav: 'التنقل الرئيسي',
      },
      workspace: {
        switchFailed: 'تعذر تبديل مساحة العمل.',
        loading: 'جاري تحميل مساحة العمل...',
        loadFailed: 'تعذر تحميل واجهة مساحة العمل.',
        retry: 'إعادة المحاولة',
        accessBlocked: 'تم حظر الوصول إلى مساحة العمل.',
        routeBlocked: 'ليست لديك صلاحية للوصول إلى هذا القسم.',
      },
      confirm: {
        cancel: 'إلغاء',
        confirm: 'تأكيد',
        signOutTitle: 'تسجيل الخروج؟',
        signOutMessage: 'سيتم حذف ملف تعريف ارتباط الجلسة على الخادم.',
      },
      toast: {
        signedOut: 'تم تسجيل الخروج.',
        signOutFailed: 'تعذر تسجيل الخروج.',
      },
      pages: {
        placeholder: 'هذا المسار جاهز لمهمة لاحقة.',
      },
      language: {
        english: 'English',
        arabic: 'العربية',
      },
    },
  },
} as const;

export const i18n: I18nInstance = i18next.createInstance();

void i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  supportedLngs: [...supportedLanguages],
  resources,
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', setDocumentLanguageAttributes);
setDocumentLanguageAttributes(i18n.resolvedLanguage ?? 'en');

function setDocumentLanguageAttributes(language: string): void {
  const direction = i18n.dir(language);
  document.documentElement.lang = language === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = direction;
  document.body.dir = direction;
}
