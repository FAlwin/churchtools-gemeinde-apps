/**
 * **To-Dos in „Mitarbeit“ lesen und schreiben** (Bauplan Protokolle S4-2) – ein Wert je To-Do, damit Abhaken das
 * Protokoll nicht berührt (Bauplan 3.3). Die Regeln stehen in `@shared/protokolle/aufgaben` (`aufgabenAbgleich`,
 * `statusSetzen` …); hier wird nur bei ChurchTools gelesen und geschrieben.
 *
 * Wie beim Protokoll: vorher frisch lesen, nachher nachlesen (ein `201` ist kein Beleg); jeder Fehler wird geworfen.
 * Gelöscht wird nie hart – auch nicht hier (S0: wer in „Mitarbeit“ ändern darf, dürfte jeden Wert löschen).
 */
import { werteLesen, wertAendern, wertAnlegen } from '@shared/ct/modulDaten';
import { istAufgabe, type Aufgabe, type AufgabenPlan } from '@shared/protokolle/aufgaben';
import { wertInhalt } from '@shared/protokolle/speicher';
import { modulPort } from '@ui/ct/modulPort';

/** Wo die To-Dos einer Gruppe liegen. */
export interface MitarbeitOrt {
  modul: number;
  /** Kategorie „Mitarbeit“ der Gruppe. */
  kategorie: number;
}

const VERWEIGERT = 'Du darfst die To-Dos dieser Gruppe nicht ändern.';

/**
 * **Alle To-Dos der Kategorie** mit der ID ihres Werts – auch die als gelöscht vermerkten (der Abgleich braucht sie für
 * „wiederhergestellt“). Trägt dieselbe To-Do-ID zweimal (etwa nach einem abgebrochenen Anlegen), gilt der Wert mit der
 * kleinsten ID – wie bei Kategorien. Die eine Stelle zum Lesen der To-Dos (auch `ladeAufgaben`).
 */
export async function aufgabenWerte(
  ort: MitarbeitOrt,
): Promise<{ wert: number; aufgabe: Aufgabe }[]> {
  const je = new Map<string, { wert: number; aufgabe: Aufgabe }>();
  for (const w of [...(await werteLesen(modulPort, ort.modul, ort.kategorie))].sort(
    (a, b) => a.id - b.id,
  )) {
    const x = wertInhalt(w);
    if (istAufgabe(x) && !je.has(x.id)) je.set(x.id, { wert: w.id, aufgabe: x });
  }
  return [...je.values()];
}

/** Stimmt der gelesene Stand mit dem geschriebenen überein? (Verlauf und Felder, nicht die Reihenfolge der Schlüssel.) */
const gleich = (a: Aufgabe | undefined, b: Aufgabe): boolean =>
  !!a && JSON.stringify(a) === JSON.stringify(b);

/**
 * **Den Abgleich ausführen** (`aufgabenAbgleich`): frisch lesen, `planen` auf **diesem** Stand rechnen lassen, neue
 * To-Dos anlegen, geänderte schreiben, nachlesen. Geplant wird erst nach dem Lesen – hat ein Mitglied inzwischen
 * abgehakt, bleibt sein Status erhalten, wenn hier nur der Text mitzieht. Liefert die To-Dos danach. Fehlt etwas, wird
 * geworfen – das Protokoll wird dann nicht umgestellt, das nächste Speichern versucht es erneut.
 */
export async function aufgabenSchreiben(
  ort: MitarbeitOrt,
  planen: (vorhanden: Aufgabe[]) => AufgabenPlan,
): Promise<Aufgabe[]> {
  const vorher = await aufgabenWerte(ort);
  const plan = planen(vorher.map((x) => x.aufgabe));
  if (!plan.anlegen.length && !plan.aendern.length) return vorher.map((x) => x.aufgabe);
  const wertVon = new Map(vorher.map((x) => [x.aufgabe.id, x.wert]));
  for (const a of plan.anlegen)
    if (!wertVon.has(a.id))
      await wertAnlegen(modulPort, ort.modul, ort.kategorie, JSON.stringify(a), VERWEIGERT);
  for (const a of plan.aendern) {
    const wert = wertVon.get(a.id);
    if (wert === undefined)
      throw new Error('Ein To-Do ist inzwischen verschwunden – bitte neu laden.');
    await wertAendern(modulPort, ort.modul, ort.kategorie, wert, JSON.stringify(a), VERWEIGERT);
  }
  const danach = await aufgabenWerte(ort);
  const je = new Map(danach.map((x) => [x.aufgabe.id, x.aufgabe]));
  for (const a of plan.anlegen)
    if (!je.has(a.id)) throw new Error('ChurchTools hat ein neues To-Do nicht übernommen.');
  for (const a of plan.aendern)
    if (!gleich(je.get(a.id), a)) throw new Error('ChurchTools hat ein To-Do nicht übernommen.');
  return danach.map((x) => x.aufgabe);
}

/**
 * **Ein To-Do ändern** (Wer, Bis, Status am Aufgaben-Block): frisch lesen, `aendern` auf den aktuellen Stand anwenden,
 * schreiben, nachlesen. Gibt es das To-Do noch nicht (die Aufgabe ist noch nicht gespeichert), entsteht es aus
 * `anlegen()`. Liefert den gespeicherten Stand.
 */
export async function aufgabeAendern(
  ort: MitarbeitOrt,
  id: string,
  aendern: (a: Aufgabe) => Aufgabe,
  anlegen: () => Aufgabe,
): Promise<Aufgabe> {
  const da = (await aufgabenWerte(ort)).find((x) => x.aufgabe.id === id);
  const neu = aendern(da?.aufgabe ?? anlegen());
  if (da)
    await wertAendern(
      modulPort,
      ort.modul,
      ort.kategorie,
      da.wert,
      JSON.stringify(neu),
      VERWEIGERT,
    );
  else await wertAnlegen(modulPort, ort.modul, ort.kategorie, JSON.stringify(neu), VERWEIGERT);
  const nachgelesen = (await aufgabenWerte(ort)).find((x) => x.aufgabe.id === id)?.aufgabe;
  if (!gleich(nachgelesen, neu)) throw new Error('ChurchTools hat das To-Do nicht übernommen.');
  return neu;
}
