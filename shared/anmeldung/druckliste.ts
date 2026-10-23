/**
 * **Drucklisten** (A8, Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026) – was auf dem Blatt steht, ohne Oberfläche
 * und ohne PDF. Die Erweiterung zeigt daraus die Vorschau, `ui/teilen/listenPdf.ts` druckt dieselbe Tabelle – beide aus
 * EINER Rechnung.
 *
 * Nur das Nötige auf dem Blatt (Bauplan A8): Name, dazu die gewählten Spalten. Die Antworten kommen über
 * `antwortText` – dieselbe Regel wie im Fenster einer Anmeldung.
 */
import { tagPunkt } from '../ct/datum';
import { ctAblage, nurText, type Feld, type OeffentlicheEinstellungen } from './formular';
import { antwortText, type ListenAnmeldung, type ListenPerson } from './liste';

/** Eine Zeile der Tabelle – oder eine Zwischenüberschrift (z. B. „Warteliste“). */
export type DruckZeile = { zellen: string[] } | { abschnitt: string };

export interface DruckTabelle {
  kopf: string[];
  zeilen: DruckZeile[];
  /** Unter der Tabelle, z. B. „8 mit Platz · 2 auf der Warteliste“. */
  summe: string;
}

export type DruckSortierung = 'nachname' | 'alter' | 'anmeldung';

/** Was die Veranstaltung sich für die Teilnehmerliste merkt (Alwin, 23.10.2026: „Wahl merken“). */
export interface DruckWahl {
  spalten: string[];
  sortierung: DruckSortierung;
}

export const DRUCK_STANDARD: DruckWahl = { spalten: ['alter', 'kontakt'], sortierung: 'nachname' };

export interface DruckSpalte {
  schluessel: string;
  titel: string;
}

/** Spalten aus der Person selbst bzw. aus den Systemfeldern – dahinter folgen die Fragen des Formulars. */
const FEST: DruckSpalte[] = [
  { schluessel: 'alter', titel: 'Alter' },
  { schluessel: 'geburtstag', titel: 'Geburtsdatum' },
  { schluessel: 'kontakt', titel: 'Angemeldet von' },
  { schluessel: 'nr', titel: 'Anmelde-Nr.' },
];

const frageSchluessel = (f: Feld) => `frage:${f.id}`;

/** Fragen mit eigener Spalte in ChurchTools, die das Formular auch stellt. */
function fragen(e: OeffentlicheEinstellungen): Feld[] {
  return [...e.formular.person, ...e.formular.anmeldung].filter(
    (f) => f.zustand !== 'aus' && !nurText(f.typ) && ctAblage(f).ort === 'gruppenfeld',
  );
}

const fragtGeburtstag = (e: OeffentlicheEinstellungen) =>
  e.formular.person.some((f) => f.id === 'birth' && f.zustand !== 'aus');

/**
 * **Welche Spalten es gibt** – Alter und Geburtsdatum nur, wenn das Formular nach dem Geburtsdatum fragt, dann
 * „Angemeldet von“, Anmelde-Nr. und jede Frage des Formulars (Telefon, Allergien, Fotos …).
 */
export function teilnehmerSpalten(e: OeffentlicheEinstellungen): DruckSpalte[] {
  const mitGeburt = fragtGeburtstag(e);
  return [
    ...FEST.filter((s) => mitGeburt || (s.schluessel !== 'alter' && s.schluessel !== 'geburtstag')),
    ...fragen(e).map((f) => ({ schluessel: frageSchluessel(f), titel: f.frage })),
  ];
}

/** Die gemerkte Wahl, bereinigt: Spalten, die es nicht mehr gibt (Frage gelöscht), fallen weg. */
export function druckWahlFuer(e: OeffentlicheEinstellungen): DruckWahl {
  const w = e.druck ?? DRUCK_STANDARD;
  const da = new Set(teilnehmerSpalten(e).map((s) => s.schluessel));
  return { spalten: w.spalten.filter((s) => da.has(s)), sortierung: w.sortierung };
}

const nameVon = (p: ListenPerson) => (p.nach ? `${p.nach}, ${p.vor}` : p.vor);

function zelle(
  e: OeffentlicheEinstellungen,
  s: string,
  x: ListenAnmeldung,
  p: ListenPerson,
): string {
  if (s === 'alter') return p.alter === null ? '' : String(p.alter);
  if (s === 'geburtstag') return p.geburtstag ? tagPunkt(p.geburtstag) : '';
  if (s === 'kontakt') return x.wer;
  if (s === 'nr') return x.nr ?? '';
  const f = fragen(e).find((y) => frageSchluessel(y) === s);
  if (!f) return '';
  // Was es einmal je Anmeldung gibt (Telefon, Erziehungsberechtigte …), steht bei jeder Person der Anmeldung.
  const werte = e.formular.person.includes(f) ? p.werte : x.einmal;
  return antwortText(f, werte, e.ctFelder) ?? '';
}

const deutsch = new Intl.Collator('de', { sensitivity: 'base' });
const vergleich = (x: string, y: string) => deutsch.compare(x, y);

/**
 * **Die Teilnehmerliste** – eine Zeile je Person. Ohne `mitWarteliste` nur, wer einen Platz hat; mit stehen die
 * Wartenden in einem eigenen Abschnitt darunter, nach ihrem Platz auf der Warteliste.
 */
export function teilnehmerTabelle(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  wahl: DruckWahl,
  mitWarteliste: boolean,
): DruckTabelle {
  const spalten = teilnehmerSpalten(e).filter((s) => wahl.spalten.includes(s.schluessel));
  // Reihenfolge der Liste = Reihenfolge der Anmeldungen.
  const alle = liste.flatMap((x, i) => x.personen.map((p) => ({ x, p, i })));
  type Eintrag = (typeof alle)[number];
  const sortiert = (xs: Eintrag[]) =>
    [...xs].sort((u, w) => {
      if (wahl.sortierung === 'alter') {
        const d = (u.p.alter ?? 999) - (w.p.alter ?? 999);
        if (d) return d;
      } else if (wahl.sortierung === 'anmeldung') return u.i - w.i;
      return vergleich(u.p.nach, w.p.nach) || vergleich(u.p.vor, w.p.vor);
    });
  const zeile = ({ x, p }: Eintrag): DruckZeile => ({
    zellen: [nameVon(p), ...spalten.map((s) => zelle(e, s.schluessel, x, p))],
  });
  const mitPlatz = sortiert(alle.filter((y) => y.p.status === 'aktiv'));
  const wartend = alle
    .filter((y) => y.p.status === 'wartet')
    .sort((u, w) => (u.p.warteplatz ?? 999) - (w.p.warteplatz ?? 999));
  const zeilen = mitPlatz.map(zeile);
  if (mitWarteliste && wartend.length > 0) {
    zeilen.push({ abschnitt: 'Warteliste' });
    for (const y of wartend) {
      const z = zeile(y) as { zellen: string[] };
      if (y.p.warteplatz) z.zellen[0] = `${y.p.warteplatz}. ${z.zellen[0]}`;
      zeilen.push(z);
    }
  }
  const teile = [`${mitPlatz.length} mit Platz`];
  if (wartend.length > 0)
    teile.push(
      mitWarteliste
        ? `${wartend.length} auf der Warteliste`
        : `${wartend.length} auf der Warteliste (nicht gedruckt)`,
    );
  return { kopf: ['Name', ...spalten.map((s) => s.titel)], zeilen, summe: teile.join(' · ') };
}

/** Dateiname des PDF: „Kinderfreizeit – Teilnehmer“ ohne Zeichen, die Dateisysteme nicht mögen. */
export function druckDateiname(veranstaltung: string, liste: string): string {
  return `${veranstaltung} – ${liste}`
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
