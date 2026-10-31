
"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';

// Define the shape of the translations
type Translations = typeof en;

const bundledLanguageInfo = [
    { code: "en", name: "English", nativeName: "English", direction: "ltr" as const },
    { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl" as const },
    { code: "ur", name: "Urdu", nativeName: "اردو", direction: "rtl" as const },
    { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl" as const },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", direction: "ltr" as const },
];

interface LanguageInfo {
    code: string;
    name: string;
    nativeName?: string;
    direction?: 'ltr' | 'rtl';
    version?: number;
}

// Define the shape of the context
interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: keyof Translations | string) => string;
  availableLanguages: LanguageInfo[];
  installedLanguages: string[];
  downloadLanguagePack: (language: string) => Promise<void>;
}

// Create the context with a default value
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_PACK_VERSION = 'v2';
const LANGUAGE_PACK_DB = 'connectlocal-language-packs';
const LANGUAGE_PACK_STORE = 'packs';

function openLanguagePackDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(LANGUAGE_PACK_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LANGUAGE_PACK_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readLanguagePack(lang: string): Promise<Translations | null> {
  const db = await openLanguagePackDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction(LANGUAGE_PACK_STORE).objectStore(LANGUAGE_PACK_STORE).get(lang);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value?.version === LANGUAGE_PACK_VERSION ? value.dict : null);
    };
    request.onerror = () => resolve(null);
  });
}

async function writeLanguagePack(lang: string, dict: Translations) {
  const db = await openLanguagePackDb();
  if (!db) return;
  const transaction = db.transaction(LANGUAGE_PACK_STORE, 'readwrite');
  transaction.objectStore(LANGUAGE_PACK_STORE).put({ version: LANGUAGE_PACK_VERSION, dict }, lang);
}

// Create the provider component
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState('en');
  const [translations, setTranslations] = useState<Record<string, Translations>>({ en });
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>(() => bundledLanguageInfo);
  const [installedLanguages, setInstalledLanguages] = useState<string[]>([]);
  const installedLanguagesRef = React.useRef(new Set<string>());

  const updateInstalledLanguages = useCallback((languages: string[]) => {
    installedLanguagesRef.current = new Set(languages);
    setInstalledLanguages(languages);
  }, []);

  const loadCustomLanguages = useCallback(() => {
    if (typeof fetch === 'function') {
      fetch('/api/languages', { cache: 'force-cache' }).then((response) => response.ok ? response.json() : null).then((data) => {
        if (data?.languages?.length) setAvailableLanguages(data.languages.map((lang: LanguageInfo) => ({ ...lang, name: lang.nativeName || lang.name || lang.code })));
      }).catch(() => undefined);
    }
    const customLangsRaw = localStorage.getItem('customLanguages');
    if (customLangsRaw) {
        try {
            const customLangs: {code: string, name: string, dict: object}[] = JSON.parse(customLangsRaw);
            const newLangInfo: LanguageInfo[] = [...bundledLanguageInfo];

            customLangs.forEach(lang => {
                if (!newLangInfo.some(l => l.code === lang.code)) {
                     newLangInfo.push({ code: lang.code, name: lang.name });
                }
            });

            setAvailableLanguages(newLangInfo);
        } catch (e) {
            console.error("Failed to parse custom languages", e);
        }
    } else {
        setAvailableLanguages(bundledLanguageInfo);
    }
  }, []);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage && bundledLanguageInfo.some((lang) => lang.code === savedLanguage)) setLanguageState(savedLanguage);
    if (typeof indexedDB !== 'undefined') {
      void Promise.all(bundledLanguageInfo.map(async ({ code }) => (await readLanguagePack(code)) ? code : null))
        .then((languages) => updateInstalledLanguages(languages.filter((code): code is string => Boolean(code))));
    }
    loadCustomLanguages();
    
    window.addEventListener('languageChange', loadCustomLanguages);

    return () => {
        window.removeEventListener('languageChange', loadCustomLanguages);
    }
  }, [loadCustomLanguages, updateInstalledLanguages]);


  const downloadLanguagePack = useCallback(async (lang: string) => {
    const dict = lang === 'en' ? en : (await import(`@/locales/${lang}.json`)).default;
    await writeLanguagePack(lang, dict);
    updateInstalledLanguages([...installedLanguagesRef.current, lang].filter((value, index, values) => values.indexOf(value) === index));
    window.dispatchEvent(new Event('languageChange'));
  }, [updateInstalledLanguages]);

  const setLanguage = useCallback((lang: string) => {
    if (language === lang) return;
    localStorage.setItem('selectedLanguage', lang);
    document.cookie = `connectlocal_locale=${encodeURIComponent(lang)}; Max-Age=31536000; Path=/; SameSite=Lax`;

    const loadTranslation = async () => {
        try {
            let newTranslation;
            if (lang !== 'en' && !translations[lang]) {
                const isCustom = !bundledLanguageInfo.some(l => l.code === lang);
                newTranslation = await readLanguagePack(lang);
                if (isCustom) {
                    const remote = typeof fetch === 'function' ? await fetch(`/api/languages?code=${encodeURIComponent(lang)}`, { cache: 'force-cache' }) : null;
                    if (remote?.ok) newTranslation = (await remote.json()).translations;
                    const customLangsRaw = localStorage.getItem('customLanguages');
                    if (customLangsRaw) {
                        const customLangs = JSON.parse(customLangsRaw);
                        const customLang = customLangs.find((l: LanguageInfo) => l.code === lang);
                        if (customLang) {
                            newTranslation = customLang.dict;
                        }
                    }
                } else {
                    const remote = typeof fetch === 'function' ? await fetch(`/api/languages?code=${encodeURIComponent(lang)}`, { cache: 'force-cache' }) : null;
                    const remoteLanguage = remote?.ok ? await remote.json() : null;
                    newTranslation = remoteLanguage?.translations || (await import(`@/locales/${lang}.json`)).default;
                    if (remoteLanguage?.version) await writeLanguagePack(`${lang}:${remoteLanguage.version}`, newTranslation);
                }
            }

            if (newTranslation) {
                setTranslations(prev => ({ ...prev, [lang]: newTranslation }));
            }
            setLanguageState(lang);
        } catch (error) {
            console.error(`Could not load translation for ${lang}`, error);
            setLanguageState('en'); // Fallback to English
        }
    };
    
    loadTranslation();

  }, [language, translations]);
  
  const t = (key: keyof Translations | string): string => {
    const lang_dict = translations[language] || translations['en'];
    const translationKey = key as keyof Translations;
    return lang_dict[translationKey] || translations['en'][translationKey] || '';
  };
  
  useEffect(() => {
    const dir = ['ar', 'ur', 'fa'].includes(language) ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);


  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages, installedLanguages, downloadLanguagePack }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Create a custom hook for using the context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
