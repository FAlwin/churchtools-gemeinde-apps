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
 * **Besprechungsanfragen** (W15-4): Mit `eingeladen` geht `meetingrequests` mit – ChurchTools mailt jeder anderen Person sofort.
 * Auch hier sagt ein `201` nichts: `anfragenNachlesen` liest die Anfragen des neuen Termins, das Ergebnis steht in
 * `anfragen` (gleiche Form wie `buchungen`) und bricht nichts ab. Eine unklare Antwort beim Anlegen bleibt `Unklar`
 * (`terminAnlegen`) – nie ein zweites `POST`, sonst gingen die Mails doppelt raus.
 *
 * **Anmeldung** (W15-5): Mit `eintrag.anmeldung` (Schalter an, Gruppentyp gewählt) legt ChurchTools **sofort echte Gruppen** an –
 * je Einzeltermin bis „heute + Tage im Voraus“ (`anmeldungTermine`, dieselbe Rechnung wie Vorschau und Fuß). Auch hier sagt
 * ein `201` nichts: `anmeldungNachlesen` prüft `signup` am gelesenen Termin und liest die Gruppen des Typs; das Ergebnis steht
 * in `anmeldung`, bricht nichts ab, und es wird **nie gelöscht**.
 *
 * **Bild** (Feld „Bild“): Nach dem Anlegen lädt `bildHochladen` die Datei hoch und liest den Termin neu (`appointment.image`);
 * das Ergebnis steht in `bild` (`fehlt`/`unklar`) und bricht nichts ab. Bei „Nur verknüpfen“ gibt es keinen Upload.
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
import { anmeldungTermine, type AnmeldungErgebnis } from '@shared/protokolle/terminAnmeldung';
import { plusTage } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { Unklar } from '@ui/ct/fehler';
import { anfragenNachlesen } from './besprechungsanfragen';
import { anmeldungNachlesen } from './anmeldungLesen';
import { buchungenNachlesen } from './buchungenLesen';
import { bildHochladen } from './bildHochladen';
import { eventsNachlesen } from './eventsLesen';
import {
  kalenderTermineAmTag,
  terminAnlegen,
  UNKLAR,
  UNKLAR_OHNE_EINLADUNG,
} from './terminAnlegen';
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
  /**
   * **Besprechungsanfragen** (W15-4): Personen-IDs, die ChurchTools beim Anlegen einlädt – **jede andere Person bekommt sofort
   * eine Mail**. Leer oder fehlend: keine Einladung. Bei „Nur verknüpfen“ geht nichts raus (kein Anlegen).
   */
  eingeladen?: readonly number[];
  /** Das Bild des Termins – wird nach dem Anlegen hochgeladen. Bei „Nur verknüpfen“ ohne Wirkung. */
  bild?: File | null;
}): Promise<{
  art: 'angelegt' | 'verknuepft';
  id: number;
  /** Nur nach dem Anlegen mit Buchungen: was das Nachlesen ergab (`fehlend` = nicht gebucht, `unklar` = nicht lesbar). */
  buchungen?: { fehlend: number[]; unklar: boolean };
  /** Nur nach dem Anlegen mit Events: `fehlend` = die Tage ohne Event, `unklar` = nicht lesbar. */
  events?: { fehlend: string[]; unklar: boolean };
  /** Nur nach dem Anlegen mit Besprechungsanfragen: `fehlend` = Personen ohne Anfrage, `unklar` = nicht lesbar. */
  anfragen?: { fehlend: number[]; unklar: boolean };
  /** Nur nach dem Anlegen mit Anmeldung: `signupFehlt`, `fehlend` = Namen der Gruppen, die nicht da sind, `unklar` = nicht lesbar. */
  anmeldung?: AnmeldungErgebnis;
  /** Nur nach dem Anlegen mit Bild: `fehlt` = nach dem Hochladen kein Bild am Termin, `unklar` = nicht lesbar. */
  bild?: { fehlt: boolean; unklar: boolean };
}> {
  if (q.verknuepfen) return { art: 'verknuepft', id: q.verknuepfen.id };
  const e = q.eintrag;
  const titel = e.titel.trim();
  const z = eintragZeitraum(e, q.zeitzone);
  const events = eventsFuer(e, q.zeitzone);
  const eingeladen = q.eingeladen ?? [];
  // Die Gruppen, die ChurchTools jetzt anlegt – VOR dem Anlegen gerechnet (derselbe „heute“ wie beim Absenden).
  const gruppenErwartet = anmeldungTermine(e, e.anmeldung, heuteImKalender(new Date(), q.zeitzone));
  const id = await terminAnlegen({
    kalender: e.kalender,
    titel,
    beginn: z.beginn,
    ende: z.ende,
    zeitzone: q.zeitzone,
    ganztaegig: e.ganztaegig,
    ...eintragZusatz(e, q.neueTagsErlaubt === true),
    events,
    ...(eingeladen.length ? { eingeladen } : {}),
    // Mit Einladungen sagt die Meldung, dass ein zweiter Versuch alle doppelt einlädt.
    unklar: eingeladen.length ? UNKLAR : UNKLAR_OHNE_EINLADUNG,
  });
  let signup: unknown;
  try {
    const roh = await terminLaden({ kalender: e.kalender, id });
    signup = roh.signup;
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
  const anfragen = eingeladen.length
    ? await anfragenNachlesen({ termin: { kalender: e.kalender, id }, gewuenscht: eingeladen })
    : undefined;
  const anmeldung =
    e.anmeldung && e.anmeldung.typ !== null
      ? await anmeldungNachlesen({
          signup,
          typ: e.anmeldung.typ,
          titel,
          erwartet: gruppenErwartet,
        })
      : undefined;
  const bild = q.bild
    ? await bildHochladen({ kalender: e.kalender, termin: id, bild: q.bild })
    : undefined;
  return {
    art: 'angelegt',
    id,
    ...(bild ? { bild } : {}),
    ...(buchungen ? { buchungen } : {}),
    ...(eventsErgebnis ? { events: eventsErgebnis } : {}),
    ...(anfragen ? { anfragen } : {}),
    ...(anmeldung ? { anmeldung } : {}),
  };
}
