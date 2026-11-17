/**
 * **Der Baustein „Adresse“** (Etappe F, Scheibe F4; Klick-Runde 6: Straße, PLZ, Ort – kein Land; Entwurf
 * `f4-adresse-v1`, Alwin 17.11.2026). Die EINE Stelle für die drei Teile, ihre Personenfelder in ChurchTools, ihre
 * Längen und den Text „Hauptstr. 4, 53797 Lohmar“.
 *
 * Gemessen (F0 08.11.2026, M1 17.11.2026, `messung-m1-2026-11-17.md`): Die Teile sind **Personenfelder** (`street`,
 * `zip`, `city`), ins Anmeldeformular genommen über `PUT /groups/{id}/memberfields/person/{Feldnummer}`. Eine neue
 * Person hat sie sofort; bei einer bekannten schreibt ChurchTools sie mit dem Klick in der Bestätigungsmail in die
 * Person – vorhandene Werte werden **überschrieben**. Entschieden (Alwin): so lassen, mit festem Hinweis
 * (`ADRESSE_HINWEIS`); leere Teile werden nie geschickt (`adresseWerte`), damit nichts gelöscht wird.
 */
import type { Antwort, Antworten, Feld, Formular } from './formular';

/** Die Antwort des Bausteins: drei Texte. */
export interface AdresseAntwort {
  strasse: string;
  plz: string;
  ort: string;
}

export type AdressTeil = keyof AdresseAntwort;

/** Die Teile in ihrer Reihenfolge – Beschriftung, Personenfeld in ChurchTools (`key` in `/fields`), Länge dort. */
export const ADRESSE_TEILE: readonly {
  teil: AdressTeil;
  name: string;
  ct: 'street' | 'zip' | 'city';
  max: number;
}[] = [
  { teil: 'strasse', name: 'Straße und Hausnummer', ct: 'street', max: 100 },
  { teil: 'plz', name: 'PLZ', ct: 'zip', max: 20 },
  { teil: 'ort', name: 'Ort', ct: 'city', max: 40 },
];

/** Der feste Hinweis unter dem Baustein – bekannte Personen bekommen ihre Adresse überschrieben (M1). */
export const ADRESSE_HINWEIS = 'Wird im Profil in ChurchTools gespeichert.';

/** Die Antwort als Adresse – fehlende oder falsche Teile sind leer. */
export function adresseAus(w: Antwort): AdresseAntwort {
  const x = (w && typeof w === 'object' && !Array.isArray(w) ? w : {}) as Partial<
    Record<AdressTeil, unknown>
  >;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return { strasse: text(x.strasse), plz: text(x.plz), ort: text(x.ort) };
}

/** **Die Teile, die etwas enthalten** – getrimmt; leere fehlen (sie würden eine vorhandene Adresse löschen). */
export function adresseWerte(w: Antwort): { ct: 'street' | 'zip' | 'city'; wert: string }[] {
  const a = adresseAus(w);
  return ADRESSE_TEILE.flatMap(({ teil, ct, max }) => {
    const wert = a[teil].trim().slice(0, max);
    return wert ? [{ ct, wert }] : [];
  });
}

/**
 * **Die Adresse einer Person aus ChurchTools** (`GET /persons`: `street`, `zip`, `city`) – `null`, wenn keiner der
 * drei Teile gefüllt ist oder man sie nicht sehen darf (F4b).
 */
export function adresseVonPerson(
  p: Partial<Record<'street' | 'zip' | 'city', unknown>>,
): AdresseAntwort | null {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const a: AdresseAntwort = { strasse: text(p.street), plz: text(p.zip), ort: text(p.city) };
  return a.strasse || a.plz || a.ort ? a : null;
}

/**
 * **Welcher Baustein „Adresse“ gilt** – eingeschaltet, „je Person“ vor „einmal je Anmeldung“; `null`, wenn keiner. Die
 * EINE Stelle für diese Regel: Antworten lesen (`adresseAntwort`) und vorbelegen (`handStart`).
 */
export function adresseFeld(f: Formular): { feld: Feld; jePerson: boolean } | null {
  const an = (x: Feld) => x.typ === 'adresse' && x.zustand !== 'aus';
  const jePerson = f.person.find(an);
  if (jePerson) return { feld: jePerson, jePerson: true };
  const einmal = f.anmeldung.find(an);
  return einmal ? { feld: einmal, jePerson: false } : null;
}

/**
 * **Die Adresse einer Person in den Antworten** – „je Person“ gefragt ihre eigene, einmal je Anmeldung gefragt die der
 * Anmeldung (für alle Personen dieselbe). Ausgeschaltet gibt es keine. Für Formular (`senden.ts`) und „Von Hand“;
 * Ausgeblendetes hat `leeren` vorher entfernt.
 */
export function adresseAntwort(f: Formular, a: Antworten, i: number): Antwort {
  const x = adresseFeld(f);
  if (!x) return undefined;
  return x.jePerson ? a.personen[i]?.[x.feld.id] : a.anmeldung[x.feld.id];
}

/** Normalisiert zum Vergleichen: ohne Rand und doppelte Leerzeichen, ohne Groß/Klein. */
const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * **„Von Hand“ bei einer bekannten Person** (F4c, Alwin 17.11.2026: „fragen, wenn anders“, Entwurf
 * `f4c-von-hand-v1`): `nichts` – nichts eingetragen oder steht so schon in ChurchTools; `ergaenzen` – die Person hat
 * noch keine Adresse; `anders` – es steht eine andere da, ersetzt wird nur mit dem Häkchen.
 */
export function adresseVergleich(
  eingetragen: Antwort,
  profil: AdresseAntwort | null,
): 'nichts' | 'ergaenzen' | 'anders' {
  if (adresseWerte(eingetragen).length === 0) return 'nichts';
  if (!profil) return 'ergaenzen';
  const a = adresseAus(eingetragen);
  return ADRESSE_TEILE.every(({ teil }) => norm(a[teil]) === norm(profil[teil]))
    ? 'nichts'
    : 'anders';
}

/** „Hauptstr. 4, 53797 Lohmar“ – `''`, wenn nichts eingetragen ist. */
export function adresseText(w: Antwort): string {
  const a = adresseAus(w);
  const ort = [a.plz.trim(), a.ort.trim()].filter(Boolean).join(' ');
  return [a.strasse.trim(), ort].filter(Boolean).join(', ');
}
