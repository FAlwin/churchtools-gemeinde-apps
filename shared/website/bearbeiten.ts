/**
 * **Die Rechenregeln des Editors** (Bauplan Website W3a-2): was „Abschnitt einfügen“, „nach oben“, „kopieren“, „Spalten
 * ändern“, „Baustein hinzufügen“ … mit einer Seite machen – **rein**, ohne etwas zu speichern oder zu zeichnen. Jede
 * Funktion liefert eine **neue** Seite (nie die alte verändert): Der Editor hält die Seite vor dem Öffnen eines Fensters
 * als Sicherung, „Abbrechen“ stellt sie wieder her (Regel „Rückgängig im offenen Fenster“).
 *
 * Eine Stelle wird immer als Zahlen angegeben – `i` Abschnitt, `j` Spalte, `k` Baustein, wie die Reihenfolge im
 * ausgegebenen HTML (`render.ts`). Außerhalb des Bereichs tun die Funktionen **nichts** (liefern die Seite unverändert):
 * Die Zahlen können aus einer Nachricht der Vorschau stammen (`website/src/nachricht.ts`), und eine falsche darf nichts
 * zerstören.
 */
import {
  pruefeWebsite,
  seiteSchema,
  spaltenAnzahl,
  type Abschnitt,
  type Aufteilung,
  type Baustein,
  type Einstellungen,
  type Gestaltung,
  type Menue,
  type Seite,
} from './modell';
import { menueOhneSeite, vorlaeufigeEinstellungen } from './seitenListe';

export type Richtung = 'hoch' | 'runter';

// ── Stellen prüfen ───────────────────────────────────────────────────────────────────────────────────────────

const istIndex = (n: unknown, laenge: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < laenge;

/** Gibt es diesen Abschnitt? */
export function abschnittDa(seite: Seite, i: unknown): i is number {
  return istIndex(i, seite.abschnitte.length);
}

/** Gibt es diese Spalte? */
export function spalteDa(seite: Seite, i: unknown, j: unknown): boolean {
  return abschnittDa(seite, i) && istIndex(j, seite.abschnitte[i].spalten.length);
}

/** Gibt es diesen Baustein? */
export function bausteinDa(seite: Seite, i: unknown, j: unknown, k: unknown): boolean {
  return (
    spalteDa(seite, i, j) &&
    istIndex(k, seite.abschnitte[i as number].spalten[j as number].bausteine.length)
  );
}

/** Die Stelle, an die ein Baustein in der Spalte `j` des Abschnitts `i` kommt: 0 (ganz oben) bis Anzahl der Bausteine dort (ganz unten; eine leere Spalte hat nur die 0). */
export function bausteinStelleDa(seite: Seite, i: unknown, j: unknown, k: unknown): boolean {
  return (
    spalteDa(seite, i, j) &&
    typeof k === 'number' &&
    Number.isInteger(k) &&
    k >= 0 &&
    k <= seite.abschnitte[i as number].spalten[j as number].bausteine.length
  );
}

/** Die Stelle, an die ein neuer Abschnitt kommt: 0 (ganz oben) bis `abschnitte.length` (ganz unten). */
export function einfuegeStelleDa(seite: Seite, i: unknown): i is number {
  return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i <= seite.abschnitte.length;
}

// ── Abschnitte ───────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Abschnitt an die Stelle `i` (Stelle 0 = ganz oben). Außerhalb: unverändert. */
export function abschnittEinfuegen(seite: Seite, i: number, abschnitt: Abschnitt): Seite {
  if (!einfuegeStelleDa(seite, i)) return seite;
  const abschnitte = [...seite.abschnitte];
  abschnitte.splice(i, 0, abschnitt);
  return { ...seite, abschnitte };
}

/**
 * **Den Abschnitt `von` vor die Einfügestelle `nach` setzen** (Ziehen und Pfeiltasten, W3c-2). `nach` ist eine **Stelle** wie bei
 * `abschnittEinfuegen`: 0 (ganz oben) bis `abschnitte.length` (ganz unten), gezählt **vor** dem Herausnehmen – die Stelle
 * direkt über dem Abschnitt (`von`) und die direkt darunter (`von + 1`) lassen ihn, wo er ist. Die Verschiebung der Zahl, die
 * das Herausnehmen auslöst, rechnet nur diese Funktion. Ungültige Stellen und „bleibt, wo er ist“: dieselbe Seite zurück
 * (`===`), damit der Aufrufer nichts speichert.
 */
export function abschnittVerschiebenNach(seite: Seite, von: number, nach: number): Seite {
  if (!abschnittDa(seite, von) || !einfuegeStelleDa(seite, nach)) return seite;
  if (nach === von || nach === von + 1) return seite;
  const abschnitte = [...seite.abschnitte];
  const [a] = abschnitte.splice(von, 1);
  abschnitte.splice(nach > von ? nach - 1 : nach, 0, a);
  return { ...seite, abschnitte };
}

/** Den Abschnitt `i` eine Stelle nach oben oder unten; am Rand: unverändert. */
export function abschnittVerschieben(seite: Seite, i: number, richtung: Richtung): Seite {
  return abschnittVerschiebenNach(seite, i, richtung === 'hoch' ? i - 1 : i + 2);
}

/**
 * Den Abschnitt `i` kopieren – die Kopie steht direkt darunter. **Neue Kennungen** für Abschnitt, Spalten und Bausteine
 * (sie sind je Seite einmalig, `pruefeWebsite`) – aber **nicht** für das, was kein Eigenname dieses Abschnitts ist:
 * Bild-Kennungen und Seiten-Links bleiben. Die **Sprungmarke bleibt der Vorlage**: Sie ist je Seite einmalig, die Kopie
 * hat darum keine.
 */
export function abschnittKopieren(seite: Seite, i: number, neueId: () => string): Seite {
  if (!abschnittDa(seite, i)) return seite;
  const alt = seite.abschnitte[i];
  const kopie: Abschnitt = structuredClone(alt);
  delete kopie.gestaltung.anker;
  kopie.id = neueId();
  for (const sp of kopie.spalten) {
    sp.id = neueId();
    for (const b of sp.bausteine) b.id = neueId();
  }
  return abschnittEinfuegen(seite, i + 1, kopie);
}

/** Den Abschnitt `i` entfernen. */
export function abschnittLoeschen(seite: Seite, i: number): Seite {
  if (!abschnittDa(seite, i)) return seite;
  return { ...seite, abschnitte: seite.abschnitte.filter((_, n) => n !== i) };
}

/** Den Abschnitt `i` durch diesen ersetzen (Fenster „Abschnitt gestalten“, Abbrechen). */
export function abschnittErsetzen(seite: Seite, i: number, abschnitt: Abschnitt): Seite {
  if (!abschnittDa(seite, i)) return seite;
  return { ...seite, abschnitte: seite.abschnitte.map((a, n) => (n === i ? abschnitt : a)) };
}

/**
 * **Die Spalten ändern.** Mehr Spalten: leere kommen dazu. **Weniger: die Inhalte der wegfallenden Spalten wandern
 * hinten an die letzte, die bleibt – es geht nie ein Baustein verloren.** (Was bei einer wegfallenden Spalte
 * verschwindet, ist nur ihre eigene Gestaltung: Hintergrund und „Handy zuerst“.)
 */
export function aufteilungAendern(
  abschnitt: Abschnitt,
  aufteilung: Aufteilung,
  neueId: () => string,
): Abschnitt {
  const soll = spaltenAnzahl(aufteilung);
  const spalten = abschnitt.spalten.map((s) => ({ ...s, bausteine: [...s.bausteine] }));
  while (spalten.length < soll) spalten.push({ id: neueId(), bausteine: [] });
  while (spalten.length > soll) {
    const weg = spalten.pop()!;
    spalten[spalten.length - 1].bausteine.push(...weg.bausteine);
  }
  return { ...abschnitt, aufteilung, spalten };
}

/**
 * **Aufteilung per Ziehen an der Trennlinie (W3c-3): nur eine mit DERSELBEN Spaltenzahl.** Die Spaltenzahl ändert sich dabei nie,
 * also geht kein Baustein verloren (anders als im Fenster „Gestalten“, wo `aufteilungAendern` Spalten zusammenlegen darf). Die
 * Zahl der Spalten kommt aus dem Namen der Aufteilung (`spaltenAnzahl`), es gibt keine zweite Liste.
 */
export function aufteilungGleicheSpalten(abschnitt: Abschnitt, aufteilung: Aufteilung): boolean {
  return spaltenAnzahl(aufteilung) === abschnitt.spalten.length;
}

/** Die Aufteilung des Abschnitts `i` ändern, ohne die Spaltenzahl zu ändern. Sonst (oder wenn es den Abschnitt nicht gibt) `null` – dann ändert der Aufrufer nichts. */
export function aufteilungZiehen(
  seite: Seite,
  i: number,
  aufteilung: Aufteilung,
  neueId: () => string,
): Seite | null {
  if (!abschnittDa(seite, i)) return null;
  const a = seite.abschnitte[i];
  if (!aufteilungGleicheSpalten(a, aufteilung)) return null;
  return abschnittErsetzen(seite, i, aufteilungAendern(a, aufteilung, neueId));
}

/** Die Gestaltung eines Abschnitts teilweise ändern – EINE Stelle für das Fenster „Gestalten“ und das Ziehen des Abstands. */
export function gestaltungAendern(abschnitt: Abschnitt, teil: Partial<Gestaltung>): Abschnitt {
  return { ...abschnitt, gestaltung: { ...abschnitt.gestaltung, ...teil } };
}

// ── Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Baustein ans Ende der Spalte `j` im Abschnitt `i`. */
export function bausteinHinzufuegen(seite: Seite, i: number, j: number, baustein: Baustein): Seite {
  if (!spalteDa(seite, i, j)) return seite;
  return mitSpalte(seite, i, j, (bs) => [...bs, baustein]);
}

/** Den Baustein `k` durch diesen ersetzen (Fenster „Baustein bearbeiten“, Abbrechen). */
export function bausteinErsetzen(
  seite: Seite,
  i: number,
  j: number,
  k: number,
  baustein: Baustein,
): Seite {
  if (!bausteinDa(seite, i, j, k)) return seite;
  return mitSpalte(seite, i, j, (bs) => bs.map((b, n) => (n === k ? baustein : b)));
}

/** Den Baustein `k` entfernen. */
export function bausteinEntfernen(seite: Seite, i: number, j: number, k: number): Seite {
  if (!bausteinDa(seite, i, j, k)) return seite;
  return mitSpalte(seite, i, j, (bs) => bs.filter((_, n) => n !== k));
}

/** Wo ein Baustein steht – oder, als Ziel, **vor welcher Stelle** (`k`: 0 = ganz oben in der Spalte … Länge = ganz unten). */
export interface BausteinStelle {
  i: number;
  j: number;
  k: number;
}

/**
 * **Den Baustein `von` an die Stelle `nach` setzen** (Ziehen und Pfeiltasten, W3c-2): in dieselbe Spalte, in eine andere Spalte
 * oder in einen anderen Abschnitt. `nach.k` ist eine **Stelle** in der Zielspalte (0 … Anzahl der Bausteine dort, auch bei einer
 * leeren Spalte 0), gezählt **vor** dem Herausnehmen – steht das Ziel in derselben Spalte hinter dem Baustein, rückt die Stelle
 * beim Herausnehmen um eins nach vorn (nur hier gerechnet). Die Stelle direkt über und direkt unter dem Baustein lassen ihn, wo er
 * ist. Ungültige Stellen und „bleibt, wo er ist“: dieselbe Seite zurück (`===`).
 */
export function bausteinVerschieben(
  seite: Seite,
  von: BausteinStelle,
  nach: BausteinStelle,
): Seite {
  if (!bausteinDa(seite, von.i, von.j, von.k) || !bausteinStelleDa(seite, nach.i, nach.j, nach.k))
    return seite;
  const gleicheSpalte = von.i === nach.i && von.j === nach.j;
  if (gleicheSpalte && (nach.k === von.k || nach.k === von.k + 1)) return seite;
  const baustein = seite.abschnitte[von.i].spalten[von.j].bausteine[von.k];
  const stelle = gleicheSpalte && nach.k > von.k ? nach.k - 1 : nach.k;
  const ohne = bausteinEntfernen(seite, von.i, von.j, von.k);
  return mitSpalte(ohne, nach.i, nach.j, (bs) => {
    const neu = [...bs];
    neu.splice(stelle, 0, baustein);
    return neu;
  });
}

function mitSpalte(
  seite: Seite,
  i: number,
  j: number,
  aendern: (bausteine: Baustein[]) => Baustein[],
): Seite {
  return {
    ...seite,
    abschnitte: seite.abschnitte.map((a, n) =>
      n !== i
        ? a
        : {
            ...a,
            spalten: a.spalten.map((s, m) =>
              m !== j ? s : { ...s, bausteine: aendern(s.bausteine) },
            ),
          },
    ),
  };
}

// ── Prüfen vor dem Speichern ────────────────────────────────────────────────────────────────────────────────

/** Die Seite im Wortlaut einer Fehlermeldung: `abschnitte.0.gestaltung.anker` → „Abschnitt 1 › Gestaltung › Sprungmarke“. */
function stelleText(pfad: readonly PropertyKey[]): string {
  const teile: string[] = [];
  const NAMEN: Record<string, string> = {
    gestaltung: 'Gestaltung',
    anker: 'Sprungmarke',
    hintergrund: 'Hintergrund',
    titel: 'Titel',
    pfad: 'Adresse',
    beschreibung: 'Beschreibung',
    text: 'Text',
    markdown: 'Text',
    alt: 'Beschreibung des Bildes',
    unterschrift: 'Unterschrift',
    ziel: 'Ziel',
    url: 'Adresse',
    kalender: 'Kalender',
    anzahl: 'Anzahl',
    html: 'HTML',
  };
  for (let n = 0; n < pfad.length; n++) {
    const p = pfad[n];
    if (p === 'abschnitte' && typeof pfad[n + 1] === 'number') {
      teile.push(`Abschnitt ${(pfad[++n] as number) + 1}`);
    } else if (p === 'spalten' && typeof pfad[n + 1] === 'number') {
      teile.push(`Spalte ${(pfad[++n] as number) + 1}`);
    } else if (p === 'bausteine' && typeof pfad[n + 1] === 'number') {
      teile.push(`Baustein ${(pfad[++n] as number) + 1}`);
    } else if (p === 'knoepfe' && typeof pfad[n + 1] === 'number') {
      teile.push(`Knopf ${(pfad[++n] as number) + 1}`);
    } else if (typeof p === 'string' && NAMEN[p]) teile.push(NAMEN[p]);
  }
  return teile.join(' › ');
}

/**
 * **Passt diese Seite zum Modell und zu den anderen Seiten?** Leer = in Ordnung, sonst verständliche Meldungen. Geprüft wird
 * vor **jedem** Speichern: das Schema der Seite (`seiteSchema`) und – mit allen anderen Seiten – doppelte Adressen,
 * Kennungen und Sprungmarken (`pruefeWebsite`). Wer diese Prüfung nicht besteht, wird nicht gespeichert; die Meldung steht
 * im Fenster.
 *
 * Bewusst **nicht** blockierend: Links zu Seiten oder Sprungmarken, die es nicht (mehr) gibt, und ein fehlender
 * Datenschutz-Link – das zeigt später die Freigabe (W3b) als Hinweis; mitten im Bearbeiten wäre es im Weg.
 */
export function seitePruefen(
  seite: Seite,
  andere: readonly Seite[],
  menue: Menue | null,
  einstellungen: Einstellungen | null,
): string[] {
  const r = seiteSchema.safeParse(seite);
  if (!r.success) {
    const meldungen = r.error.issues.map((is) => {
      const wo = stelleText(is.path);
      return wo ? `${wo}: ${is.message}` : is.message;
    });
    return [...new Set(meldungen)].slice(0, 5);
  }
  const alle = [...andere.filter((s) => s.id !== seite.id), seite];
  return pruefeWebsite(
    alle,
    menue ?? { eintraege: [] },
    einstellungen ?? vorlaeufigeEinstellungen(null),
  )
    .filter((h) => h.art === 'pfad' || h.art === 'id' || h.art === 'anker')
    .map((h) => h.meldung);
}

/**
 * Sind zwei Seiten inhaltlich dieselbe? Die Reihenfolge der Felder zählt nicht: Beide laufen durchs Schema (eine gelesene
 * Seite hat die Reihenfolge des Schemas, eine selbst gebaute die, in der sie gebaut wurde). Der Editor fragt damit, ob
 * jemand die gespeicherte Seite inzwischen geändert hat.
 */
export function seiteGleich(a: Seite, b: Seite): boolean {
  const normal = (s: Seite) => {
    const r = seiteSchema.safeParse(s);
    return JSON.stringify(r.success ? r.data : s);
  };
  return normal(a) === normal(b);
}

// ── Menü ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Den Menüpunkt `n` eine Stelle nach oben oder unten; am Rand: unverändert. */
export function menueVerschieben(menue: Menue, n: number, richtung: Richtung): Menue {
  const ziel = richtung === 'hoch' ? n - 1 : n + 1;
  if (!istIndex(n, menue.eintraege.length) || !istIndex(ziel, menue.eintraege.length)) return menue;
  const eintraege = [...menue.eintraege];
  [eintraege[n], eintraege[ziel]] = [eintraege[ziel], eintraege[n]];
  return { eintraege };
}

/** Steht ein Menüpunkt auf diese Seite (auch als Unterpunkt)? */
export function imMenueZeigen(menue: Menue | null, seiteId: string): boolean {
  return menue !== null && menueOhneSeite(menue, seiteId) !== null;
}

/**
 * „Im Menü zeigen“ ein- oder ausschalten. Einschalten hängt einen Punkt mit dem Titel der Seite **hinten** an;
 * ausschalten entfernt alle Punkte, die auf die Seite zeigen (`menueOhneSeite`). Ändert sich nichts: `null` – dann muss das
 * Menü nicht neu gespeichert werden.
 */
export function menueFuerSeite(menue: Menue | null, seite: Seite, imMenue: boolean): Menue | null {
  const da = imMenueZeigen(menue, seite.id);
  if (imMenue === da) return null;
  if (!imMenue) return menueOhneSeite(menue, seite.id);
  return {
    eintraege: [
      ...(menue?.eintraege ?? []),
      { titel: seite.titel.slice(0, 60), ziel: { art: 'seite', seiteId: seite.id } },
    ],
  };
}

/**
 * Ändert sich der Titel einer Seite, ziehen die Menüpunkte mit, die noch **genau den alten Titel** tragen (also nie von
 * Hand umbenannt wurden). `null`, wenn sich nichts ändert.
 */
export function menueTitelNachziehen(
  menue: Menue | null,
  seiteId: string,
  alterTitel: string,
  neuerTitel: string,
): Menue | null {
  if (!menue || alterTitel === neuerTitel) return null;
  const alt = alterTitel.slice(0, 60);
  const neu = neuerTitel.slice(0, 60);
  let geaendert = false;
  const umbenennen = <T extends { titel: string; ziel: { art: string; seiteId?: string } }>(
    p: T,
  ): T => {
    if (p.ziel.art === 'seite' && p.ziel.seiteId === seiteId && p.titel === alt && neu !== '') {
      geaendert = true;
      return { ...p, titel: neu };
    }
    return p;
  };
  const eintraege = menue.eintraege.map((e) => ({
    ...umbenennen(e),
    ...(e.unter ? { unter: e.unter.map(umbenennen) } : {}),
  }));
  return geaendert ? { eintraege } : null;
}
