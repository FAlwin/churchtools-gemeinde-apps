/**
 * **Events für die Abende einer Reihe in ChurchTools anlegen** (Baustein „Reihe“, Scheibe 3). Je Abend ein Kalendertermin mit
 * einem Event – über die vorhandene Technik des Reiters „Termine“ (`terminLegen`, hier ohne Einladung, Ressourcen, Anmeldung
 * und Bild); die Regeln und Texte stehen in `shared/protokolle/reiheEventAnlegen.ts`.
 *
 * **Nacheinander, nie parallel** (429-Lehre): ein Abend ist fertig, bevor der nächste anfängt. **Je Abend:**
 *
 * 1. Steht im gewählten Kalender an dem Tag schon ein ähnlicher Termin (`schonImKalender`)? Dann wird **nichts** angelegt.
 *    Scheitert schon diese Prüfung, wird für den Abend ebenfalls nichts angelegt (vorübergehend ist nicht „nichts da“).
 * 2. Termin mit Event anlegen (`terminLegen`). Eine unklare Antwort (`Unklar`) heißt: **nie ein zweites `POST`** für diesen
 *    Abend – es wird gemeldet.
 * 3. **Das Event nachlesen** (`eventZumTerminLesen`): Erst wenn es in der Hand ist, trägt die Zeile es. Ein `201` ist kein
 *    Beleg (Lehre 11.08.2026) – nicht gefunden oder nicht lesbar heißt „Termin steht, Zeile bleibt ohne Event“.
 *
 * Ein Fehler an einem Abend bricht die anderen nicht ab. Die Funktion wirft nie.
 */
import { Unklar } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { eventsFuer } from '@shared/protokolle/terminEvents';
import {
  reiheEintrag,
  type EventAnlegenEingabe,
  type TagErgebnis,
} from '@shared/protokolle/reiheEventAnlegen';
import { eventZumTerminLesen } from './eventsLesen';
import { schonImKalender, terminLegen } from './terminEintragen';

export async function reiheEventsAnlegen(q: {
  /** Die Abende: Zeile der Reihe und ihr Datum. */
  abende: readonly { id: string; tag: string }[];
  eingabe: EventAnlegenEingabe & { kalender: number };
  /** Der Name des Kalenders – für „steht schon da“. */
  kalenderName: string;
  zeitzone: string;
  /** Vor jedem Abend: der wievielte (ab 1) – für „Legt Event 2 von 3 an …“. */
  onAbend?: (nr: number) => void;
}): Promise<TagErgebnis[]> {
  const aus: TagErgebnis[] = [];
  for (const [i, a] of q.abende.entries()) {
    q.onAbend?.(i + 1);
    aus.push(await ein(a, q));
  }
  return aus;
}

async function ein(
  a: { id: string; tag: string },
  q: Parameters<typeof reiheEventsAnlegen>[0],
): Promise<TagErgebnis> {
  const eintrag = { ...reiheEintrag(q.eingabe, a.tag), kalender: q.eingabe.kalender };
  const bezug = { id: a.id, tag: a.tag };
  try {
    const da = await schonImKalender(eintrag);
    if (da) return { ...bezug, art: 'schonDa', titel: da.titel, kalender: q.kalenderName };
  } catch (e) {
    return { ...bezug, art: 'fehler', text: fehlerMeldung(e).text };
  }
  let r: Awaited<ReturnType<typeof terminLegen>>;
  try {
    r = await terminLegen({ eintrag, zeitzone: q.zeitzone });
  } catch (e) {
    if (e instanceof Unklar) return { ...bezug, art: 'unklar', text: e.message };
    return { ...bezug, art: 'fehler', text: fehlerMeldung(e).text };
  }
  // Das Nachlesen in `terminLegen` sagt nur „fehlt“/„unklar“ – die Nummer des Events braucht die Zeile.
  if (r.events && (r.events.fehlend.length || r.events.unklar))
    return { ...bezug, art: 'ohneEvent' };
  try {
    const gewollt = eventsFuer(eintrag, q.zeitzone)[0];
    const event = await eventZumTerminLesen({
      termin: r.id,
      tag: a.tag,
      startDate: gewollt.startDate,
      zeitzone: q.zeitzone,
    });
    return event ? { ...bezug, art: 'angelegt', event } : { ...bezug, art: 'ohneEvent' };
  } catch {
    return { ...bezug, art: 'ohneEvent' };
  }
}
