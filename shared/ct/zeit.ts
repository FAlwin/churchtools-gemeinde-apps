/**
 * Der Tag eines ChurchTools-Zeitpunkts in der Zeitzone der Gemeinde – geteilt von Server und
 * ChurchTools-Extension (#335). Lag bis dahin in `server/src/utils/isoTag.ts`.
 */

/**
 * **Ein Zeitpunkt als `YYYY-MM-DD` (UTC)** – für Zeitfenster an ChurchTools (`from`/`to`), die eine
 * Stunde Verschiebung vertragen. Begründung in `server/src/utils/isoTag.ts`.
 */
export function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Hat der Zeitpunkt eine Zeitzonen-Angabe (`Z` oder `+02:00`)? Nur dann lässt er sich umrechnen. */
const MIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Ein Formatierer je Zeitzone – `Intl.DateTimeFormat` anzulegen ist teuer, Termine gibt es viele. */
const formatierer = new Map<string, Intl.DateTimeFormat>();

function wanduhrFormat(zeitzone: string): Intl.DateTimeFormat {
  let f = formatierer.get(zeitzone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zeitzone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatierer.set(zeitzone, f);
  }
  return f;
}

/** Die Wanduhr in `zeitzone` zu einem Zeitpunkt: [Jahr, Monat, Tag, Stunde, Minute]. */
function wanduhr(ms: number, zeitzone: string): number[] {
  const teile = wanduhrFormat(zeitzone).formatToParts(new Date(ms));
  const wert = (t: Intl.DateTimeFormatPartTypes) => Number(teile.find((p) => p.type === t)?.value);
  return [wert('year'), wert('month'), wert('day'), wert('hour'), wert('minute')];
}

const zwei = (n: number) => String(n).padStart(2, '0');

/**
 * **Ein ChurchTools-Zeitpunkt als Ortszeit der Gemeinde** `YYYY-MM-DDTHH:mm` – die eine Umrechnung
 * UTC → Wanduhr für alle Apps (Dienstplaner E3-2; vorher getrennt in `tagAusIso` und, für die
 * Anmeldungen, in `shared/anmeldung/termin.ts`, dort ohne die Regel unten).
 *
 * Ohne Zeitzonen-Angabe (`2026-10-04` oder `2026-10-04T08:00:00`) steht die gemeinte Zeit schon im
 * Text – umgerechnet würde sie nach der Zeitzone des Geräts bzw. Servers (im Container UTC).
 */
export function ortszeitAus(zeitpunkt: string, zeitzone: string): string {
  const ms = MIT_ZONE.test(zeitpunkt) ? Date.parse(zeitpunkt) : Number.NaN;
  if (Number.isNaN(ms)) {
    const text = zeitpunkt.slice(0, 16);
    return text.length === 10 ? `${text}T00:00` : text;
  }
  const [j, m, t, h, mi] = wanduhr(ms, zeitzone);
  return `${j}-${zwei(m)}-${zwei(t)}T${zwei(h)}:${zwei(mi)}`;
}

/**
 * Ortszeit `YYYY-MM-DDTHH:mm` → UTC für ChurchTools (`…Z`). Der Abstand zur UTC wird am Zeitpunkt selbst
 * bestimmt (zweimal, damit ein Tag mit Zeitumstellung stimmt). Aus `shared/anmeldung/termin.ts` (A3).
 */
export function utcAus(lokal: string, zeitzone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(lokal);
  if (!m) throw new Error(`Zeit „${lokal}“ hat nicht die Form JJJJ-MM-TTTHH:MM.`);
  const soll = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const abstand = (ms: number) => {
    const [j, mo, t, h, mi] = wanduhr(ms, zeitzone);
    return Date.UTC(j, mo - 1, t, h, mi) - ms;
  };
  let utc = soll - abstand(soll);
  utc = soll - abstand(utc);
  return new Date(utc).toISOString().replace('.000Z', 'Z');
}

/**
 * **Der Tag eines ChurchTools-Zeitpunkts – in der Zeitzone der Gemeinde** (#414). Die eine Stelle
 * (#410); bis zum 23.09.2026 stand sie als `startDate.slice(0, 10)` dreimal im Server (Termine,
 * Ablauf-Aufbau, Abwesenheiten).
 *
 * Bis zum 24.09.2026 war das der Tag, **wie er im Text steht** – bei ChurchTools also der
 * **UTC-Tag** (die Termine kommen als `…Z`). Ein Termin um 0:30 Uhr deutscher Zeit (`22:30Z` des
 * Vortags) landete damit auf dem Vortag: in der Terminliste, im Ablauf und bei den Abwesenheiten.
 * Jetzt zählt der Tag, an dem er **in der Gemeinde** stattfindet (`zeitzone`; der Server gibt
 * `config.zeitzone`, die Extension die Zeitzone der Gemeinde, #335).
 *
 * Ohne Zeitzonen-Angabe (`2026-10-04` oder `2026-10-04T08:00:00`) steht der gemeinte Tag schon im
 * Text – umgerechnet würde er nach der Zeitzone des Servers, und die ist im Container UTC.
 *
 * ⚠️ Die Abwesenheiten schreiben diesen Tag als `startDate` nach ChurchTools, und `absenceBody`
 * prüft, dass die Uhrzeit dazu passt. Beide hängen an DIESER Funktion – deshalb stimmen Haken und
 * Eintrag auch nach der Umstellung überein.
 */
export function tagAusIso(zeitpunkt: string, zeitzone: string): string {
  return ortszeitAus(zeitpunkt, zeitzone).slice(0, 10);
}

/** **Heute im Kalender dieses Geräts** (`YYYY-MM-DD`) – die eine Stelle dafür (Formular und Erweiterung). */
export function heuteImKalender(jetzt = new Date()): string {
  return tagAusIso(jetzt.toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * **Wann etwas zuletzt gespeichert wurde** – „heute 18:42“ bzw. „12.10. 18:42“, in Ortszeit der Gemeinde
 * (Dienstplaner E4-3-3: „Eingetragen von Spike, heute 18:42“). Auf `ortszeitAus` gebaut, nicht nachgerechnet.
 */
export function wannText(zeitpunkt: string, zeitzone: string, jetzt = new Date()): string {
  const lokal = ortszeitAus(zeitpunkt, zeitzone);
  const uhr = lokal.slice(11, 16);
  if (lokal.slice(0, 10) === tagAusIso(jetzt.toISOString(), zeitzone)) return `heute ${uhr}`;
  return `${lokal.slice(8, 10)}.${lokal.slice(5, 7)}. ${uhr}`;
}
