/**
 * **Zauberstab – automatische Planung** (Bauplan E5, Entwurf `e5-entwurf.html`, Alwin 16.10.2026). Nur Regeln;
 * geladen wird in `dienstplaner/src/ladeZauberstab.ts`, gezeigt im Zauberstab-Fenster (E5-2).
 *
 * **Wie der ChurchTools-Zauberstab** (nachgelesen 16.10.2026 in `cs_listview.js`, `selectPossiblePersonForService`):
 * je freiem Platz die Person mit der höchsten Punktzahl, **nur wenn sie über −100 liegt**, und nur wenn sie in
 * diesem Termin noch keinen Vorschlag hat. Die Punktzahl rechnet ChurchTools (`possiblepersons`); die Kandidaten
 * kommen aus derselben Funktion wie „Wer kann?“ (`kandidatenAus`). **Anders als dort zählt hier der Abzug „hat zuvor
 * abgesagt“ (−500) mit – wie im ChurchTools-Zauberstab** (Alwin, 16.10.2026, nach der Prüfung an Termin 148). Er
 * trifft auch, wer vom Planer herausgenommen wurde (ChurchTools unterscheidet das nicht); der Planer kann so jemanden
 * im Fenster trotzdem bewusst wählen.
 *
 * **Anders als ChurchTools: Der Lauf geht über mehrere Termine, und die eigenen Vorschläge zählen mit** (Alwin,
 * 16.10.: „mitzählen“). ChurchTools kennt sie nicht und würde sonst an jedem Sonntag dieselbe Person nennen.
 * Mitgezählt wird **wie eine echte Einteilung, mit den Abzügen von ChurchTools selbst** (gemessen E5-0, 16.10.,
 * Messprotokoll) – keine eigene Regel:
 * - selber Tag −250 (`service.same-day`) – damit ausgeschlossen, z. B. 9- und 11-Uhr-Gottesdienst;
 * - je Dienst im Monat des Termins −3, einen Monat daneben −2, zwei Monate daneben −1 (`month.utilization…`);
 * - Abstand zum nächsten Dienst davor/danach: unter 7 Tagen −50, 7–13 Tage −10 (`last/next.service.near`) –
 *   ChurchTools nimmt nur den jeweils nächsten, also gilt der nähere von beiden, nicht die Summe;
 * - „höchstens N× im Monat“ erreicht −100 (`preference.max-reached`) – damit ausgeschlossen.
 * Bei Gleichstand zuerst, wer im Lauf seltener dran ist (Alwin, 16.10.), dann nach Namen.
 */
import { monateBis, tageBis } from '../ct/datum';
import { kandidatenAus, type Kandidat, type RohKandidat } from './werKann';

/** Ab hier nimmt der Zauberstab niemanden (ChurchTools: `if (-100 < e)`). */
export const GRENZE = -100;

/** Ein freier Platz für den Zauberstab. `tag` = Datum des Termins in Ortszeit (`JJJJ-MM-TT`). */
export interface ZauberPlatz {
  /** Eindeutig je Platz (z. B. `ortSchluessel`) – damit ordnen Fenster und Vorschläge einander zu. */
  schluessel: string;
  terminId: number;
  serviceId: number;
  tag: string;
  /** Wer an diesem Dienst im Termin schon eingeteilt ist – steht nicht zur Wahl (wie in „Wer kann?“). */
  schonDa: readonly number[];
  /** Die Antwort von `possiblepersons` für diesen Termin und Dienst. */
  roh: readonly RohKandidat[];
}

/** Schon im Lauf eingeplant: ein eigener Vorschlag, ein von Hand gewählter Name oder ein vorhandener Entwurf. */
export interface Eingeplant {
  personId: number;
  tag: string;
}

export interface Bewertet extends Kandidat {
  /** ChurchTools' Punktzahl (mit „hat zuvor abgesagt“) und die Abzüge aus dem Lauf. */
  wert: number;
  /** Wie oft die Person im Lauf schon eingeplant ist (alle Termine). */
  imLauf: number;
  /** Warum der Lauf sie ausschließt – `null`, wenn er es nicht tut. */
  laufGrund: 'am-tag' | 'hoechstens' | null;
  /** Kommt für den Zauberstab in Frage (`wert` über der Grenze). */
  passt: boolean;
}

/** ChurchTools' Abzug für den Abstand zum nächsten Dienst (gemessen E5-0). */
export function abstandsAbzug(tage: number): number {
  if (tage < 7) return -50;
  if (tage < 14) return -10;
  return 0;
}

/** ChurchTools' Abzug je Dienst in einem Monat, `abstand` Monate vom Monat des Termins entfernt (gemessen E5-0). */
export function monatsAbzug(abstand: number): number {
  return abstand <= 2 ? -(3 - abstand) : 0;
}

/** Die Kandidaten eines Platzes mit dem, was der Lauf schon eingeplant hat – beste zuerst. */
export function bewerte(platz: ZauberPlatz, eingeplant: readonly Eingeplant[]): Bewertet[] {
  const kandidaten = kandidatenAus([...platz.roh], {
    monat: platz.tag.slice(0, 7),
    schonDa: new Set(platz.schonDa),
  });
  const out = kandidaten.map((k): Bewertet => {
    const meine = eingeplant.filter((e) => e.personId === k.personId);
    let abzug = 0;
    let laufGrund: Bewertet['laufGrund'] = null;

    if (meine.some((e) => e.tag === platz.tag)) {
      if (!k.gruende.includes('service.same-day')) abzug -= 250;
      laufGrund = 'am-tag';
    }
    for (const e of meine) abzug += monatsAbzug(Math.abs(monateBis(e.tag, platz.tag)));

    // Davor/danach: der nähere Dienst zählt – ist ein eingeplanter näher als der echte, ersetzt sein Abzug den echten.
    const davor = meine.map((e) => tageBis(e.tag, platz.tag)).filter((t) => t > 0);
    const danach = meine.map((e) => tageBis(platz.tag, e.tag)).filter((t) => t > 0);
    if (davor.length) abzug += Math.min(0, abstandsAbzug(Math.min(...davor)) - k.abstandDavor);
    if (danach.length) abzug += Math.min(0, abstandsAbzug(Math.min(...danach)) - k.abstandDanach);

    const imMonat = meine.filter((e) => e.tag.slice(0, 7) === platz.tag.slice(0, 7)).length;
    if (
      k.hoechstensImMonat !== null &&
      imMonat > 0 &&
      k.imMonat + imMonat >= k.hoechstensImMonat &&
      !k.gruende.includes('preference.max-reached')
    ) {
      abzug -= 100;
      laufGrund ??= 'hoechstens';
    }

    const wert = k.punkte + k.frueherAbgesagt + abzug;
    return { ...k, wert, imLauf: meine.length, laufGrund, passt: wert > GRENZE };
  });
  return out.sort(
    (a, b) => b.wert - a.wert || a.imLauf - b.imLauf || a.name.localeCompare(b.name, 'de'),
  );
}

/**
 * Vorschläge für alle Plätze, der Reihe nach (früher zuerst – der Aufrufer sortiert). Jeder Vorschlag zählt für
 * die folgenden mit. `fest` = von Hand gewählte Namen (`null` = bewusst frei lassen): Sie bleiben, wie sie sind,
 * und zählen von Anfang an mit. `eingeplant` = was schon vorher feststeht (vorhandene Entwürfe der Gruppe).
 *
 * Ergebnis je Platz: die Person oder `null`, wenn niemand passt.
 */
export function vorschlagen(
  plaetze: readonly ZauberPlatz[],
  o: { eingeplant?: readonly Eingeplant[]; fest?: ReadonlyMap<string, number | null> } = {},
): Map<string, number | null> {
  const fest = o.fest ?? new Map<string, number | null>();
  const lauf: Eingeplant[] = [...(o.eingeplant ?? [])];
  for (const p of plaetze) {
    const person = fest.get(p.schluessel);
    if (person != null) lauf.push({ personId: person, tag: p.tag });
  }
  const ergebnis = new Map<string, number | null>();
  for (const p of plaetze) {
    if (fest.has(p.schluessel)) {
      ergebnis.set(p.schluessel, fest.get(p.schluessel) ?? null);
      continue;
    }
    const beste = bewerte(p, lauf).find((k) => k.passt) ?? null;
    ergebnis.set(p.schluessel, beste?.personId ?? null);
    if (beste) lauf.push({ personId: beste.personId, tag: p.tag });
  }
  return ergebnis;
}
