/**
 * Reine GERÄTE-Vorlieben: Wie ist die Oberfläche auf DIESEM Gerät eingerichtet (#198).
 *
 * Abgegrenzt gegen die Lied-Einstellungen aus `chartSettings`/`songVersions`: Die gehören zum
 * Konto und werden synchronisiert – ein Kapo gilt auf jedem Gerät. Wo die Werkzeugleiste sitzt und
 * ob sie eingeklappt ist, hängt dagegen am Bildschirm und an der Hand, die ihn hält; das gehört
 * ausdrücklich **nicht** aufs Konto. Deshalb ein eigener Namensraum (`worship:…` statt
 * `worship_…`) – der Konto-Sync greift ihn dadurch gar nicht erst auf.
 *
 * Alle Zugriffe fangen Fehler ab: Ist der Speicher voll oder gesperrt (privater Modus), gilt die
 * Einstellung eben nur für diese Sitzung. Eine Vorliebe darf nie die Bedienung blockieren.
 */

import type { StandardAnsicht } from '@shared/types/index';
import { lokalSchreiben } from './lokalSpeicher';

const KEYS = {
  /** Ist die Anmerkungs-Werkzeugleiste zum Rand-Knopf eingeklappt? */
  drawbarCollapsed: 'worship:drawbar-collapsed',
  /** Senkrechte Verschiebung der Werkzeugleiste in Pixeln. */
  drawbarOffsetY: 'worship:drawbar-y',
  /** Gewählte Termin-Art im Tab „Abwesenheiten" (#400) – JSON-Liste mit höchstens einer ID, leer = alle. */
  abwesenheitenFilter: 'worship:abwesenheiten-filter',
  /** Ausgeblendete Termin-Arten im Tab „Abwesenheiten" (seit 28.10.2026) – JSON-Liste, leer = alle zu sehen. */
  abwesenheitenAusgeblendet: 'worship:abwesenheiten-ausgeblendet',
  /** Ein Abmelden konnte den Server nicht erreichen und muss beim nächsten Start nachgeholt werden (#403). */
  abmeldenAusstehend: 'worship:abmelden-ausstehend',
  /**
   * Die Standard-Ansicht der Lieder, wie das Gerät sie zuletzt aus der Gemeinde-Einstellung geladen
   * hat (07.10.2026, `standardAnsicht.ts`). Keine Konto-Angabe – deshalb hier, und sie übersteht das
   * Abmelden.
   */
  gemeindeAnsicht: 'worship:gemeinde-ansicht',
  /** Beim Teilen als PDF die eigenen Anmerkungen mitnehmen? (07.10.2026, Vorgabe: nein) */
  teilenMitAnmerkungen: 'worship:teilen-anmerkungen',
  /** Liedansicht: blättern oder scrollen (#551) – je Gerät, am Handy will man es vielleicht anders als am iPad. */
  liedansicht: 'worship:liedansicht',
  /** Für wen dieses Gerät zuletzt lief – erkennt den Personenwechsel ohne Abmelden (30.10.2026, `personenWechsel.ts`). */
  letztePerson: 'worship:letzte-person',
} as const;

type PrefKey = keyof typeof KEYS;

function read(key: PrefKey): string | null {
  try {
    return localStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

function write(key: PrefKey, value: string): void {
  lokalSchreiben(KEYS[key], value); // voll → Vorliebe gilt nur für diese Sitzung
}

export function getDrawbarCollapsed(): boolean {
  return read('drawbarCollapsed') === '1';
}

export function setDrawbarCollapsed(collapsed: boolean): void {
  write('drawbarCollapsed', collapsed ? '1' : '0');
}

/** Verschiebung der Werkzeugleiste; 0, wenn nichts oder Unsinn gespeichert ist. */
export function getDrawbarOffsetY(): number {
  const v = Number(read('drawbarOffsetY'));
  return Number.isFinite(v) ? v : 0;
}

export function setDrawbarOffsetY(y: number): void {
  write('drawbarOffsetY', String(y));
}

/**
 * Die im Tab „Abwesenheiten" gewählte Termin-Art (#400) – als Liste, weil eine Zwischenfassung
 * mehrere zuließ; gelesen wird höchstens die erste. Leer heißt „alle". **Seit 28.10.2026 nur noch gelesen**, um sie
 * einmal in ausgeblendete Arten umzurechnen (`getAbwesenheitenAusgeblendet`).
 *
 * Auf dem Gerät gemerkt, nicht im Konto (Entscheidung Alwin, 20.09.2026): Wer nur Gottesdienste
 * einträgt, stellt es einmal ein. Ein kaputter Wert ergibt „alle" – lieber zu viel zeigen als still
 * zu wenig.
 */
export function getAbwesenheitenFilter(): string[] {
  try {
    const roh: unknown = JSON.parse(read('abwesenheitenFilter') ?? '[]');
    return Array.isArray(roh) ? roh.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * **Ausgeblendete Termin-Arten** im Tab „Abwesenheiten" (seit 28.10.2026, Häkchen wie im Dienstplaner). `null`, solange
 * nichts gemerkt ist – dann rechnet die Seite einmal die alte Wahl um (`getAbwesenheitenFilter`,
 * `ausgeblendetAusAlterWahl`). Ein kaputter Wert ergibt „nichts ausgeblendet" – lieber zu viel zeigen.
 */
export function getAbwesenheitenAusgeblendet(): string[] | null {
  const roh = read('abwesenheitenAusgeblendet');
  if (roh === null) return null;
  try {
    const liste: unknown = JSON.parse(roh);
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setAbwesenheitenAusgeblendet(ids: string[]): void {
  write('abwesenheitenAusgeblendet', JSON.stringify(ids));
}

/**
 * **Abmelden steht noch aus** (#403). Kein Oberflächen-Wunsch, sondern Gerätezustand – deshalb aber
 * genau hier richtig: Der Doppelpunkt-Namensraum `worship:…` überlebt das Aufräumen beim Abmelden
 * (`clearDeviceData` löscht nur `worship_…`), und genau das muss dieser Merker.
 *
 * Warum es ihn gibt: Das Anmelde-Cookie ist `httpOnly`, nur der Server kann es löschen. Ist er beim
 * Abmelden nicht erreichbar (Flugmodus, WLAN weg), bliebe das Cookie liegen – und die nächste Person,
 * die das geteilte Gemeindegerät öffnet, wäre als die vorige angemeldet. Mit dem Merker holt die App
 * das Abmelden beim nächsten Start nach, bevor sie irgendwem ein Konto zeigt.
 */
export function getAbmeldenAusstehend(): boolean {
  return read('abmeldenAusstehend') === '1';
}

/**
 * **Für wen lief dieses Gerät zuletzt?** Wie `abmeldenAusstehend` ein Gerätezustand im `worship:`-Bereich, damit er
 * das Aufräumen übersteht – er muss ja gerade dann noch wissen, wer vorher dran war. Kein Personenbezug außer der
 * Nummer.
 */
export function getLetztePerson(): number | null {
  const n = Number(read('letztePerson'));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function setLetztePerson(id: number): void {
  write('letztePerson', String(id));
}

export function setAbmeldenAusstehend(ausstehend: boolean): void {
  if (ausstehend) {
    write('abmeldenAusstehend', '1');
    return;
  }
  try {
    localStorage.removeItem(KEYS.abmeldenAusstehend);
  } catch {
    /* Speicher gesperrt – dann war auch nichts gemerkt */
  }
}

/** Die zuletzt geladene Standard-Ansicht der Gemeinde; ohne Angabe „Akkorde". */
export function getGemeindeAnsicht(): StandardAnsicht {
  return read('gemeindeAnsicht') === 'dokument' ? 'dokument' : 'akkorde';
}

export function setGemeindeAnsicht(ansicht: StandardAnsicht): void {
  write('gemeindeAnsicht', ansicht);
}

/** Beim Teilen als PDF die eigenen Anmerkungen mitnehmen? Ohne Angabe: nein (Alwin, 07.10.2026). */
export function getTeilenMitAnmerkungen(): boolean {
  return read('teilenMitAnmerkungen') === '1';
}

export function setTeilenMitAnmerkungen(an: boolean): void {
  write('teilenMitAnmerkungen', an ? '1' : '0');
}

/** Wie die Lieder eines Ablaufs angezeigt werden (#551): Seite für Seite oder untereinander. */
export type Liedansicht = 'blaettern' | 'scrollen';

/** Ohne Angabe (oder mit Unsinn): blättern – wie bisher. */
export function getLiedansicht(): Liedansicht {
  return read('liedansicht') === 'scrollen' ? 'scrollen' : 'blaettern';
}

export function setLiedansicht(ansicht: Liedansicht): void {
  write('liedansicht', ansicht);
}
