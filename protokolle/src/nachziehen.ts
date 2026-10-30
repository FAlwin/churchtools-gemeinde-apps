/**
 * **Text, Löschen oder Gruppe eines To-Dos im Protokoll-Entwurf nachziehen** (Bauplan S7-2b, entschieden 30.10.2026) –
 * aus dem Fenster „To-Do“, ohne den Editor. Kein eigener Schreibweg: Es sind die Schritte des Editors.
 *
 * 1. frisch lesen – noch Entwurf, steht die Aufgabe noch drin? Sonst `kein-entwurf` (dann gilt S7-2a: nur das To-Do);
 * 2. **Sperre nehmen** (`sperreNehmen`) – schreibt jemand anderes, wird **nichts** gespeichert (`gesperrt`);
 * 3. `zuvor` (Gruppe wechseln: erst in der neuen Gruppe anlegen – doppelt statt nirgends, wie S7-2a);
 * 4. Dokument per reiner Regel ändern (`aufgabeNachziehen`) und **normal speichern** – mit dem normalen Abgleich davor,
 *    der Text bzw. „gelöscht“ ins To-Do zieht (dieselbe Regel wie im Editor, `aufgabenAbgleich`);
 * 5. **Sperre freigeben** – immer, auch nach einem Fehler (sonst stünde sie bis zu 10 Minuten).
 *
 * Vorübergehende Fehler werden geworfen: Das Fenster bleibt offen, ein zweiter Versuch geht (das Anlegen in der neuen
 * Gruppe ist wiederholbar, `toDoVerschieben`).
 */
import { aufgabenAbgleich } from '@shared/protokolle/aufgaben';
import { ableiten } from '@shared/protokolle/dokument';
import { aufgabeNachziehen, type Nachziehen } from '@shared/protokolle/nachziehen';
import type { Schreiber, Sperre } from '@shared/protokolle/speicher';
import { ApiError } from '@ui/ct/fehler';
import { aufgabenSchreiben, type MitarbeitOrt } from './aufgabenSchreiben';
import {
  protokollLesen,
  speichern,
  sperreFreigeben,
  sperreNehmen,
  type ProtokollOrt,
} from './schreiben';

export type NachziehErgebnis =
  | { art: 'ok'; hinweis: string | null }
  /** Inzwischen freigegeben, weg oder die Aufgabe steht nicht mehr drin – dann nur das To-Do (S7-2a). */
  | { art: 'kein-entwurf' }
  /** Jemand schreibt gerade – nichts gespeichert. */
  | { art: 'gesperrt'; sperre: Sperre };

// 409 statt einfachem Fehler: `fehlerMeldung` zeigt den Text, statt „ChurchTools antwortet gerade nicht“.
const VERAENDERT = 'Das Protokoll wurde gerade geändert – bitte noch einmal speichern.';
const NOCH_NICHT =
  'Das To-Do steht schon in der anderen Gruppe – im Protokoll ist es noch nicht nachgezogen. Bitte noch einmal speichern.';

export async function imEntwurfNachziehen(q: {
  /** Das Protokoll (Kategorie „Protokolle“ der Gruppe, Sitzung des To-Dos). */
  ort: ProtokollOrt;
  mitarbeit: MitarbeitOrt;
  gruppe: number;
  aufgabe: string;
  n: Nachziehen;
  ich: Schreiber;
  /** Läuft unter der Sperre vor dem Speichern; ein Hinweis von dort kommt mit zurück. */
  zuvor?: () => Promise<string | null>;
  jetzt?: Date;
}): Promise<NachziehErgebnis> {
  const jetzt = q.jetzt ?? new Date();
  const l = await protokollLesen(q.ort);
  // Inzwischen freigegeben? Das weist `sperreNehmen` ab (`fest`) – hier nur: gibt es überhaupt ein Dokument?
  if (!l.kopf || !l.dokument) return { art: 'kein-entwurf' };
  const { dokument, gefunden } = aufgabeNachziehen(l.dokument, q.aufgabe, q.n);
  if (!gefunden) return { art: 'kein-entwurf' };

  const s = await sperreNehmen(q.ort, q.ich, l.kopf.stand, jetzt);
  if (s.art === 'gesperrt') return { art: 'gesperrt', sperre: s.sperre };
  if (s.art === 'weg' || s.art === 'fest') return { art: 'kein-entwurf' };
  if (s.art === 'veraendert') throw new ApiError(409, VERAENDERT);
  try {
    const hinweis = q.zuvor ? await q.zuvor() : null;
    const r = await speichern(q.ort, q.ich, l.kopf.stand, dokument, jetzt, async () => {
      await aufgabenSchreiben(
        q.mitarbeit,
        (vorhanden) =>
          aufgabenAbgleich({
            eintraege: ableiten(dokument).aufgaben,
            vorhanden,
            gruppe: q.gruppe,
            sitzung: q.ort.sitzung,
            von: q.ich.person,
            am: jetzt.toISOString(),
          }),
        q.ich,
      );
    });
    // Hat `zuvor` schon etwas getan (neu in der anderen Gruppe), ist „nichts gespeichert“ nicht mehr wahr – dann sagen,
    // dass ein zweiter Versuch fehlt (er legt nichts doppelt an).
    if (r.art !== 'ok' && q.zuvor) throw new ApiError(409, NOCH_NICHT);
    if (r.art === 'gesperrt') return { art: 'gesperrt', sperre: r.sperre };
    if (r.art !== 'ok') throw new ApiError(409, VERAENDERT);
    return { art: 'ok', hinweis };
  } finally {
    await sperreFreigeben(q.ort, q.ich, jetzt).catch((e: unknown) =>
      console.warn('Protokolle: Sperre nach dem Nachziehen nicht freigegeben', e),
    );
  }
}
