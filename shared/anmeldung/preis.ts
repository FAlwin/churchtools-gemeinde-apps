/**
 * **Preis-Baukasten der Anmeldungen** (#474, Bauplan Anmeldungen A1).
 *
 * Die EINE Rechnung für alle Stellen, die einen Betrag zeigen oder speichern: das öffentliche
 * Formular (Betrag bei der Anmeldung), die Erweiterung (Liste, Fenster, „Probe rechnen“, Druckliste,
 * Rundmail) und die Nachprüfung. Ohne eigenen Server rechnet das Formular im Browser; die
 * Erweiterung rechnet jeden gespeicherten Betrag mit genau dieser Funktion nach und meldet
 * Abweichungen. **Achtung für diese Nachprüfung (A7):** Preise dürfen sich nach den ersten Anmeldungen
 * ändern, wer angemeldet ist, behält seinen Betrag (Alwin, 13.10.2026, A4). Nachgerechnet werden darf
 * deshalb nur gegen die Regeln zur Zeit der Anmeldung – sonst meldet jede Preisänderung alle älteren
 * Anmeldungen als falsch. Eine zweite Rechnung daneben wäre die Fehlerklasse vom 31.07.2026
 * (PDF-Optionen an drei Stellen, einer fehlte der Kapo-Abzug).
 *
 * Reihenfolge, fest: **Grundpreis → Alter → Rabatte und Zuschläge → Extras.**
 *
 * Gerechnet wird in **Cent** (ganze Zahlen). Prozent-Werte werden je Person auf den Cent gerundet,
 * so wie sie auch einzeln in der Aufschlüsselung stehen – die Summe der Zeilen ist damit immer der
 * Gesamtbetrag.
 */
import { optionRest } from './kontingent';

/** Gilt ein Betrag je Person oder einmal für die ganze Anmeldung? */
export type Geltung = 'person' | 'anmeldung';

/** Eine Auswahl-Möglichkeit des Grundpreises, z. B. ein Zimmertyp. */
export interface PreisOption {
  name: string;
  /** Preis pro Person in Cent. */
  preisCent: number;
  /**
   * Wie oft die Option gebucht werden kann; 0 = unbegrenzt. **Je Anmeldung einmal** (A6-5b, Alwin 17.10.2026: z. B.
   * 6 Zweibettzimmer → 6), egal wie viele Personen.
   */
  kontingent: number;
  /**
   * Wie oft sie schon gebucht ist – zählt die Erweiterung aus den Anmeldungen (`optionenBelegt`) und schreibt es hierher,
   * weil Gäste die Anmeldungen nicht lesen können (gemessen 17.10.2026).
   */
  belegt: number;
  /** Für wie viele Personen eine Buchung gedacht ist (z. B. 2 beim Zweibettzimmer); 0 = keine Angabe. Nur Hinweis. */
  personenJe: number;
}

export interface Grundpreis {
  art: 'fest' | 'auswahl';
  /** Bei `fest`: Betrag in Cent (0 = kostenlos). */
  betragCent: number;
  /** Bei `fest`: je Person oder je Anmeldung. Eine Auswahl gilt immer je Person. */
  gilt: Geltung;
  /** Bei `auswahl`: was gewählt wird, z. B. „Zimmertyp“. */
  auswahlName: string;
  optionen: PreisOption[];
}

/** Preis nach Alter. `bis: null` heißt „und älter“. Alter = am ersten Tag der Veranstaltung. */
export interface Altersregel {
  von: number;
  bis: number | null;
  art: 'frei' | 'prozent' | 'fest';
  /** Bei `prozent`: Prozent vom Grundpreis. Bei `fest`: Cent. */
  wert: number;
}

export interface Anpassung {
  art: 'rabatt' | 'zuschlag';
  /** Steht so in der Aufschlüsselung und in der Mail. */
  bezeichnung: string;
  bedingung: 'immer' | 'fruehbucher' | 'abKind';
  /** Bei `fruehbucher`: letzter Tag (einschließlich), `YYYY-MM-DD`. */
  bis: string;
  /** Bei `abKind`: ab dem wievielten Kind (gezählt vom ältesten Kind an). */
  abKind: number;
  einheit: 'euro' | 'prozent';
  /** Bei `euro`: Cent. Bei `prozent`: Prozent. */
  wert: number;
  gilt: Geltung;
}

/** Extra zum Ankreuzen, z. B. „Bettwäsche leihen“. */
export interface Extra {
  bezeichnung: string;
  preisCent: number;
  gilt: Geltung;
}

export interface PreisRegeln {
  grundpreis: Grundpreis;
  alter: Altersregel[];
  anpassungen: Anpassung[];
  extras: Extra[];
}

/** Eine Anmeldung, wie die Rechnung sie braucht. */
export interface Buchung {
  /** Alter je Person; `null` = unbekannt (kein Geburtsdatum abgefragt) → Grundpreis, zählt nicht als Kind. */
  alter: (number | null)[];
  /** Gewählte Option des Grundpreises (Index), nur bei `auswahl`. */
  option: number;
  /** Tag der Anmeldung, `YYYY-MM-DD` – entscheidet über Frühbucher. */
  angemeldetAm: string;
  /** Angekreuzte Extras, gleiche Reihenfolge wie `regeln.extras`. */
  extras: boolean[];
}

/** Eine Zeile der Aufschlüsselung. `betragCent: null` = Regel gilt bei dieser Anmeldung nicht. */
export interface Posten {
  text: string;
  hinweis: string;
  betragCent: number | null;
}

export interface Preisergebnis {
  posten: Posten[];
  gesamtCent: number;
  /** Gewählte Option ist ausgebucht (A6-5b: im Formular dann nicht wählbar). */
  ausgebucht: boolean;
}

/** Bis zu welchem Alter jemand als Kind zählt (für „ab dem n-ten Kind“). */
export const KIND_BIS_ALTER = 17;

const euroFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** **Betrag als Text, „1.234,50 €“** – so steht er in ChurchTools und in der Mail (A0: Zahlenfelder erscheinen dort als „180.8“). */
export function euroText(cent: number): string {
  return `${euroFormat.format(cent / 100)} €`;
}

/** Text einer Altersgruppe: „unter 3 Jahren“, „3–11 Jahre“, „ab 18 Jahren“. */
export function altersText(r: Altersregel): string {
  if (r.bis === null) return `ab ${r.von} Jahren`;
  if (r.von === 0) return `unter ${r.bis + 1} Jahren`;
  return `${r.von}–${r.bis} Jahre`;
}

function altersregel(regeln: Altersregel[], alter: number | null): Altersregel | undefined {
  if (alter === null) return undefined;
  return regeln.find((r) => alter >= r.von && (r.bis === null || alter <= r.bis));
}

function prozent(cent: number, p: number): number {
  return Math.round((cent * p) / 100);
}

function datumText(iso: string): string {
  const [j, m, t] = iso.split('-').map(Number);
  return `${t}.${m}.${j}`;
}

/** Wann gilt eine Anpassung – als Text für die Aufschlüsselung. */
export function bedingungText(a: Anpassung): string {
  if (a.bedingung === 'fruehbucher') return `bei Anmeldung bis ${datumText(a.bis)}`;
  if (a.bedingung === 'abKind') return `ab dem ${a.abKind}. Kind`;
  return 'immer';
}

/**
 * **Der Betrag einer Anmeldung samt Aufschlüsselung.**
 *
 * Personen ohne bekanntes Alter zahlen den Grundpreis und zählen nicht als Kind. Ein Rabatt macht
 * den Betrag nie negativ.
 */
export function berechnePreis(regeln: PreisRegeln, buchung: Buchung): Preisergebnis {
  const g = regeln.grundpreis;
  const posten: Posten[] = [];
  let gesamt = 0;

  const option = g.art === 'auswahl' ? g.optionen[buchung.option] : undefined;
  const basis = option ? option.preisCent : g.betragCent;
  const ausgebucht = !!option && optionRest(option) === 0;

  // Je Person: Preis nach Grundpreis und Alter; Kinder vom ältesten an durchgezählt
  const personen = buchung.alter.map((alter) => ({ alter, preis: 0, kindNr: 0 }));
  personen
    .filter((p) => p.alter !== null && p.alter <= KIND_BIS_ALTER)
    .sort((a, b) => (b.alter ?? 0) - (a.alter ?? 0))
    .forEach((p, i) => (p.kindNr = i + 1));

  if (g.art === 'fest' && g.gilt === 'anmeldung') {
    posten.push({ text: 'Grundpreis pro Anmeldung', hinweis: '', betragCent: basis });
    gesamt += basis;
  } else {
    for (const p of personen) {
      let preis = basis;
      let hinweis = option ? option.name : 'Grundpreis';
      const r = altersregel(regeln.alter, p.alter);
      if (r) {
        if (r.art === 'frei') {
          preis = 0;
          hinweis += `, ${altersText(r)} frei`;
        } else if (r.art === 'prozent') {
          preis = prozent(basis, r.wert);
          hinweis += `, ${altersText(r)} ${r.wert} %`;
        } else {
          preis = r.wert;
          hinweis += `, ${altersText(r)} Festpreis`;
        }
      }
      p.preis = preis;
      gesamt += preis;
      const wer =
        p.alter === null
          ? 'Person'
          : p.alter > KIND_BIS_ALTER
            ? `Erwachsene Person (${p.alter} J.)`
            : `Kind (${p.alter} J.)`;
      posten.push({ text: wer, hinweis, betragCent: preis });
    }
  }

  for (const a of regeln.anpassungen) {
    const vorzeichen = a.art === 'rabatt' ? -1 : 1;
    if (a.bedingung === 'fruehbucher' && buchung.angemeldetAm > a.bis) {
      posten.push({
        text: a.bezeichnung,
        hinweis: `gilt hier nicht: Anmeldung nach dem ${datumText(a.bis)}`,
        betragCent: null,
      });
      continue;
    }
    const ziele =
      a.bedingung === 'abKind'
        ? personen.filter((p) => p.kindNr >= a.abKind)
        : personen.filter((p) => p.preis > 0);
    if (a.bedingung === 'abKind' && ziele.length === 0) {
      posten.push({
        text: a.bezeichnung,
        hinweis: `gilt hier nicht: weniger als ${a.abKind} Kinder`,
        betragCent: null,
      });
      continue;
    }
    let summe: number;
    let hinweis: string;
    if (a.gilt === 'anmeldung') {
      summe = a.einheit === 'euro' ? a.wert : prozent(gesamt, a.wert);
      hinweis = bedingungText(a);
    } else {
      summe = ziele.reduce(
        (s, p) => s + (a.einheit === 'euro' ? a.wert : prozent(p.preis, a.wert)),
        0,
      );
      hinweis = `${ziele.length} × ${a.einheit === 'euro' ? euroText(a.wert) : `${a.wert} %`}, ${bedingungText(a)}`;
    }
    if (vorzeichen < 0) summe = Math.min(summe, gesamt);
    posten.push({ text: a.bezeichnung, hinweis, betragCent: vorzeichen * summe });
    gesamt += vorzeichen * summe;
  }

  regeln.extras.forEach((x, i) => {
    if (!buchung.extras[i]) return;
    const anzahl = x.gilt === 'person' ? personen.length : 1;
    posten.push({
      text: x.bezeichnung,
      hinweis: anzahl > 1 ? `${anzahl} × ${euroText(x.preisCent)}` : 'pro Anmeldung',
      betragCent: x.preisCent * anzahl,
    });
    gesamt += x.preisCent * anzahl;
  });

  return { posten, gesamtCent: Math.max(0, gesamt), ausgebucht };
}

/**
 * **Was an den Regeln nicht stimmt** – leer, wenn alles passt. Die Erweiterung zeigt die Texte beim
 * Speichern; dieselbe Prüfung gilt beim Lesen der Einstellungen im Formular.
 */
export function pruefeRegeln(regeln: PreisRegeln): string[] {
  const fehler: string[] = [];
  const g = regeln.grundpreis;
  if (g.betragCent < 0) fehler.push('Der Grundpreis darf nicht negativ sein.');
  if (g.art === 'auswahl') {
    if (g.optionen.length === 0)
      fehler.push('Bei einer Auswahl braucht es mindestens eine Option.');
    if (!g.auswahlName.trim()) fehler.push('Bitte angeben, was ausgewählt wird (z. B. Zimmertyp).');
    g.optionen.forEach((o, i) => {
      if (!o.name.trim()) fehler.push(`Option ${i + 1} hat keinen Namen.`);
      if (o.preisCent < 0) fehler.push(`Option „${o.name}“ hat einen negativen Preis.`);
      if (o.kontingent < 0) fehler.push(`Option „${o.name}“ hat ein negatives Kontingent.`);
    });
  }
  const alter = [...regeln.alter].sort((a, b) => a.von - b.von);
  alter.forEach((r, i) => {
    if (r.bis !== null && r.bis < r.von)
      fehler.push(`Altersgruppe ${altersText(r)}: „bis“ liegt vor „von“.`);
    if (r.art === 'prozent' && (r.wert < 0 || r.wert > 1000))
      fehler.push(`Altersgruppe ${altersText(r)}: Prozentwert prüfen.`);
    const vorher = alter[i - 1];
    if (vorher && (vorher.bis === null || r.von <= vorher.bis))
      fehler.push('Die Altersgruppen überschneiden sich. Bitte Grenzen prüfen.');
  });
  for (const a of regeln.anpassungen) {
    if (!a.bezeichnung.trim())
      fehler.push('Ein Rabatt oder Zuschlag braucht eine Bezeichnung – sie steht so in der Mail.');
    if (a.wert < 0)
      fehler.push(
        `„${a.bezeichnung}“: Bitte einen positiven Wert eintragen; ob Rabatt oder Zuschlag, steht daneben.`,
      );
    if (a.art === 'rabatt' && a.einheit === 'prozent' && a.wert > 100)
      fehler.push(`„${a.bezeichnung}“: Ein Rabatt kann höchstens 100 % sein.`);
    if (a.bedingung === 'abKind' && a.abKind < 2)
      fehler.push(`„${a.bezeichnung}“: „ab dem n-ten Kind“ beginnt beim 2. Kind.`);
    if (a.bedingung === 'fruehbucher' && !/^\d{4}-\d{2}-\d{2}$/.test(a.bis))
      fehler.push(`„${a.bezeichnung}“: Datum fehlt.`);
  }
  for (const x of regeln.extras) {
    if (!x.bezeichnung.trim()) fehler.push('Ein Extra braucht eine Bezeichnung.');
    if (x.preisCent < 0) fehler.push(`Extra „${x.bezeichnung}“ hat einen negativen Preis.`);
  }
  return [...new Set(fehler)];
}

/**
 * **Wozu die Preise das Geburtsdatum brauchen** – Preise nach Alter oder ein Geschwister-Rabatt; `null`, wenn
 * gar nicht. Die EINE Stelle für Preise-Karte, „Wer meldet sich an?“, Baukasten und Feld-Bearbeiten (stand
 * vorher dreimal da, einmal ohne den Geschwister-Rabatt).
 */
export function wozuGeburtsdatum(regeln: PreisRegeln): 'alter' | 'geschwister' | null {
  if (regeln.alter.length > 0) return 'alter';
  if (regeln.anpassungen.some((a) => a.bedingung === 'abKind')) return 'geschwister';
  return null;
}

/**
 * **Kann eine Anmeldung überhaupt etwas kosten?** (A4) – sobald irgendein Baustein einen Betrag hat:
 * Grundpreis oder eine Option, ein fester Preis nach Alter, ein Zuschlag oder ein Extra. Rabatte allein
 * kosten nichts. Daran hängt, ob eine Bankverbindung nötig ist (Freigeben, Karte „Bezahlung“).
 */
export function kannEtwasKosten(regeln: PreisRegeln): boolean {
  const g = regeln.grundpreis;
  if (g.art === 'fest' ? g.betragCent > 0 : g.optionen.some((o) => o.preisCent > 0)) return true;
  if (regeln.alter.some((r) => r.art === 'fest' && r.wert > 0)) return true;
  if (regeln.anpassungen.some((a) => a.art === 'zuschlag' && a.wert > 0)) return true;
  return regeln.extras.some((x) => x.preisCent > 0);
}

/**
 * **Der Preis in einem Wort, für Listen** (A2, #480): „kostenlos“, „12,00 € p. P.“, „30,00 € pro Anmeldung“,
 * „ab 65,52 €“ (Auswahl: der günstigste Eintrag). Das ist bewusst nur der **Grundpreis** – Alter, Rabatte und
 * Extras rechnet `berechnePreis` für eine echte Anmeldung aus; in einer Zeile würden sie nur verwirren.
 * Ist der Grundpreis 0, kostet aber etwas anderes (Extra, Zuschlag, Altersstufe): „Preis je nach Angaben“.
 */
export function preisKurz(regeln: PreisRegeln): string {
  const g = regeln.grundpreis;
  if (g.art === 'auswahl' && g.optionen.length === 0) return 'Preis folgt';
  // „kostenlos“ nur, wenn wirklich nichts kostet (A4) – nicht schon bei Grundpreis 0 mit bezahlten Extras.
  if (!kannEtwasKosten(regeln)) return 'kostenlos';
  const je = g.art === 'fest' && g.gilt === 'anmeldung' ? ' pro Anmeldung' : ' p. P.';
  if (g.art === 'auswahl') {
    const min = Math.min(...g.optionen.map((o) => o.preisCent));
    const max = Math.max(...g.optionen.map((o) => o.preisCent));
    if (max === 0) return 'Preis je nach Angaben';
    return min === max ? euroText(min) + je : `ab ${euroText(min)}${je}`;
  }
  return g.betragCent === 0 ? 'Preis je nach Angaben' : euroText(g.betragCent) + je;
}
