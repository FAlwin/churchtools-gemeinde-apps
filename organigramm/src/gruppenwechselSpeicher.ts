/**
 * **Die Einrichtung des Gruppenwechsels im Speicher der Erweiterung** (Bauplan O9-2, O9-F5): EIN Wert in der Kategorie
 * „Gruppenwechsel“. Das Format steht in `@shared/organigramm/gruppenwechselEinrichtung`. Geschrieben wird sie erst von
 * „Einrichten“ (O9-5); bis dahin legt ihn in der Test-Instanz ein Skript an.
 *
 * Lesen dürfen alle mit dem Reiter, ändern nur Admins – das schützt ChurchTools über die Rechte der Kategorie (setzt
 * Alwin). Ohne Kategorie oder ohne Leserecht gibt es den Reiter nicht – außer für „Berechtigungen verwalten“: Sie sehen „noch nicht eingerichtet“.
 */
import {
  einrichtungAus,
  GW_ART,
  type Einrichtung,
} from '@shared/organigramm/gruppenwechselEinrichtung';
import { kategorieSicherstellen } from '@shared/ct/modulDaten';
import {
  dokumentSpeichern,
  type SpeicherErgebnis,
  type SpeicherGrund,
} from '@shared/ct/versionierterWert';
import { dokumentGenau, modulId, port } from './speicher';

export const GW_KATEGORIE = {
  kuerzel: 'gruppenwechsel',
  name: 'Gruppenwechsel',
  beschreibung:
    'Angelegt von der Erweiterung „Organigramm“ – lesen: alle mit dem Reiter „Kinder & Jugend“; ändern: Admins.',
};

/**
 * Was beim Lesen der Einrichtung herauskommt (O9-5c) – vier Fälle, die nie ineinander übergehen dürfen:
 * - `da`: eingerichtet,
 * - `keine`: Es gibt keine (Kategorie fehlt oder ohne Wert) – nur hier darf „Einrichten“ angeboten werden,
 * - `unlesbar`: Ein Wert steht da, ist aber nicht in diesem Format (andere Fassung, beschädigt) – NIE wie „keine“
 *   behandeln: Neu einrichten würde ihn überschreiben,
 * - `fehler`: gerade nicht lesbar (vorübergehend, abgemeldet, kein Recht) – vorübergehend ist nicht „nicht eingerichtet“.
 */
export type EinrichtungLesen =
  | { art: 'da'; einrichtung: Einrichtung }
  | { art: 'keine' }
  | { art: 'unlesbar' }
  | { art: 'fehler'; grund: SpeicherGrund };

export async function ladeEinrichtung(): Promise<EinrichtungLesen> {
  const r = await dokumentGenau(GW_KATEGORIE.kuerzel, GW_ART, einrichtungAus);
  return r.art === 'da' ? { art: 'da', einrichtung: r.daten.inhalt } : r;
}

/** Wie `EinrichtungLesen`, aber mit der Versionsnummer des gelesenen Werts – die braucht, wer danach schreibt (O9-5d). */
export type EinrichtungVersioniert =
  | { art: 'da'; einrichtung: Einrichtung; version: number }
  | Exclude<EinrichtungLesen, { art: 'da' }>;

/** Die Einrichtung frisch lesen, mit Version: Wer sie überschreibt, muss die gesehene Version nennen (Konflikt-Schutz). */
export async function ladeEinrichtungVersioniert(): Promise<EinrichtungVersioniert> {
  const r = await dokumentGenau(GW_KATEGORIE.kuerzel, GW_ART, einrichtungAus);
  return r.art === 'da' ? { art: 'da', einrichtung: r.daten.inhalt, version: r.daten.version } : r;
}

const SCHREIBEN_VERWEIGERT =
  'Dir fehlt in ChurchTools das Recht, die Einrichtung der Erweiterung zu speichern (Kategorie „Gruppenwechsel“ ändern).';

/**
 * **Die Einrichtung speichern** (O9-5d). `erwartet` ist die Version, die man gelesen hat (`null`: es gab keine); steht
 * inzwischen eine andere da, wird nichts überschrieben (`konflikt`). Danach nachgelesen (`dokumentSpeichern`): erst was
 * dasteht, ist der Erfolg. Fehlt die Kategorie, wird sie angelegt (nur Admins) und nachgesehen. **Wirft** bei Fehlern an
 * Modul oder Kategorie – der Aufrufer sortiert sie nach vorübergehend und abgelehnt.
 */
export async function speichereEinrichtung(
  inhalt: Einrichtung,
  erwartet: number | null,
  von: { personId: number; name: string },
): Promise<SpeicherErgebnis<Einrichtung>> {
  const modul = await modulId();
  const kategorie = await kategorieSicherstellen(
    port,
    modul,
    {
      kuerzel: GW_KATEGORIE.kuerzel,
      name: GW_KATEGORIE.name,
      beschreibung: GW_KATEGORIE.beschreibung,
    },
    SCHREIBEN_VERWEIGERT,
  );
  return dokumentSpeichern(
    port,
    modul,
    kategorie,
    GW_ART,
    inhalt,
    von,
    erwartet,
    SCHREIBEN_VERWEIGERT,
  );
}
