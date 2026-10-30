/**
 * **Ein Protokoll beginnen** (Bauplan S5-1) – schreibt den Anfang bei ChurchTools. Die Regeln (Anfangsdokument, Kopf,
 * Zuordnung zur Sitzung) stehen in `@shared/protokolle/beginnen` und `@shared/protokolle/sitzungen`.
 *
 * Wie beim Speichern (`schreiben.ts`): vorher frisch lesen, nachher nachlesen – ein `201` ist kein Beleg. Reihenfolge:
 * Teile → nachlesen → Kopf → nachlesen → To-Dos. Bricht es vor dem Kopf ab, gibt es kein halbes Protokoll (nur Teile ohne
 * Kopf, die niemand anzeigt). Scheitern erst die To-Dos, steht das Protokoll trotzdem – das nächste Speichern im Editor
 * gleicht sie wieder ab; der Aufrufer bekommt einen Hinweis.
 */
import { werteLesen, wertAendern, wertAnlegen } from '@shared/ct/modulDaten';
import { ableiten, type Block } from '@shared/protokolle/dokument';
import { aufgabenAbgleich } from '@shared/protokolle/aufgaben';
import { neuerKopf } from '@shared/protokolle/beginnen';
import { gehoertZu, type Sitzung } from '@shared/protokolle/sitzungen';
import {
  dokumentAusTeilen,
  istKopf,
  sitzungAusWerten,
  teileBauen,
  wertInhalt,
} from '@shared/protokolle/speicher';
import { NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { aufgabenSchreiben, type MitarbeitOrt, type Schreibend } from './aufgabenSchreiben';

const VERWEIGERT = 'Du darfst in dieser Gruppe keine Protokolle anlegen.';

export type BeginnErgebnis =
  /** Begonnen – `hinweis`, wenn die To-Dos der festen Aufgaben (noch) nicht angelegt sind. */
  | { art: 'ok'; sitzung: string; hinweis: string | null }
  /** Inzwischen hat jemand anderes dieses Protokoll begonnen – es wird geöffnet statt ein zweites angelegt. */
  | { art: 'schon'; sitzung: string };

export async function protokollBeginnen(q: {
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  mitarbeit: MitarbeitOrt | null;
  gruppe: number;
  sitzung: Pick<Sitzung, 'titel' | 'beginn' | 'termin' | 'treffen' | 'kopf'>;
  dokument: readonly Block[];
  /** Wer beginnt – Person und Vorname (der Name kommt an die To-Do-Verläufe, `mitNamen`). */
  von: Schreibend;
  neueId?: () => string;
  jetzt?: Date;
}): Promise<BeginnErgebnis> {
  const jetzt = q.jetzt ?? new Date();
  const lesen = () => werteLesen(modulPort, q.modul, q.kategorie);

  // 1. Frisch lesen: Gibt es zu dieser Sitzung schon ein begonnenes Protokoll? Ein geplantes wird begonnen.
  const werte = await lesen();
  const geplant = q.sitzung.kopf?.status === 'geplant' ? q.sitzung.kopf.sitzung : null;
  for (const w of werte) {
    const k = wertInhalt(w);
    if (!istKopf(k)) continue;
    if (geplant !== null && k.sitzung === geplant) {
      if (k.status !== 'geplant') return { art: 'schon', sitzung: k.sitzung };
    } else if (gehoertZu(k, q.sitzung)) return { art: 'schon', sitzung: k.sitzung };
  }
  const sitzung = geplant ?? (q.neueId ?? (() => crypto.randomUUID()))();

  // 2. Teile schreiben und nachlesen.
  const { stand, werte: teile } = teileBauen(q.dokument, sitzung);
  for (const t of teile) await wertAnlegen(modulPort, q.modul, q.kategorie, t, VERWEIGERT);
  const nach1 = sitzungAusWerten(await lesen(), sitzung);
  if (
    !dokumentAusTeilen(
      { sitzung, stand },
      nach1.teile.map((t) => t.teil),
    )
  )
    throw new NichtUebernommen('das Protokoll');

  // 3. Kopf anlegen (oder den geplanten umstellen) und nachlesen.
  if (nach1.kopf) {
    if (nach1.kopf.inhalt.status !== 'geplant') return { art: 'schon', sitzung };
    await wertAendern(
      modulPort,
      q.modul,
      q.kategorie,
      nach1.kopf.id,
      JSON.stringify({ ...nach1.kopf.inhalt, status: 'entwurf', stand }),
      VERWEIGERT,
    );
  } else {
    await wertAnlegen(
      modulPort,
      q.modul,
      q.kategorie,
      JSON.stringify(neuerKopf(q.sitzung, sitzung, stand)),
      VERWEIGERT,
    );
  }
  const kopf = sitzungAusWerten(await lesen(), sitzung).kopf?.inhalt;
  if (!kopf || kopf.status !== 'entwurf' || kopf.stand !== stand)
    throw new NichtUebernommen('das neue Protokoll');

  // 4. Die festen Aufgaben werden To-Dos – wie beim Speichern im Editor (das Protokoll führt).
  if (!q.mitarbeit) return { art: 'ok', sitzung, hinweis: null };
  const eintraege = ableiten(q.dokument).aufgaben;
  if (!eintraege.length) return { art: 'ok', sitzung, hinweis: null };
  try {
    await aufgabenSchreiben(
      q.mitarbeit,
      (vorhanden) =>
        aufgabenAbgleich({
          eintraege,
          vorhanden,
          gruppe: q.gruppe,
          sitzung,
          von: q.von.person,
          am: jetzt.toISOString(),
        }),
      q.von,
    );
    return { art: 'ok', sitzung, hinweis: null };
  } catch {
    // Vorübergehend ist nicht ungültig: Das Protokoll steht; das nächste Speichern gleicht die To-Dos ab.
    return {
      art: 'ok',
      sitzung,
      hinweis:
        'Die festen Aufgaben sind noch keine To-Dos – das wird beim nächsten Speichern im Protokoll nachgeholt.',
    };
  }
}
