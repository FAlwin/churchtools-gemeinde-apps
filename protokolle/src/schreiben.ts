/**
 * **Schreiben am Protokoll** (Bauplan Protokolle S4-1, 3.3) – Sperre nehmen, speichern, übernehmen, freigeben. Die
 * Regeln stehen in `@shared/protokolle/speicher` (`schreibLage`, `sperreLage`, `teileBauen`, `dokumentAusTeilen`); hier
 * wird nur bei ChurchTools gelesen und geschrieben.
 *
 * Der Erweiterungs-Speicher kennt **keine Versionen** (zwei gleichzeitige `PUT` – einer geht still verloren, gemessen
 * beim Dienstplaner). Deshalb gilt bei jedem Schritt:
 * - **vorher frisch lesen** und mit `schreibLage` prüfen – fremde Sperre, inzwischen anderer Stand oder freigegeben →
 *   nichts schreiben, sondern melden;
 * - **nachher nachlesen** – ein `201` ist kein Beleg (Lehre vom 11.08.2026); fehlt etwas, wird geworfen;
 * - Reihenfolge beim Speichern: neue Teile → nachlesen → Kopf umstellen → nachlesen → alte Teile löschen. Bricht es
 *   unterwegs ab, zeigt der Kopf weiter auf einen vollständigen Stand.
 *
 * **Vorübergehend ist nicht ungültig:** Jeder Fehler beim Lesen oder Schreiben wird geworfen; der Editor behält seinen
 * Text und versucht es erneut. Nur das Aufräumen alter Teile darf scheitern – das nächste Speichern räumt sie mit weg.
 */
import { werteLesen, wertAendern, wertAnlegen, wertLoeschen } from '@shared/ct/modulDaten';
import type { Block } from '@shared/protokolle/dokument';
import {
  dokumentAusTeilen,
  dokumentDerSitzung,
  schreibLage,
  sitzungAusWerten,
  sperreLage,
  sperreVon,
  teileBauen,
  type ProtokollKopf,
  type Schreiber,
  type Sperre,
} from '@shared/protokolle/speicher';
import { festePunkteLoesen } from '@shared/protokolle/festePunkte';
import { freigegebenerKopf, zurueckgenommenerKopf, type Wer } from '@shared/protokolle/freigabe';
import { NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';

/** Wo das Protokoll liegt. */
export interface ProtokollOrt {
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  sitzung: string;
}

/** Warum nicht geschrieben wurde – `schreibLage` ohne `ok`, bei `gesperrt` mit der fremden Sperre. */
export type Abgewiesen =
  | { art: 'weg' }
  | { art: 'fest' }
  | { art: 'veraendert' }
  | { art: 'gesperrt'; sperre: Sperre };

export type SchreibErgebnis = { art: 'ok'; kopf: ProtokollKopf } | Abgewiesen;

const VERWEIGERT = 'Du darfst dieses Protokoll nicht bearbeiten.';

async function frisch(ort: ProtokollOrt) {
  return sitzungAusWerten(await werteLesen(modulPort, ort.modul, ort.kategorie), ort.sitzung);
}

type Frisch = Awaited<ReturnType<typeof frisch>>;

/** Die Abweisung zu einem frisch gelesenen Stand – `null`, wenn geschrieben werden darf. */
function abweisung(f: Frisch, ich: Schreiber, basisStand: string, jetzt: Date): Abgewiesen | null {
  const lage = schreibLage(f.kopf?.inhalt ?? null, ich, basisStand, jetzt);
  if (lage === 'ok') return null;
  if (lage === 'gesperrt') return { art: 'gesperrt', sperre: f.kopf!.inhalt.sperre! };
  return { art: lage };
}

/** Kopf schreiben – immer auf dem frisch gelesenen, damit Felder, die wir nicht kennen, erhalten bleiben. */
async function kopfSchreiben(ort: ProtokollOrt, id: number, kopf: ProtokollKopf): Promise<void> {
  await wertAendern(modulPort, ort.modul, ort.kategorie, id, JSON.stringify(kopf), VERWEIGERT);
}

/** Nach dem Schreiben der Sperre: Steht sie da? Hat in der Zwischenzeit jemand anderes sie genommen → abgewiesen. */
function sperrePruefen(f: Frisch, ich: Schreiber, jetzt: Date): SchreibErgebnis {
  const kopf = f.kopf?.inhalt;
  if (!kopf) return { art: 'weg' };
  if (sperreLage(kopf.sperre, ich, jetzt) === 'meine') return { art: 'ok', kopf };
  if (kopf.sperre) return { art: 'gesperrt', sperre: kopf.sperre };
  throw new Error('ChurchTools hat die Schreibsperre nicht übernommen.');
}

/**
 * **Das Protokoll frisch lesen** – zum Öffnen im Editor und zum Mitlesen. `dokument` ist `null`, solange keins da ist
 * (geplant) oder gerade nicht vollständig lesbar.
 */
export async function protokollLesen(
  ort: ProtokollOrt,
): Promise<{ kopf: ProtokollKopf | null; dokument: Block[] | null }> {
  const f = await frisch(ort);
  const kopf = f.kopf?.inhalt ?? null;
  return {
    kopf,
    dokument: dokumentDerSitzung(
      kopf,
      f.teile.map((t) => t.teil),
    ),
  };
}

/**
 * **Sperre nehmen** (beim ersten Tippen) oder **erneuern**. Nur, wenn niemand sonst schreibt und der Stand noch der
 * ist, auf dem dieses Fenster aufsetzt.
 */
export async function sperreNehmen(
  ort: ProtokollOrt,
  ich: Schreiber,
  basisStand: string,
  jetzt = new Date(),
): Promise<SchreibErgebnis> {
  const f = await frisch(ort);
  const nein = abweisung(f, ich, basisStand, jetzt);
  if (nein) return nein;
  await kopfSchreiben(ort, f.kopf!.id, { ...f.kopf!.inhalt, sperre: sperreVon(ich, jetzt) });
  return sperrePruefen(await frisch(ort), ich, jetzt);
}

/**
 * **Schreiben übernehmen** – die Sperre eines anderen (oder eines anderen eigenen Fensters) bewusst wegnehmen
 * (Alwin 24.10.2026: sofort, mit Rückfrage in der Oberfläche). Weiter geht es mit dem **zuletzt gespeicherten** Stand;
 * was im anderen Fenster noch nicht gespeichert war, bleibt dort sichtbar.
 */
export async function schreibenUebernehmen(
  ort: ProtokollOrt,
  ich: Schreiber,
  jetzt = new Date(),
): Promise<
  { art: 'ok'; kopf: ProtokollKopf; dokument: Block[] } | Exclude<Abgewiesen, { art: 'veraendert' }>
> {
  const f = await frisch(ort);
  if (!f.kopf) return { art: 'weg' };
  if (f.kopf.inhalt.status !== 'entwurf') return { art: 'fest' };
  await kopfSchreiben(ort, f.kopf.id, { ...f.kopf.inhalt, sperre: sperreVon(ich, jetzt) });
  const danach = await frisch(ort);
  const ergebnis = sperrePruefen(danach, ich, jetzt);
  if (ergebnis.art !== 'ok') return ergebnis as Exclude<Abgewiesen, { art: 'veraendert' }>;
  const dokument = dokumentDerSitzung(
    ergebnis.kopf,
    danach.teile.map((t) => t.teil),
  );
  if (!dokument) throw new Error('Das Protokoll ist gerade nicht vollständig lesbar.');
  return { art: 'ok', kopf: ergebnis.kopf, dokument };
}

/**
 * **Speichern** (S4-1, automatisch kurz nach der letzten Eingabe). `basisStand` = der Stand, den dieses Fenster zuletzt
 * geladen oder gespeichert hat. Ist das Dokument unverändert, wird nur das Lebenszeichen der Sperre erneuert.
 *
 * `vorher` (S4-2: die To-Dos in „Mitarbeit“ abgleichen) läuft erst, **nachdem** feststeht, dass dieses Fenster schreiben
 * darf, und **bevor** am Protokoll etwas geschrieben wird: Ein Fenster ohne Sperre fasst die To-Dos nie an, und scheitert
 * der Abgleich, bleibt das Protokoll, wie es war (das nächste Speichern rechnet ihn neu).
 */
export async function speichern(
  ort: ProtokollOrt,
  ich: Schreiber,
  basisStand: string,
  dokument: readonly Block[],
  jetzt = new Date(),
  vorher?: () => Promise<void>,
): Promise<SchreibErgebnis> {
  const f = await frisch(ort);
  const nein = abweisung(f, ich, basisStand, jetzt);
  if (nein) return nein;
  if (vorher) await vorher();
  const { stand, f2 } = await teileSichern(ort, f, dokument);
  const nein2 = abweisung(f2, ich, basisStand, jetzt);
  if (nein2) return nein2;

  // 3. Kopf umstellen und nachlesen.
  await kopfSchreiben(ort, f2.kopf!.id, {
    ...f2.kopf!.inhalt,
    stand,
    sperre: sperreVon(ich, jetzt),
  });
  const f3 = await frisch(ort);
  const ergebnis = sperrePruefen(f3, ich, jetzt);
  if (ergebnis.art !== 'ok') return ergebnis;
  if (ergebnis.kopf.stand !== stand)
    throw new Error('ChurchTools hat den neuen Stand des Protokolls nicht übernommen.');

  await alteTeileWeg(ort, f3, stand);
  return ergebnis;
}

/**
 * Schritte 1 und 2 beim Speichern (auch Freigeben und Zurücknehmen): neue Teile anlegen – außer, sie liegen schon
 * vollständig da (unverändertes Dokument, oder derselbe Text wie bei einem früheren Speichern, dessen Aufräumen
 * scheiterte) – und nachlesen, ob sie vollständig sind. Liefert den neuen Stand und den frisch gelesenen Speicher.
 */
async function teileSichern(
  ort: ProtokollOrt,
  f: Frisch,
  dokument: readonly Block[],
): Promise<{ stand: string; f2: Frisch }> {
  const { stand, werte } = teileBauen(dokument, ort.sitzung);
  const ziel = { sitzung: ort.sitzung, stand };
  if (
    !dokumentAusTeilen(
      ziel,
      f.teile.map((t) => t.teil),
    )
  )
    for (const w of werte) await wertAnlegen(modulPort, ort.modul, ort.kategorie, w, VERWEIGERT);
  const f2 = await frisch(ort);
  if (
    !dokumentAusTeilen(
      ziel,
      f2.teile.map((t) => t.teil),
    )
  )
    throw new Error('ChurchTools hat das Protokoll nicht vollständig übernommen.');
  return { stand, f2 };
}

/** Schritt 4: alte Teile weg – scheitert das, räumt das nächste Speichern sie mit auf (der Kopf zeigt schon auf die neuen). */
async function alteTeileWeg(ort: ProtokollOrt, f3: Frisch, stand: string): Promise<void> {
  for (const t of f3.teile)
    if (t.teil.stand !== stand) {
      try {
        await wertLoeschen(modulPort, ort.modul, ort.kategorie, t.id, VERWEIGERT);
      } catch (e) {
        console.warn('Protokolle: alter Teil bleibt vorerst liegen', t.id, e);
      }
    }
}

/**
 * **Freigeben** (S6-1) – wie Speichern, nur dass der Kopf danach „frei“ ist (ohne Sperre, mit Vermerk und Verlauf,
 * `freigegebenerKopf`). `dokument` ist schon festgehalten (`festhaltenFuerFreigabe`). Darf nur, wer gerade schreiben
 * darf (`schreibLage`); `vorher` gleicht die To-Dos ab wie beim Speichern. Das Gruppentreffen schließt der Aufrufer
 * danach ab – scheitert das, ist das Protokoll trotzdem frei.
 */
export async function freigeben(
  ort: ProtokollOrt,
  ich: Schreiber,
  basisStand: string,
  dokument: readonly Block[],
  wer: Wer,
  jetzt = new Date(),
  vorher?: () => Promise<void>,
): Promise<SchreibErgebnis> {
  const f = await frisch(ort);
  const nein = abweisung(f, ich, basisStand, jetzt);
  if (nein) return nein;
  if (vorher) await vorher();
  const { stand, f2 } = await teileSichern(ort, f, dokument);
  const nein2 = abweisung(f2, ich, basisStand, jetzt);
  if (nein2) return nein2;
  await kopfSchreiben(ort, f2.kopf!.id, {
    ...freigegebenerKopf(f2.kopf!.inhalt, wer, jetzt.toISOString()),
    stand,
  });
  const f3 = await frisch(ort);
  const k = f3.kopf?.inhalt;
  if (!k) return { art: 'weg' };
  if (k.status !== 'frei' || k.stand !== stand) throw new NichtUebernommen('die Freigabe');
  await alteTeileWeg(ort, f3, stand);
  return { art: 'ok', kopf: k };
}

/**
 * **Freigabe zurücknehmen** (S6-1, nur die Leitung): wieder Entwurf, Verlauf ergänzt, feste Punkte wieder live
 * (`festePunkteLoesen`). Auf dem frisch gelesenen Stand; ist es inzwischen kein freigegebenes mehr, passiert nichts.
 */
export async function freigabeZuruecknehmen(
  ort: ProtokollOrt,
  wer: Wer,
  jetzt = new Date(),
): Promise<{ art: 'ok'; kopf: ProtokollKopf } | { art: 'weg' } | { art: 'nichtFrei' }> {
  const f = await frisch(ort);
  if (!f.kopf) return { art: 'weg' };
  if (f.kopf.inhalt.status !== 'frei') return { art: 'nichtFrei' };
  const dokument = dokumentDerSitzung(
    f.kopf.inhalt,
    f.teile.map((t) => t.teil),
  );
  if (!dokument) throw new Error('Das Protokoll ist gerade nicht vollständig lesbar.');
  const { stand, f2 } = await teileSichern(ort, f, festePunkteLoesen(dokument));
  if (!f2.kopf) return { art: 'weg' };
  await kopfSchreiben(ort, f2.kopf.id, {
    ...zurueckgenommenerKopf(f2.kopf.inhalt, wer, jetzt.toISOString()),
    stand,
  });
  const f3 = await frisch(ort);
  const k = f3.kopf?.inhalt;
  if (!k) return { art: 'weg' };
  if (k.status !== 'entwurf' || k.stand !== stand)
    throw new NichtUebernommen('das Zurücknehmen der Freigabe');
  await alteTeileWeg(ort, f3, stand);
  return { art: 'ok', kopf: k };
}

/** **Sperre freigeben** (Editor schließen) – nur die eigene. `true`, wenn danach niemand mehr gesperrt ist. */
export async function sperreFreigeben(
  ort: ProtokollOrt,
  ich: Schreiber,
  jetzt = new Date(),
): Promise<boolean> {
  const f = await frisch(ort);
  if (!f.kopf || sperreLage(f.kopf.inhalt.sperre, ich, jetzt) !== 'meine') return false;
  await kopfSchreiben(ort, f.kopf.id, { ...f.kopf.inhalt, sperre: null });
  const danach = await frisch(ort);
  return danach.kopf?.inhalt.sperre === null;
}

/**
 * **Gruppentreffen verknüpfen** (S5-3, „Gruppentreffen anlegen“ im festen Punkt „Anwesenheit“): die ID in den Kopf –
 * auf dem frisch gelesenen, Sperre, Stand und Dokument bleiben – und nachlesen. Speichert der Editor gleichzeitig, liest
 * er den Kopf ebenfalls frisch und behält das Treffen.
 */
export async function treffenVerknuepfen(ort: ProtokollOrt, treffen: number): Promise<void> {
  const f = await frisch(ort);
  if (!f.kopf) throw new Error('Das Protokoll ist gerade nicht lesbar.');
  if (f.kopf.inhalt.treffen === treffen) return;
  await kopfSchreiben(ort, f.kopf.id, { ...f.kopf.inhalt, treffen });
  const f2 = await frisch(ort);
  if (f2.kopf?.inhalt.treffen !== treffen)
    throw new NichtUebernommen('das Gruppentreffen am Protokoll');
}
