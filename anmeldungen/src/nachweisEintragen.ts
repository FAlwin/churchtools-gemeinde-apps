/**
 * **Eintragen beim Öffnen – die Erweiterungs-Seite** (N3c). Regeln und Ablauf stehen im Kern
 * `@shared/anmeldung/nachweisEintragen`; hier hängen die echten Anschlüsse dran (Verbindung, `mitgliedAnlegen`, Datenspeicher),
 * dazu das, was nur im Browser zählt:
 *
 * - **Einmal je Öffnen und nie doppelt:** ein Versprechen je Seite und – über Tabs hinweg – eine Web-Sperre
 *   (`navigator.locks`, `ifAvailable`). Ist die Sperre belegt, läuft in diesem Tab nichts. Gibt es keine Web-Sperren (alte
 *   Browser), läuft der Lauf trotzdem: Doppelt eintragen richtet keinen Schaden an (403 „schon drin“, keine zweite Mail, M11),
 *   und der Merkzettel wird vor dem Schreiben frisch gelesen und zusammengeführt.
 * - **Admin zieht nach:** Fehlen der Leiter-Rolle Rechte (z. B. das neue „Gruppen eines Gruppentyps sehen“), ergänzt ein
 *   Admin sie beim Öffnen – wie auf der Seite „Nachweise“.
 * - **Danach der Stand** (N3a) für die Arten mit Neuen – aus einer frischen, vollständigen Lesung.
 *
 * Sichtbar ist höchstens eine stille Meldung. Fehler stören die Erweiterung nie (Konsole).
 */
import { ctAlleSeiten, ctDaten, ChurchToolsBremst } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { angemeldeteId } from '@ui/ct/ich';
import { istSchonDrin, mitgliedAnlegen } from '@ui/ct/mitglieder';
import { ctPortMit } from '@ui/ct/ctPort';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { heuteImKalender } from '@shared/ct/zeit';
import { gruppenartRollen } from '@shared/ct/gruppenart';
import {
  nachweiseEintragen,
  type EintragErgebnis,
  type EintragFehler,
  type EintragPort,
} from '@shared/anmeldung/nachweisEintragen';
import { anmeldungsArt, leitungsRollen } from './einrichten';
import { nachweisGrundlageLesen } from './nachweise';
import { adminNachziehen } from './nachweisArten';
import { nachweisPersonenLesen } from './nachweisPersonen';
import { nachweisStandAktualisieren } from './nachweisStandAblage';

const WER = 'Die Erweiterung „Anmeldungen“';
const VERWEIGERT = 'Dir fehlt in ChurchTools das Recht, den Nachweis-Stand zu speichern.';
/** Name der Web-Sperre über alle Tabs dieser Erweiterung. */
export const SPERRE = 'anmeldungen-nachweise-eintragen';

/** Wie ein Fehler aus der Verbindung zählt – die Zweige einzeln (Drosselung, schon drin, kein Recht, sonst vorübergehend). */
export function fehlerArt(e: unknown): EintragFehler {
  if (e instanceof ChurchToolsBremst || (e instanceof ApiError && e.status === 429))
    return 'bremse';
  if (istSchonDrin(e)) return 'schonDrin';
  if (e instanceof ApiError && e.status === 403) return 'keinRecht';
  return 'voruebergehend';
}

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const eintragPort: EintragPort = {
  alleSeiten: (pfad) => ctAlleSeiten(pfad),
  holen: (pfad) => ctDaten(pfad),
  anlegen: (gruppe, person, rolle) =>
    mitgliedAnlegen(gruppe, person, { groupTypeRoleId: rolle, groupMemberStatus: 'active' }),
  fehlerArt,
  warte,
  modul: modulPort,
  modulId: () => modulId(WER),
};

/** Die stille Meldung zum Ergebnis – `null`: nichts zu sagen. */
export function eintragMeldung(r: EintragErgebnis): string | null {
  const n = [...r.neu.values()].reduce((s, l) => s + l.length, 0);
  if (n > 0) return `${n === 1 ? '1 Person' : `${n} Personen`} zum Nachweis angemeldet.`;
  if (r.abbruch === 'ohneRecht' || r.verweigert.length > 0)
    return 'Nachweise: Dir fehlt noch ein Recht zum Eintragen. Es kommt, sobald ein Admin die Erweiterung öffnet.';
  return null;
}

/** Der eigentliche Lauf (ohne Sperre). Wirft bei Fehlern. */
async function lauf(): Promise<string | null> {
  const g = await nachweisGrundlageLesen();
  const typId = g.typId;
  if (typId === null) return null;
  if (g.darfEinrichten && g.rechtFehlt === true) await adminNachziehen();
  const [rollen, anmeldungTyp, ich, leitung] = await Promise.all([
    gruppenartRollen(ctPortMit('Dir fehlt in ChurchTools das Recht dafür.'), typId),
    anmeldungsArt(),
    ctDaten<unknown>('/whoami').then(angemeldeteId),
    leitungsRollen(),
  ]);
  if (anmeldungTyp === null || rollen.leiter === null || rollen.teilnehmer === null) return null;
  const heute = heuteImKalender();
  const r = await nachweiseEintragen(eintragPort, {
    ich,
    admin: g.darfEinrichten,
    heute,
    nachweisTyp: typId,
    leiterRolle: rollen.leiter,
    teilnehmerRolle: rollen.teilnehmer,
    anmeldungTyp,
    leitung,
    verweigert: VERWEIGERT,
  });
  if (r.abbruch && r.abbruch !== 'obergrenze')
    console.warn('Nachweise: Eintragen beim Öffnen beendet –', r.abbruch);
  if (r.verweigert.length) console.warn('Nachweise: Eintragen verweigert in', r.verweigert);
  // Der Stand (N3a) für die Arten mit Neuen – frisch und vollständig gelesen, nie „alt + neu“. Fehler stören nicht.
  const mitNeuen = r.arten.filter((a) => r.neu.has(a.id));
  if (mitNeuen.length) {
    try {
      const arten = [];
      for (const a of mitNeuen)
        arten.push({ ...a, personen: await nachweisPersonenLesen(a, rollen.teilnehmer) });
      await nachweisStandAktualisieren(arten, heute);
    } catch (e) {
      console.warn('Nachweise: Stand nach dem Eintragen nicht geschrieben', e);
    }
  }
  return eintragMeldung(r);
}

let laufend: Promise<string | null> | null = null;

/**
 * **Beim Öffnen der Erweiterung** (einmal je Seite): trägt ein, was fällig ist, und liefert die stille Meldung (oder
 * `null`). Wirft nie.
 */
export function nachweiseBeimOeffnen(): Promise<string | null> {
  laufend ??= (async () => {
    try {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (!locks) return await lauf();
      return await locks.request(SPERRE, { ifAvailable: true }, (sperre) =>
        sperre ? lauf() : null,
      );
    } catch (e) {
      console.warn('Nachweise: Eintragen beim Öffnen fehlgeschlagen', e);
      return null;
    }
  })();
  return laufend;
}

/** Nur für Tests. */
export function _vergissLauf(): void {
  laufend = null;
}
