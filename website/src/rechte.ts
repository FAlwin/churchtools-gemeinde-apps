/**
 * **Wer darf was – lesen und setzen** (Bauplan Website W3b-1, E-W21). Die Regeln stehen in `@shared/website/rechte` (Stufen,
 * Soll, Stufe aus den Rechten), die Mechanik (Soll gegen Ist, Entziehen, Nachschieben, Nachlesen) in
 * `@shared/ct/rollenRechte` – hier wird nur bei ChurchTools gelesen und geschrieben.
 *
 * **Ablauf beim Setzen:** Rechte-Nummern aus den Definitionen → Rollen der Gruppe frisch lesen (nur deren Rollen werden
 * angefasst, auch wenn die Wahl etwas anderes enthielte) → ausrichten und nachlesen. Ein Fehler wird **geworfen**, nichts
 * wird zurückgenommen (vorübergehend ist nicht ungültig); ein zweiter Versuch ergänzt den Rest. Hat ChurchTools nach dem
 * Setzen etwas anderes, als verlangt war, wirft es `NichtUebernommen` – ein `204` ist kein Beleg. **Danach** (W3b-3) wird
 * festgehalten, welche Rollen die Leitung sind (`leitungFesthalten`) – für die Mails im Freigabe-Weg.
 */
import {
  datenRechteNummernAus,
  gruppenRollenAus,
  rechteAusrichten,
  rechteDerRollen,
  rollenLesen,
  type DatenRechteNummern,
  type GruppenRolle,
} from '@shared/ct/rollenRechte';
import {
  MODUL_KUERZEL,
  rechteHinweis,
  sollRechte,
  stufenAus,
  verwaltetVon,
  type Kategorien,
  type RolleIst,
  type RollenStufe,
} from '@shared/website/rechte';
import { leitungSetzen } from '@shared/website/mailWerte';
import { LeitungNichtFestgehalten } from './leitungFehler';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';

const NUR_ADMIN =
  'Rechte setzen darf nur, wer in ChurchTools „Personen administrieren“ (Berechtigungen verwalten) hat.';

async function nummernLesen(): Promise<DatenRechteNummern> {
  const n = datenRechteNummernAus(await ctDaten('/permissions/definitions'), MODUL_KUERZEL);
  if (!n)
    throw new ApiError(
      404,
      'Die Rechte der Erweiterung „Website“ fehlen in ChurchTools – ist sie mit dem Kürzel „website“ installiert?',
    );
  return n;
}

/** Die aktiven Rollen der Gruppe – für die Wahl der Stufen beim Einrichten (noch ohne Kategorien, also ohne Rechte zu lesen). */
export async function ladeRollen(gruppe: number): Promise<GruppenRolle[]> {
  return gruppenRollenAus(await rollenLesen(modulPort, gruppe));
}

export interface WerDarfWas {
  rollen: GruppenRolle[];
  /** Die Stufe je Rolle, abgeleitet aus den Rechten in ChurchTools (`abweicht` = von Hand verändert). */
  ist: RolleIst[];
}

/**
 * **Die Rollen der Gruppe und ihre Stufen, wie ChurchTools sie heute hat.** Es wird nichts gespeichert – die Rechte sind die
 * einzige Quelle. Ein Lesefehler wird geworfen (nie „keine Rechte“).
 */
export async function ladeWerDarfWas(gruppe: number, kat: Kategorien): Promise<WerDarfWas> {
  const [nummern, roh] = await Promise.all([nummernLesen(), rollenLesen(modulPort, gruppe)]);
  const rollen = gruppenRollenAus(roh);
  const rechte = await rechteDerRollen(
    modulPort,
    rollen.map((r) => r.id),
  );
  return {
    rollen,
    ist: stufenAus(
      rollen.map((r) => r.id),
      rechte,
      kat,
      nummern,
    ),
  };
}

/**
 * **Rechte setzen:** richtet die Rechte der Rollen auf die gewählten Stufen aus. Entzogen wird nur, was auf unsere beiden
 * Kategorien zeigt. Rollen, die nicht zu dieser Gruppe gehören, werden ignoriert.
 */
export async function rechteSetzen(
  gruppe: number,
  kat: Kategorien,
  wahl: readonly RollenStufe[],
): Promise<void> {
  const nummern = await nummernLesen();
  const roh = await rollenLesen(modulPort, gruppe);
  const eigene = new Set(gruppenRollenAus(roh).map((r) => r.id));
  // Nur Rollen, die die Wahl nennt UND die zu dieser Gruppe gehören – alles andere bleibt unberührt.
  const rollen = wahl.filter((w) => eigene.has(w.rolle));
  const soll = sollRechte(rollen, kat, nummern);
  const a = await rechteAusrichten(modulPort, {
    rollen: rollen.map((r) => r.rolle),
    soll,
    verwaltet: verwaltetVon(kat, nummern),
    modulSehen: nummern.modulSehen,
    verweigert: NUR_ADMIN,
  });
  if (a.fehlt.length > 0 || a.nochDa.length > 0)
    throw new NichtUebernommen('die Rechte der Rollen');
  await leitungFesthalten(
    kat.entwuerfe,
    rollen.filter((r) => r.stufe === 'leitung').map((r) => r.rolle),
  );
}

/**
 * **Wer die Leitung ist, festhalten** – der EINE Schreiber des Werts `website-leitung` (`mailWerte.ts`): nur hier, wo der Admin
 * die Stufen festlegt, und erst **nach** dem Setzen der Rechte. Ein Redakteur, der einreicht, kann die Stufen nicht lesen (nur
 * der Admin kann es) und liest stattdessen diesen Wert, um die Leitung zu benachrichtigen. Abgemeldet (401) kommt unverändert an;
 * jeder andere Fehler wird zu `LeitungNichtFestgehalten`.
 */
async function leitungFesthalten(entwuerfe: number, rollen: number[]): Promise<void> {
  try {
    const modul = await modulId('Die Erweiterung „Website“');
    await leitungSetzen({ p: modulPort, modul, kategorie: entwuerfe }, rollen);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    throw new LeitungNichtFestgehalten();
  }
}

/**
 * **Prüfung beim Start (nur wer Rechte setzen darf):** weichen die Rechte der Rollen vom Soll ab? Liefert den Hinweis – oder
 * `null`, wenn alles stimmt. Scheitert das Lesen, kommt auch `null` (ein Hinweis soll nie wegen eines Aussetzers erscheinen, und
 * die Seite selbst darf daran nicht scheitern); der Admin sieht den Stand ohnehin unter „Wer darf was“.
 */
export async function pruefeRechte(
  gruppe: number,
  kat: Kategorien,
): Promise<ReturnType<typeof rechteHinweis>> {
  try {
    const w = await ladeWerDarfWas(gruppe, kat);
    return rechteHinweis(w.rollen, w.ist);
  } catch {
    return null;
  }
}
