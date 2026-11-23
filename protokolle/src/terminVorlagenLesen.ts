/**
 * **Termin-Vorlagen und Tags aus ChurchTools** (W15-1, Fenster „In Kalender eintragen“) – lesen, und „Als Vorlage
 * speichern“ mit Nachlesen. Die Regeln (was eine Vorlage füllt, was gespeichert wird) stehen in
 * `@shared/protokolle/terminVorlagen`.
 *
 * - **Lesen wirft bei jedem Fehler** – „keine Vorlagen“ ist nicht „ChurchTools antwortet nicht“ (vorübergehend ist nicht leer).
 * - **Speichern:** Ein Erfolgssignal ist kein Beleg (Lehre 11.08.2026). Nach dem `POST` wird die Liste **neu gelesen**; erst
 *   wenn die Vorlage darin steht, gilt sie als gespeichert. Lehnt ChurchTools ausdrücklich ab (`abgelehnt`), ist nichts
 *   gespeichert; bei einer unklaren Antwort (Netz, Zeitgrenze, 5xx) wird nachgesehen, ob sie doch da ist – steht sie nicht
 *   da, bleibt es `Unklar`, nie „gespeichert“.
 */
import type { Eintrag } from '@shared/protokolle/termine';
import { vorlageRumpf, vorlagenAus, type TerminVorlage } from '@shared/protokolle/terminVorlagen';
import { Unklar } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { abgelehnt } from './terminAnlegen';

const VORLAGEN = '/calendars/appointments/templates';

/** Alle Termin-Vorlagen (aller Kalender, die man sehen darf), nach Titel sortiert. */
export async function ladeVorlagen(): Promise<TerminVorlage[]> {
  return vorlagenAus(await ctDaten<unknown>(VORLAGEN));
}

/** Ein Tag im Dialog „Tags“. */
export interface TagEintrag {
  id: number;
  name: string;
}

/** Die vorhandenen Termin-Tags (`GET /tags/appointment`), nach Namen sortiert. */
export async function ladeTags(): Promise<TagEintrag[]> {
  const roh = await ctDaten<unknown>('/tags/appointment');
  return (Array.isArray(roh) ? roh : [])
    .flatMap((t: { id?: unknown; name?: unknown }) =>
      typeof t?.id === 'number' && typeof t.name === 'string' && t.name.trim()
        ? [{ id: t.id, name: t.name.trim() }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export const VORLAGE_NICHT_GEFUNDEN =
  'ChurchTools hat nicht eindeutig geantwortet – ob die Vorlage gespeichert wurde, ist unklar. Bitte die Vorlagen-Liste ansehen, bevor du es noch einmal versuchst.';

/**
 * **Als Vorlage speichern** – legt **keinen** Termin an. Gibt die neu gelesene Liste zurück (die Vorlage steht darin).
 * `vorher` sind die Nummern der Vorlagen vor dem Speichern: Gibt ChurchTools keine Nummer zurück, zählt die erste neue
 * Vorlage mit diesem Titel im Kalender.
 */
export async function vorlageSpeichern(
  e: Eintrag & { kalender: number },
  vorher: readonly number[],
): Promise<TerminVorlage[]> {
  const rumpf = vorlageRumpf(e);
  let neueId: number | null = null;
  try {
    const antwort = await ctAnfrage<{ data?: { id?: unknown } }>(VORLAGEN, {
      method: 'POST',
      body: JSON.stringify(rumpf),
      verweigert: 'Du darfst in diesem Kalender keine Termin-Vorlagen speichern.',
    });
    if (typeof antwort?.data?.id === 'number') neueId = antwort.data.id;
  } catch (x) {
    if (abgelehnt(x)) throw x;
  }
  let liste: TerminVorlage[];
  try {
    liste = await ladeVorlagen();
  } catch {
    throw new Unklar(VORLAGE_NICHT_GEFUNDEN);
  }
  const titel = e.titel.trim();
  const da = liste.some((v) =>
    neueId !== null
      ? v.id === neueId
      : !vorher.includes(v.id) && v.kalender === e.kalender && v.titel === titel,
  );
  if (!da) throw new Unklar(VORLAGE_NICHT_GEFUNDEN);
  return liste;
}
