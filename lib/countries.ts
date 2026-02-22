/**
 * 14 pays du site (CEMAC + UEMOA, etc.) et codes ISO pour les drapeaux.
 */

export const SITE_COUNTRIES = [
  'Côte d\'Ivoire',
  'Sénégal',
  'Bénin',
  'Burkina Faso',
  'Mali',
  'Niger',
  'Togo',
  'Guinée-Bissau',
  'Cameroun',
  'Gabon',
  'Congo-Brazzaville',
  'Tchad',
  'Centrafrique',
  'Guinée équatoriale',
] as const;

/** Codes ISO 3166-1 alpha-2 pour flagcdn.com */
export const COUNTRY_ISO: Record<string, string> = {
  'Côte d\'Ivoire': 'ci',
  'Sénégal': 'sn',
  'Bénin': 'bj',
  'Burkina Faso': 'bf',
  'Mali': 'ml',
  'Niger': 'ne',
  'Togo': 'tg',
  'Guinée-Bissau': 'gw',
  'Cameroun': 'cm',
  'Gabon': 'ga',
  'Congo-Brazzaville': 'cg',
  'Tchad': 'td',
  'Centrafrique': 'cf',
  'Guinée équatoriale': 'gq',
};

/** Pays triés par longueur décroissante pour matcher d’abord les noms longs (ex. "Burkina Faso" avant "Faso") */
const SITE_COUNTRIES_SORTED = [...SITE_COUNTRIES].sort((a, b) => b.length - a.length);

/**
 * Retourne le nom du pays si le nom du salon correspond à "[…] [Pays]",
 * sinon null (ex. salon "Global …" ou "Sans catégorie").
 */
export function getCountryFromRoomName(roomName: string): string | null {
  if (!roomName?.trim()) return null;
  for (const country of SITE_COUNTRIES_SORTED) {
    if (roomName === country || roomName.endsWith(' ' + country)) return country;
  }
  return null;
}

/**
 * URL du drapeau (flagcdn.com, 80px de large).
 * @param countryName Nom du pays (ex. "Cameroun")
 * @param width Optionnel, défaut 80
 */
export function getCountryFlagUrl(countryName: string, width = 80): string {
  const code = COUNTRY_ISO[countryName];
  if (!code) return '';
  return `https://flagcdn.com/w${width}/${code}.png`;
}
