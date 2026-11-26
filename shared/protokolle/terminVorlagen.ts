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
 * **Buchungen** (W15-2) stehen im Altformat `bookings: [{resource_id: "3", minpre: "150", minpost: "60", status_id: 1}]`
 * (Zahlen als Text, gemessen 23.11.2026): Beim Anwenden kommen sie in die Tabelle des Reiters „Ressourcen“ – nur Ressourcen,
 * die die Person buchen darf, der Status ohne Verwalten-Recht als „Wartet auf Bestätigung“ –, beim Speichern gehen sie im
 * selben Format wieder hinaus. **Events** (W15-3): Die Vorlage trägt `events: [{eventTemplate: "0"}]` – die Nummer der
 * Eventvorlage **als Text** (gemessen 26.11.2026 an einer im ChurchTools-Dialog gespeicherten Vorlage); beim Anwenden kommt
 * sie in alle Zeilen des Reiters „Events“, beim Speichern geht sie im selben Format hinaus. **Anmeldung** (W15-5): Die
 * Vorlage trägt `grouptypeId`, `daysForwardNo`, `daysArchiveGroupNo` und `templateGroupId` (Zahlen oder `null`, laut
 * Schnittstelle) – beim Anwenden kommen sie in den Reiter „Anmeldung“ und schalten ihn an, **wenn** der Gruppentyp gesetzt und
 * erlaubt ist; „Als Vorlage speichern“ schreibt dieselben Felder, wenn der Schalter an ist.
 */
import { plusTage } from '../ct/datum';
import type { Eintrag } from './termine';
import { eintragAdresse, type TerminAdresse } from './terminFelder';
import { buchungenAufRechte, type Buchung } from './terminRessourcen';
import { vorlageFuerAlle } from './terminEvents';
import { ANMELDUNG_VORGABE_TAGE } from './terminAnmeldung';
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
  /** Gebuchte Ressourcen (aus dem Altformat `bookings`). */
  buchungen: Buchung[];
  /** Die Eventvorlage, die `events` erkennbar nennt (W15-3) – `null`, wenn keine. **0 ist gültig.** */
  eventVorlage: number | null;
  /** Die Anmeldung der Vorlage (W15-5): Gruppentyp `grouptypeId` – `null`, wenn keine. */
  anmeldungTyp: number | null;
  /** `daysForwardNo` – Tage im Voraus; `null`, wenn die Vorlage keine nennt. */
  anmeldungTage: number | null;
  /** `daysArchiveGroupNo` – Tage nach dem Termin bis zum Beenden. */
  anmeldungBeenden: number | null;
  /** `templateGroupId` – die Kopiervorlage. */
  anmeldungVorlage: number | null;
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

/**
 * Die Buchungen einer Vorlage aus dem Altformat `{resource_id, minpre, minpost, status_id}` (Zahlen als Text) – die neuen
 * Namen der Schnittstelle (`resourceId`, `leadTimeMinutes`, `afterwardMinutes`, `statusId`) lesen wir ebenfalls. Ohne
 * Ressource keine Buchung; fehlende Zeiten 0, ein unbekannter Status „Wartet“.
 */
function buchungenAus(roh: unknown): Buchung[] {
  return (Array.isArray(roh) ? roh : []).flatMap((b): Buchung[] => {
    const o = objekt(b);
    const ressource = zahl(o?.resource_id ?? o?.resourceId);
    if (!o || ressource === null || ressource <= 0) return [];
    const status = zahl(o.status_id ?? o.statusId);
    return [
      {
        ressource,
        vorlauf: Math.max(0, zahl(o.minpre ?? o.leadTimeMinutes) ?? 0),
        nachlauf: Math.max(0, zahl(o.minpost ?? o.afterwardMinutes) ?? 0),
        status: status === 2 || status === 3 ? status : 1,
        menge: 1,
      },
    ];
  });
}

/**
 * Die Eventvorlage einer Termin-Vorlage: ChurchTools schreibt `events: [{eventTemplate: "0"}]` (Nummer als Text, gemessen
 * 26.11.2026). Gelesen wird der erste Eintrag mit einer ganzzahligen Nummer – auch als Zahl und unter dem Namen
 * `eventTemplateId`, den wir vor der Messung vermutet hatten. Sonst `null` (ignoriert). Die Nummer 0 ist gültig und bleibt 0.
 */
function eventVorlageAus(roh: unknown): number | null {
  for (const x of Array.isArray(roh) ? roh : []) {
    const o = objekt(x);
    const n = zahl(o?.eventTemplate ?? o?.eventTemplateId);
    if (n !== null && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

/** Die Eventvorlage der frühesten Zeile, die eine hat – `null`, wenn keine Zeile eine Vorlage trägt. */
function ersteEventVorlage(events: Readonly<Record<string, number>>): number | null {
  const tage = Object.keys(events).sort();
  return tage.length ? events[tage[0]] : null;
}

/** Eine Nummer der Anmeldung: ganzzahlig und größer als 0 – sonst `null` (auch eine 0 heißt hier „keine“). */
function nummerAus(x: unknown): number | null {
  const n = zahl(x);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
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
    buchungen: buchungenAus(o.bookings),
    eventVorlage: eventVorlageAus(o.events),
    anmeldungTyp: nummerAus(o.grouptypeId),
    anmeldungTage: nummerAus(o.daysForwardNo),
    anmeldungBeenden: nummerAus(o.daysArchiveGroupNo),
    anmeldungVorlage: nummerAus(o.templateGroupId),
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
export function vorlageAnwenden(
  e: Eintrag,
  v: TerminVorlage,
  /** Was die Person buchen und verwalten darf – ohne Angabe übernimmt die Vorlage keine Buchungen. */
  rechte: {
    buchbar: ReadonlySet<number>;
    verwaltbar: ReadonlySet<number>;
    /** Gruppentypen, in denen man Gruppen anlegen darf (W15-5) – ohne Angabe übernimmt die Vorlage keine Anmeldung. */
    gruppentypen?: ReadonlySet<number>;
  } = {
    buchbar: new Set(),
    verwaltbar: new Set(),
  },
): Eintrag {
  const von = v.ganztaegig ? e.von : v.startzeit || e.von;
  const ende = v.ganztaegig
    ? { tag: plusTage(e.tag, Math.floor(v.dauer / TAGSEKUNDEN)), zeit: e.bis }
    : plusSekunden(e.tag, von, v.dauer);
  const art = v.art;
  const automatisch = istAutomatisch(art);
  const neu: Eintrag = {
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
    buchungen: buchungenAufRechte(v.buchungen, rechte.buchbar, rechte.verwaltbar),
    events: {},
    // Anmeldung (W15-5): Mit gesetztem und erlaubtem Gruppentyp schaltet die Vorlage den Reiter an – sonst bleibt er aus.
    anmeldung:
      v.anmeldungTyp !== null && rechte.gruppentypen?.has(v.anmeldungTyp)
        ? {
            typ: v.anmeldungTyp,
            tage: v.anmeldungTage ?? ANMELDUNG_VORGABE_TAGE,
            vorlage: v.anmeldungVorlage,
            beenden: v.anmeldungBeenden,
          }
        : null,
  };
  // Events (W15-3): Nennt die Vorlage eine Eventvorlage, kommt sie in alle Zeilen der neuen Reihe (0 zählt!).
  return v.eventVorlage === null ? neu : { ...neu, events: vorlageFuerAlle(neu, v.eventVorlage) };
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
    // Anmeldung (W15-5): nur mit Schalter an und gewähltem Gruppentyp; leere Auswahlen fehlen.
    ...(e.anmeldung && e.anmeldung.typ !== null
      ? {
          grouptypeId: e.anmeldung.typ,
          daysForwardNo: e.anmeldung.tage,
          ...(e.anmeldung.beenden !== null ? { daysArchiveGroupNo: e.anmeldung.beenden } : {}),
          ...(e.anmeldung.vorlage !== null ? { templateGroupId: e.anmeldung.vorlage } : {}),
        }
      : {}),
    // Events (gemessen 26.11.2026): eine Eventvorlage, Nummer als Text – die der ersten Zeile, die eine hat. Eine Vorlage
    // kennt kein Datum, beim Anwenden gilt sie wieder für alle Zeilen (`vorlageAnwenden`).
    ...(ersteEventVorlage(e.events) !== null
      ? { events: [{ eventTemplate: String(ersteEventVorlage(e.events)) }] }
      : {}),
    // Buchungen im Altformat von ChurchTools (Zahlen als Text) – so liest `buchungenAus` sie wieder.
    ...(e.buchungen.length
      ? {
          bookings: e.buchungen.map((b) => ({
            resource_id: String(b.ressource),
            minpre: String(b.vorlauf),
            minpost: String(b.nachlauf),
            status_id: b.status,
          })),
        }
      : {}),
  };
}
