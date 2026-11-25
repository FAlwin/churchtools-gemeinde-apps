/**
 * **Einen Termin aus dem Protokoll in den ChurchTools-Kalender eintragen** (W14, Reiter „Termine“). Zwei Schritte, jeder
 * für sich wiederholbar, damit ein Fehler im zweiten den ersten nie verdoppelt:
 *
 * 1. `terminLegen` – **in ChurchTools**: den Termin anlegen (der Kern aus `terminAnlegen.ts`, derselbe wie beim Festlegen
 *    einer Sitzung, hier **ohne Einladung**) oder einen vorhandenen nur **verknüpfen**. Nach dem Anlegen wird der Termin
 *    **nachgelesen** (Titel, Beginn): Ein `201` ist kein Beleg (Lehre 11.08.2026). Ist er nicht nachlesbar, steht er
 *    vermutlich da – dann **kein** Vermerk, sondern eine Meldung; beim nächsten Eintragen findet die Prüfung auf
 *    „steht schon da“ ihn und bietet „Nur verknüpfen“ an.
 * 2. `terminVermerken` (`terminStandSchreiben.ts`) – **in unserem Speicher**: „im Kalender: Kalender + Nummer“.
 *    Scheitert das, ist der Termin trotzdem angelegt; das Fenster bietet „Nochmal vermerken“ an (nur dieser Schritt).
 *
 * **Buchungen** (W15-2): Ein `201` sagt nichts darüber, ob ChurchTools die Ressourcen gebucht hat – die Antwort enthält sie
 * nicht. Nach dem Anlegen wird je Ressource nachgelesen (`buchungenNachlesen`); das Ergebnis steht in `buchungen` und
 * bricht **nichts** ab: Der Termin steht, der Vermerk entsteht trotzdem, das Fenster sagt, was nachzubuchen ist.
 *
 * **Events** (W15-3): Genauso wenig sagt ein `201`, dass die Events entstanden sind – nach dem Anlegen liest `eventsNachlesen`
 * `GET /events` und sucht je Zeile ein Event mit diesem Termin und Beginn. Das Ergebnis steht in `events`, bricht nichts ab
 * und hat dieselbe Form wie `buchungen`.
 *
 * Zeitgrenzen und Netzfehler markieren nie etwas als „im Kalender“ oder „nicht eintragen“.
 */
import {
  aehnlicherTermin,
  eintragZeitraum,
  type Eintrag,
  type KalenderTermin,
} from '@shared/protokolle/termine';
import { minute } from '@shared/protokolle/sitzungen';
import { eintragZusatz } from '@shared/protokolle/terminFelder';
import { eventsFuer } from '@shared/protokolle/terminEvents';
import { plusTage } from '@shared/ct/datum';
import { Unklar } from '@ui/ct/fehler';
import { buchungenNachlesen } from './buchungenLesen';
import { eventsNachlesen } from './eventsLesen';
import { kalenderTermineAmTag, terminAnlegen, UNKLAR_OHNE_EINLADUNG } from './terminAnlegen';
import { terminLaden } from './termin';

export const NICHT_NACHGELESEN =
  'Der Termin wurde angelegt, ließ sich aber nicht nachlesen. Bitte im Kalender nachsehen und ihn nicht noch einmal eintragen – beim nächsten Eintragen bietet das Fenster „Nur verknüpfen“ an.';

/**
 * **Steht am Tag im Kalender schon so ein Termin?** Liest die Termine des Kalenders an diesem Tag – wirft bei jedem Fehler
 * (vorübergehend ist nicht „nichts da“: sonst legte der nächste Schritt doppelt an).
 */
export async function schonImKalender(e: Eintrag): Promise<KalenderTermin | null> {
  if (e.kalender === null) return null;
  return aehnlicherTermin(e.titel, await kalenderTermineAmTag(e.kalender, e.tag));
}

/**
 * Den Termin anlegen (oder, mit `verknuepfen`, nur übernehmen) und die Nummer liefern. Ohne `verknuepfen` wird er
 * nach dem Anlegen nachgelesen.
 */
export async function terminLegen(q: {
  eintrag: Eintrag & { kalender: number };
  zeitzone: string;
  verknuepfen?: KalenderTermin | null;
  /** Darf die Person neue Tags anlegen (`admin appointment tags`)? Sonst gehen Tags nur mit Nummer mit. */
  neueTagsErlaubt?: boolean;
}): Promise<{
  art: 'angelegt' | 'verknuepft';
  id: number;
  /** Nur nach dem Anlegen mit Buchungen: was das Nachlesen ergab (`fehlend` = nicht gebucht, `unklar` = nicht lesbar). */
  buchungen?: { fehlend: number[]; unklar: boolean };
  /** Nur nach dem Anlegen mit Events: `fehlend` = die Tage ohne Event, `unklar` = nicht lesbar. */
  events?: { fehlend: string[]; unklar: boolean };
}> {
  if (q.verknuepfen) return { art: 'verknuepft', id: q.verknuepfen.id };
  const e = q.eintrag;
  const titel = e.titel.trim();
  const z = eintragZeitraum(e, q.zeitzone);
  const events = eventsFuer(e, q.zeitzone);
  const id = await terminAnlegen({
    kalender: e.kalender,
    titel,
    beginn: z.beginn,
    ende: z.ende,
    zeitzone: q.zeitzone,
    ganztaegig: e.ganztaegig,
    ...eintragZusatz(e, q.neueTagsErlaubt === true),
    events,
    unklar: UNKLAR_OHNE_EINLADUNG,
  });
  try {
    const roh = await terminLaden({ kalender: e.kalender, id });
    const start = roh.startDate;
    const passt =
      roh.title === titel &&
      typeof start === 'string' &&
      (e.ganztaegig ? start.slice(0, 10) === e.tag : minute(start) === minute(z.beginn));
    if (!passt) throw new Error('anders');
  } catch {
    throw new Unklar(NICHT_NACHGELESEN);
  }
  // Eine Buchung mit Vorlauf/Nachlauf kann über Mitternacht reichen – ein Tag Luft auf beiden Seiten.
  const buchungen = e.buchungen.length
    ? await buchungenNachlesen({
        termin: id,
        ressourcen: e.buchungen.map((b) => b.ressource),
        von: plusTage(e.tag, -1),
        bis: plusTage(e.endTag || e.tag, 1),
      })
    : undefined;
  const eventsErgebnis = events.length
    ? await eventsNachlesen({ termin: id, gewuenscht: events })
    : undefined;
  return {
    art: 'angelegt',
    id,
    ...(buchungen ? { buchungen } : {}),
    ...(eventsErgebnis ? { events: eventsErgebnis } : {}),
  };
}
