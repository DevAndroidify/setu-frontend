import type { Role } from '../auth/session';

/** Interface text for the site frame, sign-in and home page, in English and Nepali. */
export const en = {
  skip: 'Skip to main content',
  subtitle: 'Legacy Records Migration Portal',
  switchTo: 'नेपाली',
  switchToLang: 'ne',
  switchLabel: 'Switch to Nepali',
  signOut: 'Sign out',
  signedOut: 'You are signed out.',
  roles: {
    operator: 'Operator',
    reviewer: 'Reviewer',
    approver: 'Approver',
    auditor: 'Auditor',
    admin: 'Administrator',
  } satisfies Record<Role, string>,
  nav: {
    '/': ['Home', 'Your services'],
    '/sources': [
      'Sources',
      'Register legacy systems, upload their files and read each file’s profile.',
    ],
    '/runs': ['Runs', 'Start dry runs and production runs, and follow their progress live.'],
    '/approvals': [
      'Approvals',
      'Approve or reject production runs that another officer has submitted.',
    ],
    '/reports': [
      'Reports',
      'Reconciliation reports: counts, column checksums and sample differences.',
    ],
    '/quarantine': [
      'Quarantine',
      'Rows held back with their reasons. Fix them and send them through again.',
    ],
    '/matches': [
      'Duplicate review',
      'Compare possible duplicates side by side and decide if they are one person.',
    ],
    '/persons': ['Records', 'Search the migrated register of persons and households.'],
    '/audit': ['Audit trail', 'Every action, hash-chained. Verify that nothing has been changed.'],
    '/status': ['System status', 'Check that the database, queue and file store are reachable.'],
  } as Record<string, [string, string]>,
  footer: {
    about: 'About Setu',
    aboutText:
      'Setu moves records from legacy registers into a modern database, with proof at every step: profiles, validation, quarantine with reasons, lineage, reconciliation and a tamper-evident audit trail.',
    stages: 'How a run works',
    privacy: 'Data and privacy',
    privacyPoints: [
      'Every record here is synthetic',
      'Citizenship numbers are masked by default',
      'Unmasking needs a reason and is audited',
      'Production loads need a second approver',
    ],
    copyright: '© 2026 Setu. A portfolio project, not an official government website.',
  },
  stages: [
    ['Extract', 'Read the legacy file row by row'],
    ['Transform', 'Fix Preeti text, BS dates and old addresses'],
    ['Validate', 'Check every rule; hold failures with reasons'],
    ['Match', 'Find people already in the register'],
    ['Load', 'Write clean records with their lineage'],
    ['Reconcile', 'Prove counts and checksums add up'],
  ] as [string, string][],
  home: {
    welcome: 'Welcome',
    signedInAs: (email: string, role: string) => [`You are signed in as `, email, `, ${role}.`],
    intro: {
      operator:
        'Register legacy sources, upload their files and read the profile before writing a mapping.',
      admin:
        'Register sources and upload files like an operator. Approvals and unmasking are not part of this role.',
      approver: 'Review production runs waiting for your approval, and roll back a run if needed.',
      reviewer: 'Decide whether held records are the same person as one already in the register.',
      auditor:
        'Read reconciliation reports, trace records to their source rows and verify the audit trail.',
    } satisfies Record<Role, string>,
    services: 'Your services',
    howItWorks: 'How a migration run works',
  },
  login: {
    title: 'Sign in',
    aboutTitle: 'Officer sign-in',
    headline: 'A bridge from old registers to a modern record',
    stagesTitle: 'Every run passes six stages',
    about:
      'Setu moves records from legacy registers into a modern database. Every row is loaded, held with its reasons, or sent for review. Nothing is dropped silently.',
    points: [
      'Profiles and checks on every uploaded file',
      'Production loads need a second officer’s approval',
      'Every run can be reconciled and rolled back',
      'A tamper-evident audit trail of every action',
    ],
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    busy: 'Signing in…',
    expired: 'Your session ended. Sign in again to continue.',
    wrong:
      'The email or password is not right. After 5 failed attempts the account is locked for 15 minutes.',
    tooMany: 'Too many sign-in attempts from this computer. Wait a minute and try again.',
    failed: 'Could not sign in',
  },
};

export type Strings = typeof en;

export const ne: Strings = {
  skip: 'मुख्य सामग्रीमा जानुहोस्',
  subtitle: 'पुरानो अभिलेख स्थानान्तरण प्रणाली',
  switchTo: 'English',
  switchToLang: 'en',
  switchLabel: 'Switch to English',
  signOut: 'बाहिरिनुहोस्',
  signedOut: 'तपाईं बाहिरिनुभयो।',
  roles: {
    operator: 'सञ्चालक',
    reviewer: 'समीक्षक',
    approver: 'स्वीकृतकर्ता',
    auditor: 'लेखापरीक्षक',
    admin: 'प्रशासक',
  },
  nav: {
    '/': ['गृहपृष्ठ', 'तपाईंका सेवाहरू'],
    '/sources': [
      'स्रोतहरू',
      'पुराना प्रणाली दर्ता गर्नुहोस्, तिनका फाइल अपलोड गर्नुहोस् र प्रत्येक फाइलको विवरण हेर्नुहोस्।',
    ],
    '/runs': [
      'रनहरू',
      'परीक्षण र वास्तविक रन सुरु गर्नुहोस्, र तिनको प्रगति प्रत्यक्ष हेर्नुहोस्।',
    ],
    '/approvals': [
      'स्वीकृतिहरू',
      'अर्को अधिकारीले पठाएका वास्तविक रन स्वीकृत वा अस्वीकृत गर्नुहोस्।',
    ],
    '/reports': ['प्रतिवेदनहरू', 'मिलान प्रतिवेदन: सङ्ख्या, स्तम्भ चेकसम र नमुना भिन्नता।'],
    '/quarantine': ['क्वारेन्टाइन', 'कारणसहित रोकिएका पङ्क्तिहरू। तिनलाई सच्याएर फेरि पठाउनुहोस्।'],
    '/matches': [
      'दोहोरो अभिलेख जाँच',
      'सम्भावित दोहोरो अभिलेख छेउछेउमा राखेर एउटै व्यक्ति हो कि होइन निर्णय गर्नुहोस्।',
    ],
    '/persons': ['अभिलेखहरू', 'स्थानान्तरित व्यक्ति र घरधुरीको अभिलेख खोज्नुहोस्।'],
    '/audit': [
      'लेखापरीक्षण विवरण',
      'हरेक कार्य ह्यास-शृङ्खलामा। केही पनि नबदलिएको पुष्टि गर्नुहोस्।',
    ],
    '/status': ['प्रणाली स्थिति', 'डाटाबेस, लाइन र फाइल भण्डार चलिरहेको जाँच गर्नुहोस्।'],
  },
  footer: {
    about: 'सेतुको बारेमा',
    aboutText:
      'सेतुले पुराना दर्ताका अभिलेखलाई आधुनिक डाटाबेसमा सार्छ, र हरेक चरणको प्रमाण राख्छ: विवरण, प्रमाणीकरण, कारणसहित क्वारेन्टाइन, स्रोत-सम्बन्ध, मिलान र छेडछाड पत्ता लाग्ने लेखापरीक्षण विवरण।',
    stages: 'रन कसरी चल्छ',
    privacy: 'तथ्याङ्क र गोपनीयता',
    privacyPoints: [
      'यहाँका सबै अभिलेख कृत्रिम हुन्',
      'नागरिकता नम्बर पूर्वनिर्धारित रूपमा लुकाइन्छ',
      'देखाउन कारण चाहिन्छ र त्यो अभिलेख हुन्छ',
      'वास्तविक भण्डारणका लागि दोस्रो स्वीकृतकर्ता चाहिन्छ',
    ],
    copyright: '© २०२६ सेतु। एक पोर्टफोलियो परियोजना, आधिकारिक सरकारी वेबसाइट होइन।',
  },
  stages: [
    ['निकासी', 'पुरानो फाइल पङ्क्ति-पङ्क्ति पढ्ने'],
    ['रूपान्तरण', 'प्रीति अक्षर, वि.सं. मिति र पुराना ठेगाना सच्याउने'],
    ['प्रमाणीकरण', 'हरेक नियम जाँच्ने; असफललाई कारणसहित रोक्ने'],
    ['दोहोरो खोज', 'दर्तामा पहिले नै भएका व्यक्ति पत्ता लगाउने'],
    ['भण्डारण', 'सफा अभिलेख स्रोत-सम्बन्धसहित लेख्ने'],
    ['हिसाब मिलान', 'सङ्ख्या र चेकसम मिलेको प्रमाणित गर्ने'],
  ],
  home: {
    welcome: 'स्वागत छ',
    signedInAs: (email: string, role: string) => [
      `तपाईं `,
      email,
      ` (${role}) को रूपमा लगइन हुनुहुन्छ।`,
    ],
    intro: {
      operator:
        'पुराना स्रोत दर्ता गर्नुहोस्, तिनका फाइल अपलोड गर्नुहोस् र म्यापिङ लेख्नुअघि विवरण पढ्नुहोस्।',
      admin:
        'सञ्चालकजस्तै स्रोत दर्ता र फाइल अपलोड गर्नुहोस्। स्वीकृति र नम्बर देखाउने काम यो भूमिकामा पर्दैन।',
      approver:
        'तपाईंको स्वीकृति पर्खिरहेका वास्तविक रन समीक्षा गर्नुहोस्, र आवश्यक परे रन फिर्ता लिनुहोस्।',
      reviewer: 'रोकिएका अभिलेख दर्तामा भएको व्यक्तिसँग एउटै हो कि होइन निर्णय गर्नुहोस्।',
      auditor:
        'मिलान प्रतिवेदन पढ्नुहोस्, अभिलेखलाई स्रोत पङ्क्तिसम्म पछ्याउनुहोस् र लेखापरीक्षण विवरण प्रमाणित गर्नुहोस्।',
    },
    services: 'तपाईंका सेवाहरू',
    howItWorks: 'स्थानान्तरण रन कसरी चल्छ',
  },
  login: {
    title: 'लगइन',
    aboutTitle: 'अधिकारी लगइन',
    headline: 'पुराना दर्ताबाट आधुनिक अभिलेखसम्मको पुल',
    stagesTitle: 'हरेक रन छ चरण पार गर्छ',
    about:
      'सेतुले पुराना दर्ताका अभिलेखलाई आधुनिक डाटाबेसमा सार्छ। हरेक पङ्क्ति भण्डारण हुन्छ, कारणसहित रोकिन्छ, वा समीक्षामा जान्छ। कुनै पनि चुपचाप हराउँदैन।',
    points: [
      'हरेक अपलोड गरिएको फाइलको विवरण र जाँच',
      'वास्तविक भण्डारणका लागि दोस्रो अधिकारीको स्वीकृति',
      'हरेक रनको हिसाब मिलान र फिर्ता गर्न सकिने',
      'हरेक कार्यको छेडछाड पत्ता लाग्ने लेखापरीक्षण विवरण',
    ],
    email: 'इमेल',
    password: 'पासवर्ड',
    submit: 'लगइन गर्नुहोस्',
    busy: 'लगइन हुँदैछ…',
    expired: 'तपाईंको सत्र सकियो। जारी राख्न फेरि लगइन गर्नुहोस्।',
    wrong: 'इमेल वा पासवर्ड मिलेन। ५ पटक गलत भएपछि खाता १५ मिनेटका लागि बन्द हुन्छ।',
    tooMany: 'यो कम्प्युटरबाट धेरै पटक लगइन प्रयास भयो। एक मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।',
    failed: 'लगइन हुन सकेन',
  },
};
