/**
 * **Termin-Vorlagen** (W15-1) – die Liste „Termin-Vorlagen <Kalender>“ im Fenster „In Kalender eintragen“, wie im
 * ChurchTools-Dialog „Termin erstellen“ (`GET/POST /calendars/appointments/templates`, gemessen 23.11.2026 in
 * `protokolle-planung/docs/messung-w15-0-2026-11-23.md`).
 *
 * Eine Vorlage speichert **Beginn-Uhrzeit** (`startTime`, „HH:mm“), **Dauer** in Sekunden (`duration`, ganztägig: 0 = ein
 * Tag), die **Wiederholung** (`repeatId`, `repeatFrequency`, `repeatOptionId`) und als `repeatDuration` die Sekunden vom
 * Beginn bis zum Serienende. Wird sie gewählt, bleibt das **Datum** des Termins, alles andere kommt aus der Vorlage; „Ende“
 * = Beginn + Dauer, „Bis“ = Beginn + `repeatDuration`.
 *
 * Buchungen, Events und Anmeldung stehen auch in der Vorlage – sie werden erst in W15-2/3/5 ausgewertet und hier **nicht**
 * übernommen.
 */
import { plusTage } from '../ct/datum';
import type { Eintrag } from './termine';
import { eintragAdresse, type TerminAdresse } from './terminFelder';
import { bisVorgabe, istAutomatisch, ordinalAusDatum, WIEDERHOLUNG } from './terminWiederholung';

const TAGSEKUNDEN = 86_400;

/** Eine Termin-Vorlage, soweit sie hier gebraucht wird. */
export interface TerminVorlage {
  id: number;
  kalender: number;
  titel: string;
  untertitel: string;
  beschreibung: string;
  link: string;
  intern: boolean;
  ganztaegig: boolean;
  /** „HH:mm“ – leer, wenn die Vorlage keine hat. */
  startzeit: string;
  /** Sekunden. */
  dauer: number;
  art: number;
  frequenz: number;
  /** `repeatOptionId` – 0, wenn keine. */
  option: number;
  /** Sekunden vom Beginn bis zum Serienende. */
  wiederDauer: number;
  adresse: TerminAdresse | null;
  /** Nummern der Tags. */
  tags: number[];
  imAuftrag: number | null;
}

const zahl = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const text = (x: unknown): string => (typeof x === 'string' ? x : '');
const objekt = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

function adresseAus(roh: unknown): TerminAdresse | null {
  const o = objekt(roh);
  if (!o) return null;
  const a: TerminAdresse = {};
  // ChurchTools nannte das Feld früher `meetingAt` – wer eine alte Vorlage liest, soll den Namen nicht verlieren.
  const name = text(o.name) || text(o.meetingAt);
  if (name.trim()) a.name = name.trim();
  if (text(o.street).trim()) a.street = text(o.street).trim();
  if (text(o.zip).trim()) a.zip = text(o.zip).trim();
  if (text(o.city).trim()) a.city = text(o.city).trim();
  if (text(o.addition).trim()) a.addition = text(o.addition).trim();
  return Object.keys(a).length ? a : null;
}

/** Eine Vorlage aus der Antwort von ChurchTools – `null`, wenn Nummer, Kalender oder Titel fehlen. */
function vorlageAus(roh: unknown): TerminVorlage | null {
  const o = objekt(roh);
  if (!o) return null;
  const id = zahl(o.id);
  const kalender = zahl(o.calendarId);
  const titel = text(o.title);
  if (id === null || kalender === null || !titel.trim()) return null;
  const tags = Array.isArray(o.tags)
    ? o.tags.flatMap((t) => {
        const n = zahl(objekt(t)?.id ?? t);
        return n === null ? [] : [n];
      })
    : [];
  return {
    id,
    kalender,
    titel,
    untertitel: text(o.subtitle),
    beschreibung: text(o.description),
    link: text(o.link),
    intern: o.isInternal === true,
    ganztaegig: o.allDay === true,
    startzeit: /^\d{2}:\d{2}/.test(text(o.startTime)) ? text(o.startTime).slice(0, 5) : '',
    dauer: Math.max(0, zahl(o.duration) ?? 0),
    art: zahl(o.repeatId) ?? 0,
    frequenz: Math.max(1, zahl(o.repeatFrequency) ?? 1),
    option: zahl(o.repeatOptionId) ?? 0,
    wiederDauer: Math.max(0, zahl(o.repeatDuration) ?? 0),
    adresse: adresseAus(o.address),
    tags,
    imAuftrag: zahl(o.onBehalfOfPid),
  };
}

/** **Die Vorlagen aus der Antwort** (`data` = Liste) – ohne die, deren Pflichtfelder fehlen, nach Titel sortiert. */
export function vorlagenAus(roh: unknown): TerminVorlage[] {
  return (Array.isArray(roh) ? roh : [])
    .flatMap((r) => {
      const v = vorlageAus(r);
      return v ? [v] : [];
    })
    .sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
}

// ── Rechnen mit Tag + Uhrzeit (Wanduhr, ohne Zeitzone – eine Vorlage kennt keine) ───────────────────────────────

const wand = (tag: string, zeit: string): number =>
  Date.UTC(
    Number(tag.slice(0, 4)),
    Number(tag.slice(5, 7)) - 1,
    Number(tag.slice(8, 10)),
    Number(zeit.slice(0, 2)),
    Number(zeit.slice(3, 5)),
  );

/** `tag` + `zeit` plus Sekunden → neuer Tag und neue Uhrzeit. */
export function plusSekunden(
  tag: string,
  zeit: string,
  sekunden: number,
): { tag: string; zeit: string } {
  const d = new Date(wand(tag, zeit) + sekunden * 1000);
  return { tag: d.toISOString().slice(0, 10), zeit: d.toISOString().slice(11, 16) };
}

/** Sekunden zwischen zwei Zeitpunkten (Tag + Uhrzeit). */
export const sekundenZwischen = (t1: string, z1: string, t2: string, z2: string): number =>
  Math.round((wand(t2, z2) - wand(t1, z1)) / 1000);

/** Tage zwischen zwei Tagen. */
const tageZwischen = (t1: string, t2: string): number =>
  Math.round((wand(t2, '00:00') - wand(t1, '00:00')) / 1000 / TAGSEKUNDEN);

// ── Anwenden und Speichern ──────────────────────────────────────────────────────────────────────────────────────

/**
 * **Eine Vorlage anwenden.** Das Datum des Beginns bleibt, Kalender ebenfalls; alles andere kommt aus der Vorlage: Titel,
 * Untertitel, Beschreibung, Link, „intern“, „Ganztägig“, Beginn-Uhrzeit, Ende = Beginn + Dauer, Wiederholung, „Bis“ =
 * Beginn + `repeatDuration`, Adresse, Tags und „Im Auftrag von“. Weitere Termine und Ausnahmen gibt es in Vorlagen nicht –
 * sie werden geleert. „Ersteller informieren“ ist keine Sache der Vorlage und bleibt.
 */
export function vorlageAnwenden(e: Eintrag, v: TerminVorlage): Eintrag {
  const von = v.ganztaegig ? e.von : v.startzeit || e.von;
  const ende = v.ganztaegig
    ? { tag: plusTage(e.tag, Math.floor(v.dauer / TAGSEKUNDEN)), zeit: e.bis }
    : plusSekunden(e.tag, von, v.dauer);
  const art = v.art;
  const automatisch = istAutomatisch(art);
  return {
    ...e,
    titel: v.titel,
    untertitel: v.untertitel,
    beschreibung: v.beschreibung,
    link: v.link,
    intern: v.intern,
    ganztaegig: v.ganztaegig,
    von,
    endTag: ende.tag,
    bis: ende.zeit,
    art,
    frequenz: v.frequenz,
    option:
      art === WIEDERHOLUNG.monatlichWochentag && v.option >= 1 && v.option <= 6
        ? v.option
        : ordinalAusDatum(e.tag),
    wiederBis: automatisch
      ? v.wiederDauer > 0
        ? plusTage(e.tag, Math.floor(v.wiederDauer / TAGSEKUNDEN))
        : bisVorgabe(e.tag, art)
      : '',
    weitere: [],
    ausnahmen: [],
    ort: v.adresse?.name ?? '',
    ortStrasse: v.adresse?.street ?? '',
    ortPlz: v.adresse?.zip ?? '',
    ortStadt: v.adresse?.city ?? '',
    ortZusatz: v.adresse?.addition ?? '',
    tags: v.tags,
    imAuftrag: v.imAuftrag,
  };
}

/**
 * **Der Rumpf für „Als Vorlage speichern“** (`POST /calendars/appointments/templates`): dieselben Felder, die eine Vorlage
 * beim Anwenden füllt – Pflicht sind `title`, `calendarId`, `startTime`, `duration`. Die Dauer ist Ende − Beginn (ganztägig:
 * ganze Tage, ein Tag = 0), `repeatDuration` Beginn bis „Bis“ in ganzen Tagen. Nur Tags mit Nummer; neue (Texte) gibt es
 * erst, wenn der Termin angelegt wird. Legt **keinen** Termin an.
 */
export function vorlageRumpf(e: Eintrag & { kalender: number }): Record<string, unknown> {
  const endTag = e.endTag || e.tag;
  const dauer = e.ganztaegig
    ? tageZwischen(e.tag, endTag) * TAGSEKUNDEN
    : sekundenZwischen(e.tag, e.von, endTag, e.bis);
  const adresse = eintragAdresse(e);
  const nummern = e.tags.filter((t): t is number => typeof t === 'number');
  return {
    calendarId: e.kalender,
    title: e.titel.trim(),
    ...(e.untertitel.trim() ? { subtitle: e.untertitel.trim() } : {}),
    ...(e.beschreibung.trim() ? { description: e.beschreibung.trim() } : {}),
    ...(e.link.trim() ? { link: e.link.trim() } : {}),
    isInternal: e.intern,
    allDay: e.ganztaegig,
    startTime: e.ganztaegig ? '00:00' : e.von,
    duration: dauer,
    repeatId: e.art,
    ...(istAutomatisch(e.art)
      ? {
          repeatFrequency: e.frequenz,
          repeatDuration: tageZwischen(e.tag, e.wiederBis) * TAGSEKUNDEN,
          ...(e.art === WIEDERHOLUNG.monatlichWochentag ? { repeatOptionId: e.option } : {}),
        }
      : {}),
    ...(adresse ? { address: adresse } : {}),
    ...(nummern.length ? { tags: nummern } : {}),
    ...(e.imAuftrag !== null ? { onBehalfOfPid: e.imAuftrag } : {}),
  };
}
