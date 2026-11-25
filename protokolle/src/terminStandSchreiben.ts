/**
 * **Den Stand eines Termin-Bausteins schreiben** (W14) – in „Mitarbeit“ der Gruppe, derselbe Weg wie bei To-Dos und
 * Vorschlägen: frisch lesen, Regel auf den gelesenen Stand anwenden, schreiben, **nachlesen** (ein `201` ist kein Beleg),
 * jeder Fehler wird geworfen. Die Regeln stehen in `@shared/protokolle/terminStand`.
 *
 * **Vorübergehend ist nicht ungültig:** Scheitert das Schreiben (Netz, 5xx), ändert sich nichts – der Baustein bleibt
 * „noch nicht im Kalender“, nie fälschlich „im Kalender“ oder „nicht eintragen“. Der Aufrufer meldet den Fehler.
 */
import { wertAendern } from '@shared/ct/modulDaten';
import {
  istTerminStand,
  neuerTerminStand,
  terminStandNach,
  wennNochOffen,
  type TerminStand,
  type TerminZiel,
} from '@shared/protokolle/terminStand';
import { NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { mitarbeitRoh, wertNachgelesen, type MitarbeitOrt } from './mitarbeitWerte';

const TEXTE = {
  verweigert: 'Du darfst in dieser Gruppe nichts speichern.',
  nichtUebernommen: 'ChurchTools hat den Vermerk nicht übernommen.',
};

/** Der Termin steht in ChurchTools – dieser Vermerk gilt immer (auch über ein „Nicht eintragen“ hinweg). */
export function terminVermerken(
  ort: MitarbeitOrt,
  ziel: TerminZiel,
  kalender: NonNullable<TerminStand['kalender']>,
  ich: number,
  am: string,
): Promise<TerminStand> {
  const neu = neuerTerminStand(ziel, 'imKalender', kalender, ich, am);
  return wertNachgelesen(
    ort,
    istTerminStand,
    neu.id,
    () => neu,
    () => neu,
    TEXTE,
  );
}

/** „Nicht eintragen“ (`nichtEintragen`) bzw. „Wieder anzeigen“ (`offen`) – ein Eintrag im Kalender bleibt, wie er ist. */
export function terminMarkieren(
  ort: MitarbeitOrt,
  ziel: TerminZiel,
  stand: 'nichtEintragen' | 'offen',
  ich: number,
  am: string,
): Promise<TerminStand> {
  const neu = neuerTerminStand(ziel, stand, null, ich, am);
  return wertNachgelesen(
    ort,
    istTerminStand,
    neu.id,
    (alt) => wennNochOffen(alt, neu),
    () => neu,
    TEXTE,
  );
}

/**
 * **Die Stände einer Sitzung zum Protokoll passend machen** (`terminStandNach`) – nie hart löschen: In „Mitarbeit“ darf
 * niemand Werte löschen (S0). `bloecke` = die Termin-Bausteine im Dokument, `null` = das Protokoll ist gelöscht (W6).
 * Erfasst **jeden** Wert mit dieser Sitzung, auch einen doppelten aus einem abgebrochenen Anlegen (den `derArt` sonst
 * verdeckt), gefunden am Feld `sitzung` – nicht an den Bausteinen im Dokument, die beim zweiten Versuch schon weg sein
 * können. Ist etwas zu schreiben, wird danach **nachgelesen**: Passt noch einer nicht, wird geworfen. Ist nichts zu
 * schreiben, bleibt es bei einem Lesen (das Speichern läuft alle paar Sekunden).
 *
 * **Vorübergehend ist nicht ungültig:** Geändert wird nur der Vermerk, nie `stand` oder `kalender` – ein halb
 * geschriebener Abgleich zerstört nichts, das nächste Speichern rechnet ihn neu.
 */
export async function termineAbgleichen(
  ort: MitarbeitOrt,
  sitzung: string,
  bloecke: ReadonlySet<string> | null,
  ich: number,
  am: string,
): Promise<void> {
  const zuAendern = (roh: readonly { wert: number; x: unknown }[]) =>
    roh.flatMap((r) => {
      if (!istTerminStand(r.x) || r.x.sitzung !== sitzung) return [];
      const neu = terminStandNach(r.x, bloecke, ich, am);
      return neu === r.x ? [] : [{ wert: r.wert, neu }];
    });
  const plan = zuAendern(await mitarbeitRoh(ort));
  if (!plan.length) return;
  for (const r of plan)
    await wertAendern(
      modulPort,
      ort.modul,
      ort.kategorie,
      r.wert,
      JSON.stringify(r.neu),
      TEXTE.verweigert,
    );
  if (zuAendern(await mitarbeitRoh(ort)).length)
    throw new NichtUebernommen('den Vermerk an den Terminen dieses Protokolls');
}

/**
 * **Die Stände einer gelöschten Sitzung als gelöscht vermerken** (W6, Schritt „termine“ in `protokollLoeschen`) – der
 * Abgleich mit „kein Protokoll mehr“. Schon vermerkte bleiben unberührt.
 */
export function termineAlsGeloescht(
  ort: MitarbeitOrt,
  sitzung: string,
  ich: number,
  am: string,
): Promise<void> {
  return termineAbgleichen(ort, sitzung, null, ich, am);
}
