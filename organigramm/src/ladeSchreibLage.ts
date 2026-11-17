/**
 * **Was vor dem Schreiben frisch gelesen wird** (Bauplan O9-5d) und der Anschluss des Schreibens an die echten Leser:
 * die gespeicherte Einrichtung (mit Version), der Gruppentyp, der Stand in ChurchTools zur bisherigen Einrichtung, die
 * Regeln der Stufen, die Wechseljahre aus dem Ferienkalender und alle Gruppen samt Obergruppen.
 *
 * **Alles frisch, bei jedem Lauf** – auch bei „Nochmal versuchen“: Der zweite Versuch rechnet den Plan aus dem neu
 * gelesenen Stand und schreibt nur, was fehlt. Nur `ladeGruppenbaum` wirft; alles andere kommt als „nicht gelesen“ zurück
 * (vorübergehend ist nicht ungültig), der Lauf hört dann auf, bevor etwas geschrieben ist.
 */
import { heuteImKalender } from '@shared/ct/zeit';
import { kuenftigeWechseljahre } from '@shared/organigramm/einrichtungVorschau';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';
import { ladeFerien } from './ladeKinderJugend';
import { ladeEinrichtungVersioniert, speichereEinrichtung } from './gruppenwechselSpeicher';
import {
  schreibeEinrichtung,
  ctPort,
  type Eingabe,
  type Lage,
  type Lauf,
  type SchrittErgebnis,
  type Soll,
} from './einrichtenSchreiben';
import { ladeGruppenbaum } from './start';

export async function ladeSchreibLage(e: Eingabe, heute = heuteImKalender()): Promise<Lage> {
  const gespeichert = await ladeEinrichtungVersioniert();
  const alt = gespeichert.art === 'da' ? gespeichert.einrichtung : null;
  // Nachtragen und Rechte schreiben für die gespeicherte Einrichtung, Einrichten und Ändern für das Formular.
  const soll: Soll | null = e.art === 'nachtragen' || e.art === 'rechte' ? alt : e.soll;
  if (!soll)
    return {
      gespeichert,
      soll: null,
      typ: { ok: false },
      stand: null,
      regeln: new Map(),
      jahre: null,
      gruppen: null,
    };
  const [typ, ferien, gruppen, regeln, stand] = await Promise.all([
    ladeTypVorhanden(),
    ladeFerien(soll.einstellung, heute),
    ladeGruppenbaum().then(
      (g) => g,
      () => null,
    ),
    ladeRegelnDerStufen(soll.einstellung.stufen.map((s) => s.gruppeId)),
    alt ? ladeEinrichtungStand(alt) : Promise.resolve(null),
  ]);
  return {
    gespeichert,
    soll,
    typ,
    stand,
    regeln,
    jahre: ferien.art === 'da' ? kuenftigeWechseljahre(ferien.jahre, heute) : null,
    gruppen,
  };
}

/** Das Schreiben mit den echten Lesern und dem echten Anschluss – das ruft das Fenster. */
export function einrichtenAusfuehren(
  e: Eingabe,
  fortschritt?: (ergebnisse: readonly SchrittErgebnis[]) => void,
): Promise<Lauf> {
  return schreibeEinrichtung(e, {
    lage: () => ladeSchreibLage(e),
    port: ctPort,
    speichern: speichereEinrichtung,
    fortschritt,
  });
}
