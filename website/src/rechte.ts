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
 *
 * **Untergruppen (W3b-4a, E-W28):** Die direkten Untergruppen der Gruppe „Website“ (`/groups/hierarchies`) und welche davon
 * eingerichtet sind (ihre `veroeffentlicht-g<ID>`) werden bei jedem Lesen und Setzen **frisch** gelesen (`untergruppenLesen`) –
 * so gehören die Rechte an allen eingerichteten Untergruppen immer zum Soll der Website-Rollen, und „Rechte setzen“ bei der
 * Website entzieht sie nicht. Eine Untergruppe richtet `untergruppeRechteSetzen` ein: Kategorie sicherstellen → Rechte ihrer
 * Rollen → **danach** die Rollen der Website nachziehen (mit ihren heutigen Stufen) → ihre Leitung festhalten.
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
  stufenZumNachziehen,
  untergruppenHinweise,
  verwaltetVon,
  websiteHinweis,
  type Kategorien,
  type RolleIst,
  type RollenStufe,
  type UntergruppeStand,
  type UntergruppenKategorie,
  type WebsiteHinweis,
} from '@shared/website/rechte';
import {
  untergruppenAus,
  untergruppenKategorie,
  untergruppenKategorienAus,
} from '@shared/website/einrichten';
import { leitungSetzen } from '@shared/website/mailWerte';
import { gruppenAus } from '@shared/ct/gruppen';
import { kategorienLesen, kategorieSicherstellen } from '@shared/ct/modulDaten';
import type { RohHierarchie } from '@shared/organigramm/gruppen';
import { LeitungNichtFestgehalten, WebsiteNichtNachgezogen } from './leitungFehler';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';

const NUR_ADMIN =
  'Rechte setzen darf nur, wer in ChurchTools „Personen administrieren“ (Berechtigungen verwalten) hat.';
const KATEGORIE_VERWEIGERT =
  'Eine Untergruppe einrichten darf nur, wer in ChurchTools bei der Erweiterung „Kategorien erstellen“ hat.';
const MODUL_WER = 'Die Erweiterung „Website“';

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
  /** Die direkten Untergruppen der Gruppe (W3b-4a) – eingerichtet oder nicht. */
  untergruppen: UntergruppeStand[];
}

/** Eine Untergruppe, wie sie frisch aus ChurchTools kommt – noch ohne Rollen. */
interface Untergruppe {
  gruppe: number;
  /** Ihre Veröffentlicht-Kategorie – `null`: nicht eingerichtet. */
  kategorie: number | null;
}

/**
 * **Die Untergruppen der Website, frisch gelesen** (W3b-4a): die direkten Kinder aus `/groups/hierarchies` und, welche davon
 * eine Kategorie haben. Ein Lesefehler wird geworfen – nie „keine Untergruppen“ (sonst entzöge das Ausrichten ihre Rechte).
 */
async function untergruppenLesen(gruppe: number): Promise<Untergruppe[]> {
  const modul = await modulId(MODUL_WER);
  const [hierarchie, liste] = await Promise.all([
    ctDaten<RohHierarchie[] | null>('/groups/hierarchies'),
    kategorienLesen(modulPort, modul),
  ]);
  const kinder = untergruppenAus(hierarchie, gruppe);
  const eingerichtet = untergruppenKategorienAus(liste, kinder);
  return kinder.map((g) => ({
    gruppe: g,
    kategorie: eingerichtet.find((u) => u.gruppe === g)?.kategorie ?? null,
  }));
}

/** Die Kategorien samt aller eingerichteten Untergruppen – das, wogegen das Soll der Website gerechnet wird. */
function mitUntergruppen(kat: Kategorien, untergruppen: readonly Untergruppe[]): Kategorien {
  return {
    entwuerfe: kat.entwuerfe,
    veroeffentlicht: kat.veroeffentlicht,
    untergruppen: untergruppen.flatMap((u) =>
      u.kategorie === null ? [] : [{ gruppe: u.gruppe, kategorie: u.kategorie }],
    ),
  };
}

/**
 * Der Name einer Gruppe für die Anzeige (`/groups/{id}`); ohne lesbaren Namen „Gruppe 347“. Auch für die Bereiche in „Seite
 * einstellen“ (W3b-4b) – dieselben Namen wie hier.
 */
export async function gruppenName(gruppe: number): Promise<string> {
  const roh = await ctDaten<{ id?: unknown; name?: unknown } | null>(`/groups/${gruppe}`);
  return gruppenAus(roh ? [roh] : [])[0]?.name ?? `Gruppe ${gruppe}`;
}

/**
 * **Die Rollen der Gruppe und ihre Stufen, wie ChurchTools sie heute hat** – samt der Untergruppen (W3b-4a). Es wird nichts
 * gespeichert – die Rechte sind die einzige Quelle. Ein Lesefehler wird geworfen (nie „keine Rechte“).
 */
export async function ladeWerDarfWas(gruppe: number, kat: Kategorien): Promise<WerDarfWas> {
  const [nummern, roh, unter] = await Promise.all([
    nummernLesen(),
    rollenLesen(modulPort, gruppe),
    untergruppenLesen(gruppe),
  ]);
  const voll = mitUntergruppen(kat, unter);
  const rollen = gruppenRollenAus(roh);
  const rechte = await rechteDerRollen(
    modulPort,
    rollen.map((r) => r.id),
  );
  const untergruppen = await Promise.all(
    unter.map(async (u): Promise<UntergruppeStand> => {
      const [name, uRoh] = await Promise.all([
        gruppenName(u.gruppe),
        rollenLesen(modulPort, u.gruppe),
      ]);
      const uRollen = gruppenRollenAus(uRoh);
      if (u.kategorie === null) return { ...u, name, rollen: uRollen, ist: [] };
      const ids = uRollen.map((r) => r.id);
      const uRechte = await rechteDerRollen(modulPort, ids);
      return {
        ...u,
        name,
        rollen: uRollen,
        ist: stufenAus(ids, uRechte, voll, nummern, { gruppe: u.gruppe, kategorie: u.kategorie }),
      };
    }),
  );
  return {
    rollen,
    ist: stufenAus(
      rollen.map((r) => r.id),
      rechte,
      voll,
      nummern,
    ),
    untergruppen,
  };
}

/**
 * Die Rechte dieser Rollen ausrichten und nachlesen – der eine Weg für die Website und jede Untergruppe. Wirft
 * `NichtUebernommen` (mit `was`), wenn ChurchTools nach dem Setzen etwas anderes hat.
 */
async function ausrichten(
  rollen: readonly RollenStufe[],
  kat: Kategorien,
  nummern: DatenRechteNummern,
  was: string,
  unter?: UntergruppenKategorie,
): Promise<void> {
  const a = await rechteAusrichten(modulPort, {
    rollen: rollen.map((r) => r.rolle),
    soll: sollRechte(rollen, kat, nummern, unter),
    verwaltet: verwaltetVon(kat, nummern),
    modulSehen: nummern.modulSehen,
    verweigert: NUR_ADMIN,
  });
  if (a.fehlt.length > 0 || a.nochDa.length > 0) throw new NichtUebernommen(was);
}

/** Nur Rollen, die die Wahl nennt UND die zu dieser Gruppe gehören – alles andere bleibt unberührt. */
async function eigeneWahl(gruppe: number, wahl: readonly RollenStufe[]): Promise<RollenStufe[]> {
  const eigene = new Set(gruppenRollenAus(await rollenLesen(modulPort, gruppe)).map((r) => r.id));
  return wahl.filter((w) => eigene.has(w.rolle));
}

const leitungsRollen = (wahl: readonly RollenStufe[]): number[] =>
  wahl.filter((r) => r.stufe === 'leitung').map((r) => r.rolle);

/**
 * **Rechte setzen (Gruppe „Website“):** richtet die Rechte der Rollen auf die gewählten Stufen aus – einschließlich der
 * Kategorien aller eingerichteten Untergruppen (W3b-4a: sonst entzöge das Ausrichten sie). Entzogen wird nur, was auf unsere
 * Kategorien zeigt. Rollen, die nicht zu dieser Gruppe gehören, werden ignoriert.
 */
export async function rechteSetzen(
  gruppe: number,
  kat: Kategorien,
  wahl: readonly RollenStufe[],
): Promise<void> {
  const nummern = await nummernLesen();
  const rollen = await eigeneWahl(gruppe, wahl);
  const voll = mitUntergruppen(kat, await untergruppenLesen(gruppe));
  await ausrichten(rollen, voll, nummern, 'die Rechte der Rollen');
  await leitungFesthalten(kat.entwuerfe, leitungsRollen(rollen), null);
}

/**
 * **Eine Untergruppe einrichten oder ihre Stufen ändern** (W3b-4a, nur wer Rechte setzen darf). Der Ablauf, jeder Schritt
 * nachgelesen:
 * 1. Ist es (noch) eine direkte Untergruppe der Website? Sonst nichts tun.
 * 2. Ihre Kategorie `veroeffentlicht-g<ID>` sicherstellen (vorhanden → wiederverwendet).
 * 3. Die Rechte ihrer Rollen ausrichten.
 * 4. **Danach die Rollen der Website nachziehen**, damit sie die neue Kategorie lesen bzw. schreiben – mit ihren **heutigen**
 *    Stufen (`stufenZumNachziehen`), nicht neu vorbelegt; eine abweichende Rolle bleibt unberührt.
 * 5. Die Leitung der Untergruppe festhalten (`website-leitung` mit `gruppe`).
 *
 * Scheitert Schritt 4, ist die Untergruppe eingerichtet, die Website-Rollen aber noch nicht – das sagt
 * `WebsiteNichtNachgezogen`. Ein zweiter Versuch holt den Rest nach (Soll gegen Ist ändert dann nur, was fehlt).
 */
export async function untergruppeRechteSetzen(
  website: number,
  kat: Kategorien,
  unter: { id: number; name: string },
  wahl: readonly RollenStufe[],
): Promise<void> {
  const nummern = await nummernLesen();
  const vorher = await untergruppenLesen(website);
  if (!vorher.some((u) => u.gruppe === unter.id))
    throw new ApiError(
      409,
      `„${unter.name}“ ist keine direkte Untergruppe der Website mehr. Bitte neu laden.`,
    );
  const modul = await modulId(MODUL_WER);
  const kategorie = await kategorieSicherstellen(
    modulPort,
    modul,
    untergruppenKategorie(unter.id, unter.name),
    KATEGORIE_VERWEIGERT,
  );
  const eigene: UntergruppenKategorie = { gruppe: unter.id, kategorie };
  const voll = mitUntergruppen(
    kat,
    vorher.map((u) => (u.gruppe === unter.id ? { gruppe: u.gruppe, kategorie } : u)),
  );
  const rollen = await eigeneWahl(unter.id, wahl);
  await ausrichten(rollen, voll, nummern, `die Rechte der Rollen von „${unter.name}“`, eigene);

  // Die Website-Rollen mit ihren heutigen Stufen nachziehen – sonst lesen sie die neue Kategorie nicht.
  try {
    const oberRollen = gruppenRollenAus(await rollenLesen(modulPort, website)).map((r) => r.id);
    const oberIst = await rechteDerRollen(modulPort, oberRollen);
    await ausrichten(
      stufenZumNachziehen(oberRollen, oberIst, voll, nummern),
      voll,
      nummern,
      'die Rechte der Website-Rollen',
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    throw new WebsiteNichtNachgezogen(unter.name);
  }
  await leitungFesthalten(kat.entwuerfe, leitungsRollen(rollen), unter.id);
}

/**
 * **Wer die Leitung ist, festhalten** – der EINE Schreiber des Werts `website-leitung` (`mailWerte.ts`): nur hier, wo der Admin
 * die Stufen festlegt, und erst **nach** dem Setzen der Rechte. Ein Redakteur, der einreicht, kann die Stufen nicht lesen (nur
 * der Admin kann es) und liest stattdessen diesen Wert, um die Leitung zu benachrichtigen. Je Gruppe ein Wert (W3b-4a):
 * `gruppe = null` = die Gruppe „Website“. Abgemeldet (401) kommt unverändert an; jeder andere Fehler wird zu
 * `LeitungNichtFestgehalten`.
 */
async function leitungFesthalten(
  entwuerfe: number,
  rollen: number[],
  gruppe: number | null,
): Promise<void> {
  try {
    const modul = await modulId(MODUL_WER);
    await leitungSetzen({ p: modulPort, modul, kategorie: entwuerfe }, rollen, gruppe);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    throw new LeitungNichtFestgehalten();
  }
}

/**
 * **Prüfung beim Start (nur wer Rechte setzen darf):** weichen die Rechte der Rollen vom Soll ab, oder gibt es eine Untergruppe,
 * die noch nicht eingerichtet ist bzw. deren Rechte abweichen (W3b-4a)? Liefert den Hinweis – oder `null`, wenn alles stimmt.
 * Scheitert das Lesen, kommt auch `null` (ein Hinweis soll nie wegen eines Aussetzers erscheinen, und die Seite selbst darf
 * daran nicht scheitern); der Admin sieht den Stand ohnehin unter „Wer darf was“.
 */
export async function pruefeRechte(
  gruppe: number,
  kat: Kategorien,
): Promise<WebsiteHinweis | null> {
  try {
    const w = await ladeWerDarfWas(gruppe, kat);
    return websiteHinweis(rechteHinweis(w.rollen, w.ist), untergruppenHinweise(w.untergruppen));
  } catch {
    return null;
  }
}
