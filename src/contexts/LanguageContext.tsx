
"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';

// Define the shape of the translations
type Translations = typeof en;

const bundledLanguageInfo = [
    { code: "en", name: "English" },
    { code: "ar", name: "العربية (Arabic)" },
    { code: "ur", name: "اردو (Urdu)" },
    { code: "fa", name: "فارسی (Farsi)" },
    { code: "hi", name: "हिन्दी (Hindi)" },
];

interface LanguageInfo {
    code: string;
    name: string;
}

// Define the shape of the context
interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: keyof Translations | string) => string;
  availableLanguages: LanguageInfo[];
}

// Create the context with a default value
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Create the provider component
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState('en');
  const [translations, setTranslations] = useState<Record<string, Translations>>({ en });
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>(() => bundledLanguageInfo);

  const loadCustomLanguages = useCallback(() => {
    const customLangsRaw = localStorage.getItem('customLanguages');
    if (customLangsRaw) {
        try {
            const customLangs: {code: string, name: string, dict: object}[] = JSON.parse(customLangsRaw);
            const newLangInfo = [...bundledLanguageInfo];

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
    loadCustomLanguages();
    
    window.addEventListener('languageChange', loadCustomLanguages);

    return () => {
        window.removeEventListener('languageChange', loadCustomLanguages);
    }
  }, [loadCustomLanguages]);


  const setLanguage = useCallback((lang: string) => {
    if (language === lang) return;

    const loadTranslation = async () => {
        try {
            let newTranslation;
            if (lang !== 'en' && !translations[lang]) {
                const isCustom = !bundledLanguageInfo.some(l => l.code === lang);
                if (isCustom) {
                    const customLangsRaw = localStorage.getItem('customLanguages');
                    if (customLangsRaw) {
                        const customLangs = JSON.parse(customLangsRaw);
                        const customLang = customLangs.find((l: LanguageInfo) => l.code === lang);
                        if (customLang) {
                            newTranslation = customLang.dict;
                        }
                    }
                } else {
                    // Dynamically import the language file
                    const module = await import(`@/locales/${lang}.json`);
                    newTranslation = module.default;
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
    return lang_dict[translationKey] || translations['en'][translationKey] || String(key);
  };
  
  useEffect(() => {
    const dir = ['ar', 'ur', 'fa'].includes(language) ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);


  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
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
