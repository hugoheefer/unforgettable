// The languages of the game. Adding one is a file in texts/ and a row here; this is the only module that
// imports a language file.

import { en } from './texts/en.js';

export const LANGUAGES = [{ code: 'en', name: 'English', texts: en }];

/** The texts of a language code; an unknown code gives English. */
export function textsFor(code) {
  return (LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]).texts;
}
