/**
 * **Der Reiter „Termine“** (W14, Entwurf `termine-reiter-w14-v1`) – die Regeln ohne ChurchTools: welche Termin-Bausteine
 * der Protokolle in die Liste kommen, wie aus dem Text Titel und Uhrzeit werden, was im Fenster „In Kalender eintragen“
 * vorbelegt ist, welcher Zeitraum daraus für ChurchTools wird und wann ein Termin im Kalender „schon da“ ist.
 * Geschrieben wird in `protokolle/src/terminEintragen.ts`, der Stand pro Termin liegt in `terminStand.ts`.
 *
 * - **Gesammelt** wird aus **allen Sitzungen** der Gruppen (Entwurf und freigegeben – anders als die Suche, die nur
 *   freigegebene zeigt): Wer nach der Festplanung die Termine in den Kalender bringen will, braucht sie sofort.
 *   Die Termin-Bausteine kommen aus der EINEN Ableitung (`ableiten`), ein Baustein ohne gültiges Datum fehlt.
 * - **Uhrzeit** steht im Text: „16 Uhr“, „19:30 Uhr“, „um 10.30 Uhr“. Fehlt sie, ist der Termin ganztägig.
 */
import { ortszeitAus, utcAus } from '../ct/zeit';
import { aehnlich, woerter } from './doppelt';
import { ableiten, type Punkt } from './dokument';
import { terminStandId } from './terminStand';
import { dokumentDerSitzung, type ProtokollTeil } from './speicher';
import { laufVorgabe, type Buchung } from './terminRessourcen';
import type { Sitzung } from './sitzungen';
import {
  istAutomatisch,
  ordinalAusDatum,
  WIEDERHOLUNG,
  type Wiederholung,
} from './terminWiederholung';

/** Eine Gruppe, wie `ladeUebersicht` sie liefert (nur, was hier zählt). */
export interface TerminQuelle {
  gruppe: { id: number; name: string };
  sitzungen: {
    kommend: readonly Sitzung[];
    protokolle: readonly Sitzung[];
    teile: readonly ProtokollTeil[];
  };
}

/** Ein Termin-Baustein aus einem Protokoll. */
export interface TerminZeile {
  /** Eindeutig über alle Gruppen und zugleich der Schlüssel des gespeicherten Stands (`terminStandId`). */
  schluessel: string;
  gruppe: { id: number; name: string };
  sitzung: { id: string; schluessel: string; titel: string; beginn: string };
  blockId: string;
  /** Der Text des Bausteins, wie er im Protokoll steht („Heiligabend, 16 Uhr“). */
  text: string;
  /** `JJJJ-MM-TT`. */
  datum: string;
  /** Der Tagesordnungspunkt, unter dem er steht – `null` davor. */
  punkt: Punkt | null;
}

/**
 * **Alle Termin-Bausteine** der Gruppen, nach Datum (dann neueste Sitzung zuerst, dann Reihenfolge im Dokument). Eine
 * Sitzung zählt einmal, auch wenn sie in „Kommend“ und „Protokolle“ steht; ein Entwurf ohne lesbares Dokument (Teile
 * fehlen noch) bleibt weg – er erscheint beim nächsten Lesen.
 */
export function termineSammeln(gruppen: readonly TerminQuelle[]): TerminZeile[] {
  const aus: { z: TerminZeile; zeit: number; stelle: number }[] = [];
  for (const g of gruppen) {
    const gesehen = new Set<string>();
    for (const s of [...g.sitzungen.kommend, ...g.sitzungen.protokolle]) {
      if (!s.kopf || gesehen.has(s.kopf.sitzung)) continue;
      gesehen.add(s.kopf.sitzung);
      const dokument = dokumentDerSitzung(s.kopf, g.sitzungen.teile);
      if (!dokument) continue;
      const a = ableiten(dokument);
      const punkte = new Map(a.punkte.map((p) => [p.blockId, p]));
      a.termine.forEach((t, i) => {
        if (!t.datum) return;
        aus.push({
          z: {
            schluessel: terminStandId(s.kopf!.sitzung, t.blockId),
            gruppe: g.gruppe,
            sitzung: {
              id: s.kopf!.sitzung,
              schluessel: s.schluessel,
              titel: s.titel,
              beginn: s.beginn,
            },
            blockId: t.blockId,
            text: t.text,
            datum: t.datum,
            punkt: (t.punkt && punkte.get(t.punkt)) || null,
          },
          zeit: Date.parse(s.beginn),
          stelle: i,
        });
      });
    }
  }
  return aus
    .sort(
      (a, b) =>
        a.z.datum.localeCompare(b.z.datum) ||
        b.zeit - a.zeit ||
        a.stelle - b.stelle ||
        a.z.schluessel.localeCompare(b.z.schluessel),
    )
    .map((x) => x.z);
}

/** Uhrzeit im Text: „16 Uhr“, „19:30 Uhr“, „10.30 Uhr“ – mit „um“/„ab“ davor, das mit weggeht. */
const UHR = /(?:\b(?:um|ab)\s+)?\b(\d{1,2})(?:[:.](\d{2}))?\s*Uhr\b/i;
/** Zeichen, die an der Schnittstelle zwischen Titel und Uhrzeit stehen bleiben würden („Heiligabend, “). */
const TRENNER_ENDE = /[\s,;:–—-]+$/;
const TRENNER_ANFANG = /^[\s,;:–—-]+/;

/**
 * **Titel und Uhrzeit aus dem Text eines Termin-Bausteins.** „Heiligabend, 16 Uhr“ → Titel „Heiligabend“, 16:00;
 * „Gottesdienst um 10.30 Uhr im Saal“ → „Gottesdienst im Saal“, 10:30. Ohne Uhrzeit (oder mit einer unmöglichen wie
 * „25 Uhr“) bleibt der Text, wie er ist, und `uhrzeit` ist `null` – der Termin ist dann ganztägig. Bestünde der Text
 * nur aus der Uhrzeit, bleibt er als Titel stehen.
 */
export function titelUndUhrzeit(text: string): { titel: string; uhrzeit: string | null } {
  const t = text.trim();
  const m = UHR.exec(t);
  if (!m) return { titel: t, uhrzeit: null };
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return { titel: t, uhrzeit: null };
  const davor = t.slice(0, m.index).replace(TRENNER_ENDE, '');
  const danach = t.slice(m.index + m[0].length).replace(TRENNER_ANFANG, '');
  const titel = [davor, danach].filter(Boolean).join(' ');
  return {
    titel: titel || t,
    uhrzeit: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
}

/**
 * Was im Fenster „In Kalender eintragen“ steht (Zeiten in Ortszeit der Gemeinde, `HH:MM`) – der Reiter „Kalender“ des
 * ChurchTools-Dialogs „Termin erstellen“ (W15-1). `tag`/`von` sind der Beginn, `endTag`/`bis` das Ende.
 */
export interface Eintrag extends Wiederholung {
  kalender: number | null;
  titel: string;
  untertitel: string;
  /** „Nur für eingeloggte Personen sichtbar“ (`isInternal`). */
  intern: boolean;
  /** Beginn: `JJJJ-MM-TT`. */
  tag: string;
  ganztaegig: boolean;
  von: string;
  /** Ende: `JJJJ-MM-TT` – bei ganztägigen Terminen der letzte Tag einschließlich. */
  endTag: string;
  bis: string;
  beschreibung: string;
  link: string;
  /** „Im Auftrag von“ (`onBehalfOfPid`) – kommt heute nur aus einer Termin-Vorlage. */
  imAuftrag: number | null;
  /** Ort: der Name (`address.name`) und die übrigen Felder der Adresse. */
  ort: string;
  ortStrasse: string;
  ortPlz: string;
  ortStadt: string;
  ortZusatz: string;
  /** Nummern vorhandener Tags; ein Text ist ein neuer Tag (nur mit „Tags verwalten“). */
  tags: (number | string)[];
  /** „Ersteller über Änderungen informieren“ (`informOwner`). */
  informieren: boolean;
  /** Reiter „Ressourcen“ (W15-2): Vorlauf und Nachlauf in Minuten – die Vorgabe für neue Buchungen. */
  vorlauf: number;
  nachlauf: number;
  /** Die Buchungen (nur Ressourcen, die die Person buchen darf). */
  buchungen: Buchung[];
}

/** Eine Stunde später, am selben Tag (nach 23:00 bleibt es 23:59 – ChurchTools-Termine hier enden nie am Folgetag). */
export function plusStunde(uhrzeit: string): string {
  const [h, m] = uhrzeit.split(':').map(Number);
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * **Die Vorbelegung** aus Text und Datum des Bausteins: Titel ohne Uhrzeit, Datum, ganztägig ohne Uhrzeit im Text,
 * sonst Von = die Uhrzeit und Bis = eine Stunde später. `kalender` ist der gewählte Kalender (`null`: keiner).
 */
export function eintragVorbelegung(
  z: Pick<TerminZeile, 'text' | 'datum'>,
  kalender: number | null,
): Eintrag {
  const { titel, uhrzeit } = titelUndUhrzeit(z.text);
  return {
    kalender,
    titel,
    untertitel: '',
    intern: false,
    tag: z.datum,
    ganztaegig: uhrzeit === null,
    von: uhrzeit ?? '10:00',
    endTag: z.datum,
    bis: plusStunde(uhrzeit ?? '10:00'),
    art: WIEDERHOLUNG.keine,
    frequenz: 1,
    option: ordinalAusDatum(z.datum),
    wiederBis: '',
    weitere: [],
    ausnahmen: [],
    beschreibung: '',
    link: '',
    imAuftrag: null,
    ort: '',
    ortStrasse: '',
    ortPlz: '',
    ortStadt: '',
    ortZusatz: '',
    tags: [],
    // ChurchTools hakt es vor.
    informieren: true,
    vorlauf: laufVorgabe(uhrzeit === null),
    nachlauf: laufVorgabe(uhrzeit === null),
    buchungen: [],
  };
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/**
 * **Den Beginn-Tag ändern.** Das Ende zieht mit, wenn es am selben Tag lag (oder davor läge) – wie im ChurchTools-Dialog;
 * ein späteres Ende bleibt. „Monatlich nach Wochentag“ rechnet das Ordinal neu aus dem Datum.
 */
export function beginnTagWechseln(e: Eintrag, tag: string): Eintrag {
  const endTag = e.endTag === e.tag || (TAG.test(tag) && e.endTag < tag) ? tag : e.endTag;
  const neuesOrdinal = e.art === WIEDERHOLUNG.monatlichWochentag && TAG.test(tag);
  return { ...e, tag, endTag, option: neuesOrdinal ? ordinalAusDatum(tag) : e.option };
}

/** Was am Fenster noch fehlt – `null`, wenn eingetragen werden kann. */
export function eintragFehler(e: Eintrag): string | null {
  if (e.kalender === null) return 'Bitte einen Kalender wählen.';
  if (!e.titel.trim()) return 'Bitte einen Titel angeben.';
  if (!TAG.test(e.tag)) return 'Bitte ein Datum angeben.';
  const endTag = e.endTag || e.tag;
  if (!TAG.test(endTag)) return 'Bitte ein Enddatum angeben.';
  if (endTag < e.tag) return 'Das Ende darf nicht vor dem Beginn liegen.';
  if (!e.ganztaegig) {
    if (!/^\d{2}:\d{2}$/.test(e.von) || !/^\d{2}:\d{2}$/.test(e.bis))
      return 'Bitte Beginn und Ende angeben.';
    if (endTag === e.tag && e.bis <= e.von) return 'Das Ende muss nach dem Beginn liegen.';
  }
  if (istAutomatisch(e.art)) {
    if (!TAG.test(e.wiederBis))
      return 'Bitte angeben, bis wann sich der Termin wiederholt („Bis“).';
    if (e.wiederBis < e.tag) return 'Das „Bis“ darf nicht vor dem Beginn liegen.';
    if (!Number.isInteger(e.frequenz) || e.frequenz < 1)
      return 'Bitte bei „Alle …“ eine Zahl ab 1 angeben.';
  }
  return null;
}

/**
 * **Beginn und Ende für ChurchTools.** Ganztägig: nur der Tag (`JJJJ-MM-TT`), das Ende ist der letzte Tag einschließlich –
 * so liefert ChurchTools ganztägige Termine auch (`calculated.startDate`/`endDate`, gemessen am Ferienkalender
 * 11./12.11.2026). Mit Uhrzeit: UTC aus der Ortszeit der Gemeinde (`utcAus`, auch über die Zeitumstellung).
 */
export function eintragZeitraum(
  e: Pick<Eintrag, 'tag' | 'ganztaegig' | 'von' | 'bis'> & { endTag?: string },
  zeitzone: string,
): { beginn: string; ende: string } {
  const endTag = e.endTag || e.tag;
  if (e.ganztaegig) return { beginn: e.tag, ende: endTag };
  return {
    beginn: utcAus(`${e.tag}T${e.von}`, zeitzone),
    ende: utcAus(`${endTag}T${e.bis}`, zeitzone),
  };
}

/** Der Termin im Kalender, wie er hier gebraucht wird: Nummer, Titel und Beginn (Tag bei ganztägigen). */
export interface KalenderTermin {
  id: number;
  titel: string;
  beginn: string;
}

/**
 * **Steht am Tag schon so ein Termin?** – gleicher Titel im Sinn von `aehnlich` (W12) **oder** alle Wörter des kürzeren
 * Titels stehen im längeren („Heiligabend“ in „Heiligabend – Familiengottesdienst“). Das zweite ist hier erlaubt, weil
 * Kalender **und Tag** schon übereinstimmen – `aehnlich` allein verlangt zwei gemeinsame Wörter, weil es beliebige
 * Zeilen vergleicht. Der erste Treffer; `null`, wenn keiner passt.
 */
export function aehnlicherTermin(
  titel: string,
  imKalender: readonly KalenderTermin[],
): KalenderTermin | null {
  const mein = woerter(titel);
  if (!mein.size) return null;
  return (
    imKalender.find((t) => {
      if (aehnlich(titel, t.titel)) return true;
      const sein = woerter(t.titel);
      if (!sein.size) return false;
      const [klein, gross] = mein.size <= sein.size ? [mein, sein] : [sein, mein];
      return [...klein].every((w) => gross.has(w));
    }) ?? null
  );
}

/**
 * **Wann, in Worten** für „Im Kalender“: „ganztägig“ (ChurchTools liefert dann nur den Tag) oder „16:00 Uhr“ in
 * Ortszeit der Gemeinde.
 */
export function terminZeitText(beginn: string, zeitzone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(beginn)) return 'ganztägig';
  return `${ortszeitAus(beginn, zeitzone).slice(11, 16)} Uhr`;
}

/**
 * **Der Link nach ChurchTools** – der Kalender der Instanz (`/?q=churchcal`, so verlinkt ChurchTools selbst). Bis 1.5.1
 * stand hier `/calendars` – das ist nur ein API-Pfad, im Browser kam eine 404-Seite (Handtest TF-PROT-31, 23.11.2026).
 * Eine Adresse für genau diesen Termin ist nicht gemessen; hier der eine Ort, falls sie bekannt wird.
 */
export const terminLink = (basis: string): string => `${basis.replace(/\/+$/, '')}/?q=churchcal`;

/**
 * **„Ganztägig“ umschalten** (W15-2). Wie in ChurchTools wechselt die Vorgabe für Vorlauf/Nachlauf mit (Uhrzeit 15/15,
 * ganztägig 0/0) – aber nur, solange dort noch die alte Vorgabe steht: Selbst Eingetipptes bleibt. Die Zeilen der Tabelle
 * „Vorhandene Buchungen“ behalten ihre eigenen Werte.
 */
export function ganztaegigWechseln(e: Eintrag, an: boolean): Eintrag {
  if (e.ganztaegig === an) return e;
  const alt = laufVorgabe(e.ganztaegig);
  const neu = laufVorgabe(an);
  return {
    ...e,
    ganztaegig: an,
    vorlauf: e.vorlauf === alt ? neu : e.vorlauf,
    nachlauf: e.nachlauf === alt ? neu : e.nachlauf,
  };
}
