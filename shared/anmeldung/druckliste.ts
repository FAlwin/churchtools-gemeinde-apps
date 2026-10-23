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
import { EINVERSTANDEN_ZEILE } from './senden';

/** Eine Zeile der Tabelle – oder eine Zwischenüberschrift (z. B. „Warteliste“). */
export type DruckZeile = { zellen: string[] } | { abschnitt: string };

export interface DruckTabelle {
  /** Über der Tabelle, fett – z. B. die Zahlen für die Küche. */
  oben?: string;
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

type Eintrag = { x: ListenAnmeldung; p: ListenPerson; i: number };

/** Nach Nachname, dann Vorname – mit deutschen Umlauten. */
const nachName = (u: Eintrag, w: Eintrag) =>
  vergleich(u.p.nach, w.p.nach) || vergleich(u.p.vor, w.p.vor);

/**
 * **Eine Zeile je Person** – gemeinsam für Teilnehmer, Küche und Abholliste. Ohne `mitWarteliste` nur, wer einen Platz
 * hat; mit stehen die Wartenden in einem eigenen Abschnitt darunter, nach ihrem Platz auf der Warteliste. `nur` lässt
 * Personen weg (Küche: nur wer einen Hinweis hat); die Zahlen der Summe zählen trotzdem alle.
 */
function personenZeilen(
  liste: ListenAnmeldung[],
  mitWarteliste: boolean,
  reihe: (u: Eintrag, w: Eintrag) => number,
  zellen: (x: ListenAnmeldung, p: ListenPerson) => string[],
  nur: (x: ListenAnmeldung, p: ListenPerson) => boolean = () => true,
): { zeilen: DruckZeile[]; mitPlatz: number; wartend: number; summe: string } {
  // Reihenfolge der Liste = Reihenfolge der Anmeldungen.
  const alle = liste.flatMap((x, i) => x.personen.map((p) => ({ x, p, i })));
  const mitPlatz = alle.filter((y) => y.p.status === 'aktiv');
  const wartend = alle
    .filter((y) => y.p.status === 'wartet')
    .sort((u, w) => (u.p.warteplatz ?? 999) - (w.p.warteplatz ?? 999));
  const zeilen: DruckZeile[] = [...mitPlatz]
    .sort(reihe)
    .filter((y) => nur(y.x, y.p))
    .map((y) => ({ zellen: zellen(y.x, y.p) }));
  const gedruckteWartende = wartend.filter((y) => nur(y.x, y.p));
  if (mitWarteliste && gedruckteWartende.length > 0) {
    zeilen.push({ abschnitt: 'Warteliste' });
    for (const y of gedruckteWartende) {
      const z = zellen(y.x, y.p);
      if (y.p.warteplatz) z[0] = `${y.p.warteplatz}. ${z[0]}`;
      zeilen.push({ zellen: z });
    }
  }
  const teile = [`${mitPlatz.length} mit Platz`];
  if (wartend.length > 0)
    teile.push(
      mitWarteliste
        ? `${wartend.length} auf der Warteliste`
        : `${wartend.length} auf der Warteliste (nicht gedruckt)`,
    );
  return {
    zeilen,
    mitPlatz: mitPlatz.length,
    wartend: wartend.length,
    summe: teile.join(' · '),
  };
}

/** **Die Teilnehmerliste** – eine Zeile je Person, Spalten und Sortierung nach Wahl. */
export function teilnehmerTabelle(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  wahl: DruckWahl,
  mitWarteliste: boolean,
): DruckTabelle {
  const spalten = teilnehmerSpalten(e).filter((s) => wahl.spalten.includes(s.schluessel));
  const reihe = (u: Eintrag, w: Eintrag) => {
    if (wahl.sortierung === 'alter') {
      const d = (u.p.alter ?? 999) - (w.p.alter ?? 999);
      if (d) return d;
    } else if (wahl.sortierung === 'anmeldung') return u.i - w.i;
    return nachName(u, w);
  };
  const { zeilen, summe } = personenZeilen(liste, mitWarteliste, reihe, (x, p) => [
    nameVon(p),
    ...spalten.map((s) => zelle(e, s.schluessel, x, p)),
  ]);
  return { kopf: ['Name', ...spalten.map((s) => s.titel)], zeilen, summe };
}

// ── Weitere Listen (A8-2) ─────────────────────────────────────────────────────────────────────

export type ListenArt = 'teilnehmer' | 'kueche' | 'zimmer' | 'abhol';

/** Ein eingeschaltetes Feld des Formulars mit fester Bedeutung (Baustein). */
const baustein = (e: OeffentlicheEinstellungen, id: string): Feld | undefined =>
  [...e.formular.person, ...e.formular.anmeldung].find((f) => f.id === id && f.zustand !== 'aus');

export interface ListenAngebot {
  art: ListenArt;
  titel: string;
  /** Passt zum Formular – steht vorn; sonst hinter „＋ weitere“. */
  passt: boolean;
  /** Was fehlt, wenn sie nicht passt – steht im Fenster. */
  hinweis: string | null;
}

/**
 * **Welche Listen es gibt** (Alwin, 23.10.2026): Teilnehmer immer; Küche bei „Allergien & Essen“; Zimmer bei Auswahl im
 * Preis (Titel = Name der Auswahl); Abholliste bei „Erziehungsberechtigte“. Jede Liste geht immer – ohne passende Frage
 * bleibt die Spalte leer zum Ausfüllen von Hand.
 */
export function listenAngebot(e: OeffentlicheEinstellungen): ListenAngebot[] {
  const g = e.preis.grundpreis;
  const zimmer = g.art === 'auswahl';
  return [
    { art: 'teilnehmer', titel: 'Teilnehmer', passt: true, hinweis: null },
    {
      art: 'kueche',
      titel: 'Küche & Allergien',
      passt: !!baustein(e, 'allergy'),
      hinweis:
        'Im Formular gibt es keine Frage zu Allergien – die Spalte „Hinweis“ bleibt leer zum Eintragen von Hand.',
    },
    {
      art: 'zimmer',
      titel: (zimmer && g.auswahlName.trim()) || 'Zimmer',
      passt: zimmer,
      hinweis:
        'Im Preis gibt es keine Auswahl – die Spalte „Zimmer“ bleibt leer zum Eintragen von Hand.',
    },
    {
      art: 'abhol',
      titel: 'Abholliste',
      passt: !!baustein(e, 'eltern'),
      hinweis:
        'Im Formular gibt es keine Erziehungsberechtigten – statt ihrer steht da, wer angemeldet hat.',
    },
  ].map((l) => ({ ...l, art: l.art as ListenArt, hinweis: l.passt ? null : l.hinweis }));
}

/** Ab diesem Alter zählt die Küche jemanden nicht mehr als Kind (Entwurf: „Kinder unter 12 · unter 3“). */
const KIND_UNTER = 12;
const KLEIN_UNTER = 3;

/**
 * **Küche & Allergien** – oben die Zahlen (Personen, mit Geburtsdatum auch Kinder unter 12 und unter 3), darunter nur,
 * wer einen Hinweis hat. Ohne Frage nach Allergien: alle, mit leerer Spalte zum Eintragen.
 */
export function kuecheTabelle(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  mitWarteliste: boolean,
): DruckTabelle {
  const f = baustein(e, 'allergy');
  const mitAlter = fragtGeburtstag(e);
  const hinweis = (p: ListenPerson) => (f ? (antwortText(f, p.werte, e.ctFelder) ?? '') : '');
  const r = personenZeilen(
    liste,
    mitWarteliste,
    nachName,
    (_, p) => [
      nameVon(p),
      ...(mitAlter ? [p.alter === null ? '' : String(p.alter)] : []),
      hinweis(p),
    ],
    (_, p) => !f || hinweis(p) !== '',
  );
  const gezaehlt = liste.flatMap((x) =>
    x.personen.filter((p) => p.status === 'aktiv' || mitWarteliste),
  );
  const zahlen = [`${gezaehlt.length} Personen`];
  if (mitAlter) {
    const unter = (n: number) => gezaehlt.filter((p) => p.alter !== null && p.alter < n).length;
    zahlen.push(
      `${unter(KIND_UNTER)} Kinder unter ${KIND_UNTER}`,
      `${unter(KLEIN_UNTER)} unter ${KLEIN_UNTER}`,
    );
  }
  if (f) zahlen.push(`${r.zeilen.filter((z) => 'zellen' in z).length} mit Hinweis`);
  return {
    oben: zahlen.join(' · '),
    kopf: ['Name', ...(mitAlter ? ['Alter'] : []), 'Hinweis'],
    zeilen: r.zeilen,
    summe: r.summe,
  };
}

/**
 * **Zimmer** – mit Auswahl im Preis je Option die Anmeldungen mit ihren Personen; ohne Auswahl alle Anmeldungen. Die
 * Spalte „Zimmer“ bleibt leer: Dort trägt das Team ein, wer wo schläft.
 */
export function zimmerTabelle(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  mitWarteliste: boolean,
): DruckTabelle {
  const g = e.preis.grundpreis;
  const feld = e.ctFelder.auswahl;
  const dabei = (p: ListenPerson) => p.status === 'aktiv' || mitWarteliste;
  const anmeldungen = liste
    .map((x) => ({ x, personen: x.personen.filter(dabei) }))
    .filter((y) => y.personen.length > 0)
    .sort((u, w) => vergleich(u.x.wer, w.x.wer));
  const zeile = (y: (typeof anmeldungen)[number]): DruckZeile => ({
    zellen: [
      y.x.wer,
      y.personen.map((p) => (p.status === 'wartet' ? `${p.vor} (Warteliste)` : p.vor)).join(', '),
      '',
    ],
  });
  const zeilen: DruckZeile[] = [];
  if (g.art === 'auswahl') {
    const option = (y: (typeof anmeldungen)[number]) =>
      (feld === undefined ? undefined : y.x.einmal[feld]) ?? '';
    const namen = g.optionen.map((o) => o.name);
    for (const name of [...namen, '']) {
      const hier = anmeldungen.filter((y) =>
        name ? option(y) === name : !namen.includes(option(y)),
      );
      if (hier.length === 0) continue;
      zeilen.push({ abschnitt: name || 'Ohne Auswahl' }, ...hier.map(zeile));
    }
  } else zeilen.push(...anmeldungen.map(zeile));
  const personen = anmeldungen.reduce((n, y) => n + y.personen.length, 0);
  return {
    kopf: ['Anmeldung', 'Personen', 'Zimmer'],
    zeilen,
    summe: `${anmeldungen.length} Anmeldungen · ${personen} Personen`,
  };
}

/**
 * **Abholliste** – je Kind, wer es abholen darf (Erziehungsberechtigte mit Telefon), dazu eine leere Spalte „Abgeholt
 * von / Uhrzeit“. Ohne Baustein „Erziehungsberechtigte“ steht da, wer angemeldet hat, mit Telefon, wenn gefragt.
 */
export function abholTabelle(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  mitWarteliste: boolean,
): DruckTabelle {
  const eltern = baustein(e, 'eltern');
  const tel = baustein(e, 'tel');
  const wer = (x: ListenAnmeldung) => {
    if (eltern) {
      const t = antwortText(eltern, x.einmal, e.ctFelder);
      if (t)
        return t
          .split('\n')
          .filter((z) => z !== EINVERSTANDEN_ZEILE)
          .join('\n');
    }
    const telefon = tel ? antwortText(tel, x.einmal, e.ctFelder) : null;
    return [x.wer, telefon].filter(Boolean).join(', ');
  };
  const r = personenZeilen(liste, mitWarteliste, nachName, (x, p) => [nameVon(p), wer(x), '']);
  return {
    kopf: ['Kind', 'Abholen dürfen', 'Abgeholt von / Uhrzeit'],
    zeilen: r.zeilen,
    summe: r.summe,
  };
}

/** Die Tabelle zur gewählten Liste. */
export function druckTabelle(
  art: ListenArt,
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  wahl: DruckWahl,
  mitWarteliste: boolean,
): DruckTabelle {
  if (art === 'kueche') return kuecheTabelle(e, liste, mitWarteliste);
  if (art === 'zimmer') return zimmerTabelle(e, liste, mitWarteliste);
  if (art === 'abhol') return abholTabelle(e, liste, mitWarteliste);
  return teilnehmerTabelle(e, liste, wahl, mitWarteliste);
}

/** Dateiname des PDF: „Kinderfreizeit – Teilnehmer“ ohne Zeichen, die Dateisysteme nicht mögen. */
export function druckDateiname(veranstaltung: string, liste: string): string {
  return `${veranstaltung} – ${liste}`
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
