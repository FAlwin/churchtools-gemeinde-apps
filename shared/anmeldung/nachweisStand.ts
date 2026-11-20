/**
 * **Der Stand je Person in einer Nachweis-Art** (N2a, „Stand lesen“; Entwurf `n2-stand-v1`, Alwin 20.11.2026) – die EINE
 * Stelle für die Regeln: Welcher Stand, welcher Text, welche Farbe, wer braucht die Vertrauensperson, was steht auf der
 * Startseite. Tabelle, Handy-Liste und Startseite nutzen nur das hier.
 *
 * Alles ist rein: „heute“ kommt als `YYYY-MM-DD` herein (`heuteImKalender()`), nirgends wird eine Uhr gelesen. Gelesen wird
 * in `anmeldungen/src/nachweisPersonen.ts`.
 *
 * | Stand           | Wann                                                                              | Ton    | Aufmerksamkeit |
 * | --------------- | --------------------------------------------------------------------------------- | ------ | -------------- |
 * | Rücksprache     | Ergebnis = „Eintragung“ (egal welches Datum)                                      | rot    | ja             |
 * | abgelaufen      | eingesehen, „Gültig bis“ liegt vor heute                                          | rot    | ja             |
 * | läuft ab        | eingesehen, „Gültig bis“ in 0–56 Tagen                                            | blau   | ja             |
 * | gültig          | eingesehen, „Gültig bis“ mehr als 56 Tage nach heute                              | grün   | nein           |
 * | fehlt           | keine Einsicht, Aufgabe offen und älter als 28 Tage                               | rot    | ja             |
 * | angefordert     | keine Einsicht, Aufgabe offen, höchstens 28 Tage alt                              | blau   | nein           |
 * | noch keine Aufg.| weder Einsicht noch offene Aufgabe                                                | grau   | nein           |
 * | unvollständig   | eingesehen, aber das Datum für „Gültig bis“ fehlt                                 | grau   | nein           |
 */
import { tageBis, tagMonat, tagPunkt } from '../ct/datum';
import {
  NACHWEIS_AUFGABE_ERNEUT,
  NACHWEIS_AUFGABE_ERSTE,
  gleicherGruppenName,
  nachweisGueltigText,
  type NachweisAb,
  type NachweisEinstellungen,
} from './nachweise';

/** Ab wie vielen Tagen ohne Einsicht eine offene Aufgabe als „fehlt“ gilt (vier Wochen). */
export const FEHLT_NACH_TAGEN = 28;
/** So viele Tage vor dem Ablauf beginnt „läuft ab“ (acht Wochen). */
export const LAEUFT_AB_TAGE = 56;

export type EtikettTonNachweis = 'neutral' | 'blau' | 'gruen' | 'rot';

/** Das Ergebnis der Einsicht, wie die Gruppenfelder es hergeben: `null` = nicht eingetragen. */
export type NachweisErgebnisWert = 'ohne' | 'eintrag' | null;

export type NachweisStand =
  | { art: 'angefordert'; seit: string | null }
  | { art: 'fehlt'; seit: string; wochen: number }
  | { art: 'gueltig'; bis: string }
  | { art: 'laeuftAb'; bis: string }
  | { art: 'abgelaufen'; bis: string }
  | { art: 'ruecksprache' }
  | { art: 'keineAufgabe' }
  | { art: 'unvollstaendig' };

/** Alles, was die Regeln über EINE Person wissen müssen. */
export interface PersonAngaben {
  /** `YYYY-MM-DD` oder `null`. */
  eingesehenAm: string | null;
  ausgestelltAm: string | null;
  ergebnis: NachweisErgebnisWert;
  /**
   * Die offene Folgeaufgabe („Einsicht nehmen“ / „Erneut einsehen“): `null` = keine offene. `seit` ist der Tag, an dem sie
   * angelegt wurde (Ortszeit der Gemeinde) – `null`, wenn er sich nicht ermitteln ließ.
   */
  aufgabe: { seit: string | null } | null;
  /** Geburtsdatum und Adresse aus dem Profil – `null`, wenn sie nicht gelesen wurden (kein Antrag, kein Recht). */
  profil: {
    geburtstag: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
  } | null;
}

export interface PersonStand {
  stand: NachweisStand;
  /** `YYYY-MM-DD` – `null`, wenn nichts eingesehen ist oder das Datum fehlt. */
  gueltigBis: string | null;
  /** „Antrag unvollständig: …“ oder `null`. */
  luecke: string | null;
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Ein Tag als `YYYY-MM-DD` oder `null` (ChurchTools liefert `null`, leere Texte oder ein Datum mit Uhrzeit). */
export function tagAus(wert: unknown): string | null {
  if (typeof wert !== 'string') return null;
  const t = wert.trim().slice(0, 10);
  return ISO_TAG.test(t) ? t : null;
}

const schaltjahr = (j: number) => (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;

/** `tag` plus `jahre` Jahre; der 29.02. wird in einem Jahr ohne Schalttag zum 28.02. */
export function plusJahre(tag: string, jahre: number): string {
  const j = Number(tag.slice(0, 4)) + jahre;
  const md = tag.slice(5, 10);
  const mdNeu = md === '02-29' && !schaltjahr(j) ? '02-28' : md;
  return `${String(j).padStart(4, '0')}-${mdNeu}`;
}

/**
 * **„Gültig bis“** – Datum auf dem Zeugnis (`ab: 'ausstellung'`) bzw. Tag der Einsicht (`ab: 'einsicht'`) plus die Jahre
 * der Art. `null`, wenn das nötige Datum fehlt. Die eine Stelle dafür (auch N2b nutzt sie).
 */
export function nachweisGueltigBis(
  e: Pick<NachweisEinstellungen, 'gueltigJahre' | 'ab'>,
  d: { eingesehenAm: string | null; ausgestelltAm: string | null },
): string | null {
  const start = e.ab === 'ausstellung' ? d.ausgestelltAm : d.eingesehenAm;
  return start ? plusJahre(start, e.gueltigJahre) : null;
}

const leer = (t: string | null | undefined) => !t || t.trim() === '';

/**
 * **Die Lücken im Profil, die den Antrag lückenhaft machen** – „Antrag unvollständig: Geburtsdatum und Adresse fehlen“.
 * Nur bei Arten mit Antrag und nur, solange die Person einen Antrag braucht (angefordert, fehlt, läuft ab, abgelaufen,
 * noch keine Aufgabe); sonst `null`. Eine nicht gelesene Person (`profil` `null`) hat keine bekannten Lücken.
 */
export function antragLuecke(
  stand: NachweisStand,
  mitAntrag: boolean,
  profil: PersonAngaben['profil'],
): string | null {
  if (!mitAntrag || !profil) return null;
  const braucht =
    stand.art === 'angefordert' ||
    stand.art === 'fehlt' ||
    stand.art === 'laeuftAb' ||
    stand.art === 'abgelaufen' ||
    stand.art === 'keineAufgabe';
  if (!braucht) return null;
  const geburt = leer(profil.geburtstag);
  const adresse = leer(profil.strasse) || leer(profil.plz) || leer(profil.ort);
  if (geburt && adresse) return 'Antrag unvollständig: Geburtsdatum und Adresse fehlen';
  if (adresse) return 'Antrag unvollständig: Adresse fehlt';
  if (geburt) return 'Antrag unvollständig: Geburtsdatum fehlt';
  return null;
}

/** **Der Stand einer Person** nach der Tabelle oben. `einstellungen` `null`: die Art ist nicht fertig eingerichtet. */
export function personStand(
  a: PersonAngaben,
  einstellungen: NachweisEinstellungen | null,
  heute: string,
): PersonStand {
  const gueltigBis = a.eingesehenAm && einstellungen ? nachweisGueltigBis(einstellungen, a) : null;
  const stand = standVon(a, gueltigBis, heute);
  return {
    stand,
    gueltigBis,
    luecke: antragLuecke(stand, Boolean(einstellungen?.antrag?.an), a.profil),
  };
}

function standVon(a: PersonAngaben, gueltigBis: string | null, heute: string): NachweisStand {
  // „Eintragung“ geht vor jedem Datum – auch bei einer Person, die noch nichts eingesehen hat.
  if (a.ergebnis === 'eintrag') return { art: 'ruecksprache' };
  if (a.eingesehenAm) {
    if (!gueltigBis) return { art: 'unvollstaendig' };
    const tage = tageBis(heute, gueltigBis);
    if (tage < 0) return { art: 'abgelaufen', bis: gueltigBis };
    if (tage <= LAEUFT_AB_TAGE) return { art: 'laeuftAb', bis: gueltigBis };
    return { art: 'gueltig', bis: gueltigBis };
  }
  if (a.aufgabe) {
    const seit = a.aufgabe.seit;
    if (seit && tageBis(seit, heute) > FEHLT_NACH_TAGEN)
      return { art: 'fehlt', seit, wochen: Math.floor(tageBis(seit, heute) / 7) };
    return { art: 'angefordert', seit };
  }
  return { art: 'keineAufgabe' };
}

// ── Text und Farbe: je Stand an EINER Stelle ─────────────────────────────────────────────────────────────────────

/** Der Text im Etikett: „fehlt seit 5 Wochen“, „läuft ab am 28.12.“. */
export function standText(s: NachweisStand): string {
  switch (s.art) {
    case 'angefordert':
      return s.seit ? `angefordert am ${tagMonat(s.seit)}` : 'angefordert';
    case 'fehlt':
      return `fehlt seit ${s.wochen} Wochen`;
    case 'gueltig':
      return 'gültig';
    case 'laeuftAb':
      return `läuft ab am ${tagMonat(s.bis)}`;
    case 'abgelaufen':
      return `abgelaufen seit ${tagMonat(s.bis)}`;
    case 'ruecksprache':
      return 'Rücksprache';
    case 'keineAufgabe':
      return 'noch keine Aufgabe';
    case 'unvollstaendig':
      return 'Angaben unvollständig';
  }
}

/** Die Farbe des Etiketts (`Etikett`): läuft ab ist blau, Rot bleibt dem vorbehalten, was fehlt oder vorbei ist. */
export function standTon(s: NachweisStand): EtikettTonNachweis {
  switch (s.art) {
    case 'gueltig':
      return 'gruen';
    case 'angefordert':
    case 'laeuftAb':
      return 'blau';
    case 'fehlt':
    case 'abgelaufen':
    case 'ruecksprache':
      return 'rot';
    case 'keineAufgabe':
    case 'unvollstaendig':
      return 'neutral';
  }
}

/** Braucht die Vertrauensperson (Startseite „Braucht deine Aufmerksamkeit“, Filter auf der Seite)? */
export function brauchtAufmerksamkeit(s: NachweisStand): boolean {
  return (
    s.art === 'fehlt' || s.art === 'laeuftAb' || s.art === 'abgelaufen' || s.art === 'ruecksprache'
  );
}

/** Wartet nur ab (zählt in der Karte als „angefordert“). */
const istAngefordert = (s: NachweisStand) =>
  s.art === 'angefordert' || s.art === 'keineAufgabe' || s.art === 'unvollstaendig';

/** Reihenfolge in der Tabelle: erst rot (braucht dich), dann blau „läuft ab“, dann angefordert, dann gültig. */
export function standRang(s: NachweisStand): number {
  if (s.art === 'fehlt' || s.art === 'abgelaufen' || s.art === 'ruecksprache') return 0;
  if (s.art === 'laeuftAb') return 1;
  if (istAngefordert(s)) return 2;
  return 3;
}

/** Sortiert (neue Liste): nach Rang, innerhalb nach Name. */
export function nachStand<T extends { name: string; stand: NachweisStand }>(
  liste: readonly T[],
): T[] {
  return [...liste].sort(
    (x, y) => standRang(x.stand) - standRang(y.stand) || x.name.localeCompare(y.name, 'de'),
  );
}

// ── Zählung je Art ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Aufmerksamkeit {
  fehlt: number;
  laeuftAb: number;
  abgelaufen: number;
  ruecksprache: number;
  /** Alle vier zusammen = Personen, die die Vertrauensperson braucht. */
  summe: number;
}

export function aufmerksamkeitZaehlen(staende: readonly NachweisStand[]): Aufmerksamkeit {
  const z = (art: NachweisStand['art']) => staende.filter((s) => s.art === art).length;
  const fehlt = z('fehlt');
  const laeuftAb = z('laeuftAb');
  const abgelaufen = z('abgelaufen');
  const ruecksprache = z('ruecksprache');
  return {
    fehlt,
    laeuftAb,
    abgelaufen,
    ruecksprache,
    summe: fehlt + laeuftAb + abgelaufen + ruecksprache,
  };
}

const person = (n: number) => (n === 1 ? '1 Person' : `${n} Personen`);

/** „7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich“ – Teile mit 0 fehlen; alle gültig: „2 Personen: alle gültig“. */
export function zaehlText(staende: readonly NachweisStand[]): string {
  const n = staende.length;
  if (n === 0) return 'Noch niemand eingetragen';
  const gueltig = staende.filter((s) => s.art === 'gueltig').length;
  if (gueltig === n) return `${person(n)}: alle gültig`;
  const angefordert = staende.filter(istAngefordert).length;
  const brauchen = aufmerksamkeitZaehlen(staende).summe;
  const teile = [
    gueltig > 0 ? `${gueltig} gültig` : null,
    angefordert > 0 ? `${angefordert} angefordert` : null,
    brauchen > 0 ? (brauchen === 1 ? '1 braucht dich' : `${brauchen} brauchen dich`) : null,
  ].filter((t): t is string => t !== null);
  return `${person(n)}: ${teile.join(' · ')}`;
}

/** Die Etiketten der Startseite je Art: nur Fälle mit Zahl > 0, in fester Reihenfolge. */
export function aufmerksamkeitEtiketten(
  a: Aufmerksamkeit,
): { text: string; ton: EtikettTonNachweis }[] {
  const liste: { text: string; ton: EtikettTonNachweis }[] = [];
  if (a.fehlt > 0)
    liste.push({
      text: `${a.fehlt} ${a.fehlt === 1 ? 'fehlt' : 'fehlen'} seit über 4 Wochen`,
      ton: 'rot',
    });
  if (a.laeuftAb > 0)
    liste.push({
      text: `${a.laeuftAb} ${a.laeuftAb === 1 ? 'läuft' : 'laufen'} bald ab`,
      ton: 'blau',
    });
  if (a.abgelaufen > 0) liste.push({ text: `${a.abgelaufen} abgelaufen`, ton: 'rot' });
  if (a.ruecksprache > 0) liste.push({ text: `${a.ruecksprache} Rücksprache`, ton: 'rot' });
  return liste;
}

/** „4 Personen brauchen dich als Vertrauensperson.“ / „1 Person braucht dich …“ */
export function brauchenDichText(n: number): string {
  return n === 1
    ? '1 Person braucht dich als Vertrauensperson.'
    : `${n} Personen brauchen dich als Vertrauensperson.`;
}

// ── Einsicht festhalten (N2b) ────────────────────────────────────────────────────────────────────────────────────

/** Die offene Folgeaufgabe, soweit die Regeln sie brauchen. `angelegt`: Tag der Anlage (Ortszeit), `null` = unbekannt. */
export interface AufgabeKern {
  titel: string;
  angelegt: string | null;
}

/**
 * **Erledigt diese Einsicht die offene Aufgabe?** DIE Stelle für „neue Einsicht oder nur berichtigen“ – Fenster, Schreiben
 * und Nachziehen nutzen nur sie.
 *
 * - **„Einsicht nehmen“** (die erste Anforderung): jede festgehaltene Einsicht erledigt sie – auch eine, die vor der
 *   Anforderung lag (z. B. ein Zeugnis, das schon gesehen wurde, bevor die Person in der Gruppe stand).
 * - **„Erneut einsehen“** entsteht am Tag, an dem die vorige Einsicht festgehalten wurde – meist derselbe Tag wie
 *   „Eingesehen am“. Erledigt wird sie darum nur durch eine Einsicht **nach** diesem Tag; eine Berichtigung der alten
 *   Angaben (gleicher Tag oder früher) lässt sie offen. Gefunden in der Demo-Abnahme N2b (20.11.2026): Mit „am Tag der
 *   Anlage oder später“ hätte jede Berichtigung (z. B. Rücksprache → keine Eintragung) die Aufgabe abgehakt.
 *   Unbekannter Anlagetag: nicht erledigen (lieber eine Aufgabe zu viel offen als eine zu Unrecht abgehakt).
 */
export function aufgabeErledigtDurch(
  aufgabe: Pick<AufgabeKern, 'titel' | 'angelegt'> | null,
  eingesehenAm: string | null,
): boolean {
  if (!aufgabe || !eingesehenAm) return false;
  if (istErsteAufgabe(aufgabe.titel)) return true;
  return Boolean(aufgabe.angelegt && eingesehenAm > aufgabe.angelegt);
}

export type NachweisVerschieben = 'vorhandene' | 'naechste' | null;

/** Was beim Festhalten mit der Aufgabe geschieht. */
export interface EinsichtPlan {
  /** Neue Einsicht (erledigt die offene Aufgabe) – sonst nur berichtigt. */
  neu: boolean;
  gueltigBis: string | null;
  /** Titel der Aufgabe, die erledigt wird. */
  erledigt: string | null;
  /**
   * Das Datum, auf das „Erneut einsehen“ gelegt wird: `gueltigBis`, aber nur wenn es **nach heute** liegt – ChurchTools
   * verschiebt nur auf ein Datum strikt nach heute (OpenAPI, 20.11.2026). Sonst `null`: auslassen, kein Fehler.
   */
  verschiebenAuf: string | null;
  /**
   * `vorhandene`: die offene „Erneut einsehen“ wird verschoben (Berichtigung); `naechste`: die nach dem Erledigen neu
   * angelegte „Erneut einsehen“ (bei „Einsicht nehmen“ sofort, bei „Erneut einsehen“ erst morgen); `null`: nichts.
   */
  verschieben: NachweisVerschieben;
}

export function einsichtPlan(a: {
  einstellungen: Pick<NachweisEinstellungen, 'gueltigJahre' | 'ab'>;
  eingesehenAm: string;
  ausgestelltAm: string | null;
  aufgabe: AufgabeKern | null;
  heute: string;
}): EinsichtPlan {
  const gueltigBis = nachweisGueltigBis(a.einstellungen, a);
  const neu = aufgabeErledigtDurch(a.aufgabe, a.eingesehenAm);
  const erneut = a.aufgabe ? gleicherGruppenName(a.aufgabe.titel, NACHWEIS_AUFGABE_ERNEUT) : false;
  const verschiebenAuf = gueltigBis && gueltigBis > a.heute ? gueltigBis : null;
  return {
    neu,
    gueltigBis,
    erledigt: neu && a.aufgabe ? a.aufgabe.titel : null,
    verschiebenAuf,
    verschieben: !verschiebenAuf ? null : neu ? 'naechste' : erneut ? 'vorhandene' : null,
  };
}

export interface EinsichtWerte {
  eingesehenAm: string;
  ausgestelltAm: string;
  ergebnis: 'ohne' | 'eintrag' | '';
}

/**
 * **Die Vorbelegung des Fensters.** Keine Einsicht oder „läuft ab“/„abgelaufen“ → neue Einsicht: heute, Ausgestellt leer,
 * Ergebnis leer (bei „läuft ab/abgelaufen“ das bisherige). Sonst die gespeicherten Werte (berichtigen).
 */
export function einsichtVorbelegung(
  p: Pick<PersonAngaben, 'eingesehenAm' | 'ausgestelltAm' | 'ergebnis'>,
  stand: NachweisStand,
  heute: string,
): EinsichtWerte {
  const neu = !p.eingesehenAm || stand.art === 'laeuftAb' || stand.art === 'abgelaufen';
  if (neu)
    return {
      eingesehenAm: heute,
      ausgestelltAm: '',
      ergebnis: p.eingesehenAm ? (p.ergebnis ?? '') : '',
    };
  return {
    eingesehenAm: p.eingesehenAm ?? '',
    ausgestelltAm: p.ausgestelltAm ?? '',
    ergebnis: p.ergebnis ?? '',
  };
}

/** **Was fehlt oder passt nicht?** Der erste Prüftext oder `null`. */
export function einsichtFehler(w: EinsichtWerte, ab: NachweisAb, heute: string): string | null {
  if (!w.eingesehenAm) return 'Bitte eintragen, wann du das Zeugnis gesehen hast.';
  if (w.eingesehenAm > heute) return '„Eingesehen am“ liegt in der Zukunft.';
  if (ab === 'ausstellung' && !w.ausgestelltAm) return 'Bitte das Datum auf dem Zeugnis eintragen.';
  if (w.ausgestelltAm && w.ausgestelltAm > w.eingesehenAm)
    return 'Das Zeugnis kann nicht nach der Einsicht ausgestellt sein.';
  if (!w.ergebnis) return 'Bitte ein Ergebnis wählen.';
  return null;
}

/** Die Zeilen des blauen Kastens, abgeleitet aus dem Plan. */
export function einsichtFolgeTexte(
  plan: EinsichtPlan,
  einstellungen: Pick<NachweisEinstellungen, 'gueltigJahre' | 'ab'>,
  ergebnis: 'ohne' | 'eintrag',
  bisherErgebnis: NachweisErgebnisWert,
): string[] {
  const zeilen: string[] = [];
  const bis = plan.gueltigBis ? tagPunkt(plan.gueltigBis) : null;
  zeilen.push(
    `${plan.neu ? 'Neue Einsicht' : 'Nur die Angaben werden berichtigt'}${bis ? ` · gültig bis ${bis} (${nachweisGueltigText(einstellungen)})` : ''}.`,
  );
  if (plan.erledigt) {
    const wird = `Die Aufgabe „${plan.erledigt}“ wird erledigt.`;
    zeilen.push(
      plan.verschiebenAuf
        ? `${wird} Die nächste „${NACHWEIS_AUFGABE_ERNEUT}“ bekommt den ${tagPunkt(plan.verschiebenAuf)}.`
        : wird,
    );
  } else if (plan.verschieben === 'vorhandene' && plan.verschiebenAuf) {
    zeilen.push(
      `Keine Aufgabe wird erledigt; „${NACHWEIS_AUFGABE_ERNEUT}“ bleibt offen, Datum ${tagPunkt(plan.verschiebenAuf)}.`,
    );
  } else {
    zeilen.push('Keine Aufgabe wird erledigt.');
  }
  if (ergebnis === 'eintrag')
    zeilen.push(
      'Stand bleibt „Rücksprache“ (rot), bis jemand das Ergebnis nach dem Gespräch ändert.',
    );
  else if (bisherErgebnis === 'eintrag')
    zeilen.push('Danach ist der Stand wieder grün, die Rücksprache ist erledigt.');
  return zeilen;
}

/** Ist es die erste Aufgabe des Ablaufs („Einsicht nehmen“)? */
export const istErsteAufgabe = (titel: string) =>
  gleicherGruppenName(titel, NACHWEIS_AUFGABE_ERSTE);
