import { useSyncExternalStore } from 'react';
import { en, ne, type Strings } from './strings';

export type Language = 'en' | 'ne';

const STORAGE_KEY = 'setu.language';
const listeners = new Set<() => void>();

/** The saved choice; storage can be missing or blocked, and then English is used. */
function load(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ne' ? 'ne' : 'en';
  } catch {
    return 'en';
  }
}

let current: Language = load();
document.documentElement.lang = current;

/** Switches the interface language everywhere at once, and remembers it on this browser. */
export function setLanguage(language: Language) {
  current = language;
  document.documentElement.lang = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not saved: the choice still holds until the page is reloaded.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, () => current);
}

/** The interface strings in the chosen language. */
export function useStrings(): Strings {
  return useLanguage() === 'ne' ? ne : en;
}
