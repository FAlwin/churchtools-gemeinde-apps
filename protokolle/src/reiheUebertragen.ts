/**
 * **Die Reihe in die Infos der Events übertragen** – der Ablauf hinter dem Fenster „In Events übertragen“.
 *
 * - `ladeEventLagen`: jedes zugeordnete Event **frisch** lesen (`GET /events/{id}`), **nacheinander** (429-Lehre: nie ein
 *   Schwung gleichzeitig), und daraus die Infos und das Recht (`darfTerminAendern`: Kalender mit „edit events“ aus
 *   `/permissions/global`, Admins des Events aus der frischen Antwort) ableiten. Ein Event, das sich nicht lesen lässt, ist
 *   „nicht gelesen“ – nie „aktuell“ (vorübergehend ist nicht ungültig).
 * - `uebertragen`: schreibt **nacheinander** über `infosSpeichern` (frisch lesen, Absage mitschicken, nachlesen, Konflikt).
 *   Ein Konflikt, ein 403 oder ein Fehler bei einem Event bricht die anderen **nicht** ab. Wirft nie.
 */
import { ablaufTerminVon } from '@shared/ct/ablaufRecht';
import { infosAus, darfTerminAendern, type InfosErgebnis } from '@shared/ct/terminInfos';
import type { EventLage, Themenreihe } from '@shared/protokolle/themenreihe';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { FrischesEvent } from '@ui/ct/terminInfosPort';

/** Die Anschlüsse – im Browser `leseEvent` und `speichereInfos` (`ui/ct/terminInfosPort.ts`). */
export interface UebertragenPort {
  /** `GET /events/{id}` – frisch. */
  event(eventId: number): Promise<FrischesEvent>;
  /** `infosSpeichern`: `gesehen` = der beim Öffnen gelesene Text. */
  speichern(eventId: number, neu: string, gesehen: string): Promise<InfosErgebnis>;
}

/** Was das Fenster je Event weiß. */
export interface EventZustand {
  lage: EventLage | null;
  /** Name und Beginn aus der frischen Antwort – für die Überschrift im Fenster. */
  name: string;
  startDate: string;
  /** Warum es nicht gelesen werden konnte (Meldung für das Etikett). */
  fehler?: string;
}

/** Die Rechte des Nutzers an Events – `kalender` = Kalender-IDs mit „edit events“ (`eventKalender`), `ich` = Person-ID. */
export interface EventRechte {
  kalender: readonly number[];
  ich: number | null;
}

/** Jedes Event der Reihe frisch lesen, nacheinander. Wirft nie. */
export async function ladeEventLagen(
  port: Pick<UebertragenPort, 'event'>,
  reihe: Pick<Themenreihe, 'zeilen'>,
  rechte: EventRechte,
): Promise<Map<number, EventZustand>> {
  const ids = [
    ...new Set(reihe.zeilen.map((z) => z.eventId).filter((e): e is number => e !== null)),
  ];
  const aus = new Map<number, EventZustand>();
  for (const id of ids) {
    try {
      const ev = await port.event(id);
      aus.set(id, {
        lage: {
          text: infosAus(ev),
          darf: darfTerminAendern(
            { isAdmin: false, terminKalender: rechte.kalender },
            ablaufTerminVon(ev),
            rechte.ich,
          ),
        },
        name: typeof ev.name === 'string' ? ev.name : '',
        startDate: typeof ev.startDate === 'string' ? ev.startDate : '',
      });
    } catch (e) {
      aus.set(id, { lage: null, name: '', startDate: '', fehler: fehlerMeldung(e).text });
    }
  }
  return aus;
}

export interface Auftrag {
  eventId: number;
  /** Der ganze neue Text der Infos. */
  neuerText: string;
  /** Der Text, wie das Fenster ihn beim Öffnen frisch las. */
  gesehen: string;
}

export type Ergebnis =
  | { art: 'ok' }
  /** Die Infos wurden inzwischen woanders geändert – nichts geschrieben, Fenster neu öffnen. */
  | { art: 'konflikt' }
  /** ChurchTools lehnt ab (403). */
  | { art: 'verweigert' }
  /** ChurchTools hat geantwortet, aber den Text nicht übernommen. */
  | { art: 'nichtUebernommen'; meldung: string }
  /** Netz, 502/504, gebremst … – nicht übertragen, bitte noch einmal. */
  | { art: 'fehler'; meldung: string };

/** Nacheinander schreiben; je Event ein Ergebnis. Wirft nie – ein Fehler bei einem Event lässt die anderen laufen. */
export async function uebertragen(
  port: Pick<UebertragenPort, 'speichern'>,
  auftraege: readonly Auftrag[],
  fortschritt?: (eventId: number, ergebnis: Ergebnis) => void,
): Promise<Map<number, Ergebnis>> {
  const aus = new Map<number, Ergebnis>();
  for (const a of auftraege) {
    let e: Ergebnis;
    try {
      const r = await port.speichern(a.eventId, a.neuerText, a.gesehen);
      e = r.ok ? { art: 'ok' } : { art: 'konflikt' };
    } catch (err) {
      e =
        err instanceof NichtUebernommen
          ? { art: 'nichtUebernommen', meldung: err.message }
          : err instanceof ApiError && err.status === 403
            ? { art: 'verweigert' }
            : { art: 'fehler', meldung: fehlerMeldung(err).text };
    }
    aus.set(a.eventId, e);
    fortschritt?.(a.eventId, e);
  }
  return aus;
}
