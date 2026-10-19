/**
 * **Eine Anmeldung für ChurchTools aufbauen** (A6-2, #548) – ohne Oberfläche, damit Formular, Tests und später die
 * Nachprüfung (A6-5) dieselbe Regel benutzen. Gemessen 14.10.2026 (`messung-a6-2026-10-14.md`):
 *
 * - `POST /publicgroups/{id}/signup` `{token, forms: [{form: [{id, type, value}]}], hasAcceptedPrivacyForSelf}`.
 * - Feldnummern aus `GET /publicgroups/{id}/form?token=`: Personenfelder über ihren Namen (`firstName`, `lastName`,
 *   `email`, `birthday` – Geburtstag steht nur im Kinder-Formular, wird im normalen aber angenommen), Gruppenfelder
 *   mit ihrer Nummer (`type: custom`), Datenschutz `type: privacy`.
 * - ChurchTools kennt kein „einmal je Anmeldung“: Jede Person ist ein eigenes Mitglied mit eigenen Feldern.
 *
 * **Variante A (Alwin, 14.10.2026):** Mitglied werden genau die Personen unter „Wer nimmt teil?“. Was es einmal je
 * Anmeldung gibt – Kontaktname („Angemeldet von“), Telefon, Bemerkungen, eigene Fragen des Kontakt-Bereichs,
 * Betrag, Aufschlüsselung, Auswahl, Extras – steht bei der **ersten** Person. Alle bekommen die Kontakt-Adresse.
 * Bei „Nur Kinder“ belegen die Eltern so keinen Platz.
 */
import {
  alterAm,
  ctAblage,
  ctZusatzSpalten,
  erziehungAus,
  geburtsdatumAn,
  unterschriftAus,
  type Antwort,
  type Antworten,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';
import { tagPunkt } from '../ct/datum';
import {
  berechnePreis,
  euroText,
  kannEtwasKosten,
  type Buchung,
  type Preisergebnis,
} from './preis';

/** Ein Feld, wie `/publicgroups/{id}/form` es beschreibt. */
export interface CtFormFeld {
  id: number | string;
  type: string;
  name: string;
  fieldTypeCode?: string;
  options?: { id: string | number; name: string }[] | null;
}

/** Was `/publicgroups/{id}/form` liefert (soweit wir es brauchen). */
export interface CtFormular {
  form: CtFormFeld[];
  addChildForm?: CtFormFeld[];
}

export interface FormWert {
  id: string;
  type: string;
  value: string;
}

export interface Anmeldung {
  forms: { form: FormWert[] }[];
  hasAcceptedPrivacyForSelf: true;
}

/** Was die Teilnehmenden außer den Feldern gewählt haben (Preisbereich). */
export interface PreisWahl {
  option: number;
  extras: boolean[];
}

/**
 * Die Anmeldung passt nicht zu ChurchTools (ein Feld fehlt dort, eine Antwort gibt es dort nicht). Eine Gemeinde
 * muss das beheben – abgeschickt wird dann nichts, statt still eine Antwort zu verlieren.
 */
export class PasstNicht extends Error {
  constructor(readonly was: string) {
    super(`Die Anmeldung passt nicht zu ChurchTools: ${was}`);
    this.name = 'PasstNicht';
  }
}

/**
 * **Die Preis-Buchung aus den Antworten** – Alter je Person am ersten Tag (nur wenn das Geburtsdatum abgefragt
 * wird), Auswahl, Extras, Tag der Anmeldung. Die EINE Stelle für den angezeigten und den gespeicherten Betrag.
 */
export function buchungAus(
  e: OeffentlicheEinstellungen,
  a: Antworten,
  wahl: PreisWahl,
  heute: string,
  /**
   * Wer einen Platz bekommt (A6-5a, #612; Index wie `a.personen`). Wer auf die Warteliste kommt, zählt nicht im
   * Betrag – er folgt beim Nachrücken (Alwin, 17.10.2026). Ohne Angabe zählen alle.
   */
  mitPlatz?: boolean[],
): Buchung {
  const stichtag = (e.termin?.beginn ?? heute).slice(0, 10);
  const mitGeburt = geburtsdatumAn(e.formular);
  return {
    alter: a.personen
      .filter((_, i) => mitPlatz?.[i] !== false)
      .map((p) => (mitGeburt && typeof p.birth === 'string' ? alterAm(p.birth, stichtag) : null)),
    option: wahl.option,
    angemeldetAm: heute,
    extras: wahl.extras,
  };
}

/** Die Aufschlüsselung als Text für das Gruppenfeld – eine Zeile je Posten, darunter die Summe. */
export function aufschluesselungText(p: Preisergebnis): string {
  const zeilen = p.posten
    .filter((x) => x.betragCent !== null)
    .map(
      (x) =>
        `${x.text}${x.hinweis ? ` (${x.hinweis})` : ''}: ${
          x.betragCent! < 0 ? `−${euroText(-x.betragCent!)}` : euroText(x.betragCent!)
        }`,
    );
  return [...zeilen, `Gesamt: ${euroText(p.gesamtCent)}`].join('\n');
}

const sichtbar = (f: Feld) => f.zustand !== 'aus';

function nameVon(w: Antwort): { vor: string; nach: string } {
  const n = (w ?? {}) as { vor?: string; nach?: string };
  return { vor: (n.vor ?? '').trim(), nach: (n.nach ?? '').trim() };
}

/** Die Namen der Teilnehmenden, wie sie auf der Ergebnis-Seite stehen – ohne Namen „Kind 2“ bzw. „Person 2“. */
export function personenNamen(e: OeffentlicheEinstellungen, a: Antworten): string[] {
  const feld = e.formular.person.find((f) => f.typ === 'name');
  return a.personen.map((p, i) => {
    const n = nameVon(feld ? p[feld.id] : undefined);
    return `${n.vor} ${n.nach}`.trim() || `${e.wer === 'kinder' ? 'Kind' : 'Person'} ${i + 1}`;
  });
}

/**
 * **Was je Person herauskam** (#602 – jede Person wird einzeln angemeldet): angemeldet, auf der Warteliste, schon
 * bekannt (per Mail bestätigen), ausgebucht (voll, keine Warteliste – nichts geschickt) oder offen (Fehler, „Noch
 * einmal“ schickt sie erneut).
 */
export type PersonErgebnis = 'angemeldet' | 'warteliste' | 'bestaetigen' | 'ausgebucht' | 'offen';

export interface Abgeschickt {
  personen: { index: number; name: string; ergebnis: PersonErgebnis }[];
  /** Adresse, an die ChurchTools die Bestätigungen schickt. */
  mail: string;
  /** Warum Personen offen geblieben sind. */
  meldung?: string;
}

/**
 * **Erziehungsberechtigte lesbar** (A6-2b) – eine Zeile je Person („Erna Muster, 0151 2345678“), darunter das
 * Häkchen. `null`, wenn nichts eingetragen ist.
 */
export function erziehungText(w: Antwort): string | null {
  const e = erziehungAus(w);
  const zeilen = e.personen
    .map((p) =>
      [`${p.vor ?? ''} ${p.nach ?? ''}`.trim(), (p.tel ?? '').trim()].filter(Boolean).join(', '),
    )
    .filter(Boolean);
  if (zeilen.length === 0 && !e.einverstanden) return null;
  if (e.einverstanden) zeilen.push('✓ erziehungsberechtigt und einverstanden');
  return zeilen.join('\n');
}

/**
 * **Die lesbare Spalte der Unterschrift** (Alwin, 15.10.2026: „zwei Spalten“) – wer und wann: „✓ Erna Muster,
 * 15.10.2026“. Die Striche stehen in der zweiten Spalte (`ctZusatzSpalten`).
 */
export function unterschriftLesbar(name: string, heute: string): string {
  return `✓ ${name ? `${name}, ` : 'unterschrieben am '}${tagPunkt(heute)}`;
}

/**
 * Eine Antwort im Format, das ChurchTools für das Gruppenfeld annimmt (gemessen A0/A6): Ankreuzen `1`, Ja/Nein und
 * Auswahl als Options-ID, Mehrfachauswahl als Text („Wandern, Spiele“), sonst der Text. `null` = leer, nichts
 * schicken.
 */
export function ctWert(f: Feld, w: Antwort, ct: CtFormFeld): string | null {
  if (f.typ === 'check') return w === true ? '1' : null;
  if (f.typ === 'janein' || f.typ === 'radio' || f.typ === 'select') {
    if (typeof w !== 'string' || !w.trim()) return null;
    const o = (ct.options ?? []).find((x) => x.name.trim() === w.trim());
    if (!o) throw new PasstNicht(`„${f.frage}“ kennt die Antwort „${w}“ nicht`);
    return String(o.id);
  }
  if (f.typ === 'multi') return Array.isArray(w) && w.length ? w.join(', ') : null;
  if (f.typ === 'erziehungsberechtigte') return erziehungText(w);
  // Die Unterschrift baut `anmeldungAufbauen` (sie braucht Name und Tag).
  if (f.typ === 'unterschrift') return null;
  return typeof w === 'string' && w.trim() ? w.trim() : null;
}

/** Zeichen der Anmelde-Nr. – ohne 0/O, 1/I/L, damit man sie am Telefon nennen kann. */
const NR_ZEICHEN = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** **Eine neue Anmelde-Nr.** (A6-5a, #612), z. B. „7K2P9X“ – sechs Zeichen, zufällig. */
export function neueAnmeldeNr(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => NR_ZEICHEN[b % NR_ZEICHEN.length],
  ).join('');
}

/**
 * **Der Betrag einer Anmeldung** (A6-5a, #612) – die EINE Regel für die Anzeige im Formular und das Feld „Betrag“:
 * Es zählt nur, wer einen Platz bekommt (`mitPlatz`); wer wartet, steht in `warten` und zahlt beim Nachrücken.
 * Bekommt niemand einen Platz, ist der Betrag 0 – auch keine Gebühr je Anmeldung.
 */
export function betragAus(
  e: OeffentlicheEinstellungen,
  a: Antworten,
  wahl: PreisWahl,
  heute: string,
  mitPlatz?: boolean[],
): { preis: Preisergebnis; gesamtCent: number; posten: Preisergebnis['posten']; warten: string[] } {
  const preis = berechnePreis(e.preis, buchungAus(e, a, wahl, heute, mitPlatz));
  const keiner =
    !!mitPlatz && a.personen.length > 0 && a.personen.every((_, i) => mitPlatz[i] === false);
  const namen = personenNamen(e, a);
  return {
    preis,
    gesamtCent: keiner ? 0 : preis.gesamtCent,
    posten: keiner ? [] : preis.posten,
    warten: a.personen.flatMap((_, i) => (mitPlatz?.[i] === false ? [namen[i]] : [])),
  };
}

/** Zeile der Aufschlüsselung für jemanden auf der Warteliste. */
export function wartelistenZeile(name: string): string {
  return `${name}: Warteliste – Betrag folgt beim Nachrücken`;
}

/**
 * **Die Anmeldung für `signup`** – eine `form` je Person unter „Wer nimmt teil?“ (Variante A, siehe oben).
 * Wirft `PasstNicht`, wenn ein Feld oder eine Antwort in ChurchTools fehlt.
 *
 * A6-5a (#612): `nr` steht bei **jeder** Person (fehlt das Feld bei älteren Veranstaltungen, geht es ohne);
 * `mitPlatz` sagt, wer im Betrag zählt (`buchungAus`).
 */
export function anmeldungAufbauen(
  e: OeffentlicheEinstellungen,
  a: Antworten,
  wahl: PreisWahl,
  heute: string,
  ct: CtFormular,
  weiteres: { nr?: string; mitPlatz?: boolean[] } = {},
): Anmeldung {
  const alle = [...ct.form, ...(ct.addChildForm ?? [])];
  const person = (name: string) => alle.find((x) => x.type === 'person' && x.name === name);
  const gruppenfeld = (ctId: number | undefined) =>
    ctId === undefined
      ? undefined
      : alle.find((x) => x.type === 'custom' && String(x.id) === String(ctId));
  const pflichtPerson = (name: string) => {
    const x = person(name);
    if (!x) throw new PasstNicht(`das Personenfeld „${name}“ fehlt`);
    return String(x.id);
  };
  const datenschutz = ct.form.find((x) => x.type === 'privacy');

  const kontaktFeld = e.formular.anmeldung.find((f) => f.typ === 'name');
  const mailFeld = e.formular.anmeldung.find((f) => f.typ === 'email');
  const kontakt = nameVon(kontaktFeld ? a.anmeldung[kontaktFeld.id] : undefined);
  const mailWert = mailFeld ? a.anmeldung[mailFeld.id] : undefined;
  const mail = typeof mailWert === 'string' ? mailWert.trim() : '';
  const namePerson = e.formular.person.find((f) => f.typ === 'name');

  // Wer unterschreibt: die erste erziehungsberechtigte Person, sonst der Kontakt.
  const elternFeld = e.formular.anmeldung.find(
    (f) => f.typ === 'erziehungsberechtigte' && f.zustand !== 'aus',
  );
  const ersteEltern = elternFeld ? erziehungAus(a.anmeldung[elternFeld.id]).personen[0] : undefined;
  const unterzeichner =
    `${ersteEltern?.vor ?? ''} ${ersteEltern?.nach ?? ''}`.trim() ||
    `${kontakt.vor} ${kontakt.nach}`.trim();

  /** Ein Gruppenfeld unseres Formulars (samt weiterer Spalten) → Werte für ChurchTools. */
  const feldWerte = (f: Feld, w: Antwort): FormWert[] => {
    const ablage = ctAblage(f);
    if (ablage.ort !== 'gruppenfeld') return [];
    const spalte = (schluessel: string, name: string) => {
      const ctFeld = gruppenfeld(e.ctFelder[schluessel]);
      if (!ctFeld) throw new PasstNicht(`das Feld „${name}“ fehlt im Anmeldeformular`);
      return ctFeld;
    };
    const ctFeld = spalte(f.id, f.frage);
    if (f.typ === 'unterschrift') {
      const striche = unterschriftAus(w);
      if (!striche) return [];
      const daten = ctZusatzSpalten(f)[0];
      return [
        { id: String(ctFeld.id), type: 'custom', value: unterschriftLesbar(unterzeichner, heute) },
        { id: String(spalte(daten.schluessel, daten.name).id), type: 'custom', value: striche },
      ];
    }
    const wert = ctWert(f, w, ctFeld);
    return wert === null ? [] : [{ id: String(ctFeld.id), type: 'custom', value: wert }];
  };
  /** Ein Systemfeld (Betrag, Auswahl …) → Wert für ChurchTools. */
  const systemWert = (id: string, wert: string): FormWert => {
    const ctFeld = gruppenfeld(e.ctFelder[id]);
    if (!ctFeld) throw new PasstNicht(`das Feld „${id}“ fehlt im Anmeldeformular`);
    return { id: String(ctFeld.id), type: 'custom', value: wert };
  };

  const { nr, mitPlatz } = weiteres;
  const betrag = betragAus(e, a, wahl, heute, mitPlatz);
  const einmal: FormWert[] = [];
  if (kontakt.vor || kontakt.nach)
    einmal.push(systemWert('kontakt', `${kontakt.vor} ${kontakt.nach}`.trim()));
  for (const f of e.formular.anmeldung.filter(sichtbar))
    einmal.push(...feldWerte(f, a.anmeldung[f.id]));
  if (kannEtwasKosten(e.preis)) {
    einmal.push(systemWert('betrag', euroText(betrag.gesamtCent)));
    einmal.push(
      systemWert(
        'aufschluesselung',
        [
          ...(betrag.posten.length ? [aufschluesselungText(betrag.preis)] : []),
          ...betrag.warten.map(wartelistenZeile),
        ].join('\n'),
      ),
    );
  }
  const g = e.preis.grundpreis;
  if (g.art === 'auswahl' && g.optionen[wahl.option])
    einmal.push(systemWert('auswahl', g.optionen[wahl.option].name));
  const extras = e.preis.extras.filter((_, i) => wahl.extras[i]).map((x) => x.bezeichnung);
  if (extras.length) einmal.push(systemWert('extras', extras.join(', ')));

  const forms = a.personen.map((p, i) => {
    const n = nameVon(namePerson ? p[namePerson.id] : undefined);
    const form: FormWert[] = [
      { id: pflichtPerson('firstName'), type: 'person', value: n.vor },
      { id: pflichtPerson('lastName'), type: 'person', value: n.nach },
      { id: pflichtPerson('email'), type: 'person', value: mail },
    ];
    const geburt = e.formular.person.find((f) => f.id === 'birth' && sichtbar(f));
    if (geburt && typeof p.birth === 'string' && p.birth.trim())
      form.push({ id: pflichtPerson('birthday'), type: 'person', value: p.birth.trim() });
    for (const f of e.formular.person.filter(sichtbar)) form.push(...feldWerte(f, p[f.id]));
    if (nr && e.ctFelder.nr !== undefined) form.push(systemWert('nr', nr));
    if (i === 0) form.push(...einmal);
    if (datenschutz) form.push({ id: String(datenschutz.id), type: 'privacy', value: 'true' });
    return { form };
  });
  return { forms, hasAcceptedPrivacyForSelf: true };
}
