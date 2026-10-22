/**
 * **Gruppe einrichten** (Bauplan Protokolle S2-1) – der schreibende Teil der Verwaltung, nur für Admins. Die
 * Regeln stehen in `@shared/protokolle/einrichten`; hier wird nur bei ChurchTools gelesen und geschrieben.
 * Gemessen: `protokolle-planung/docs/messung-s2-1-2026-10-22.md` (und S0).
 *
 * **Reihenfolge – jeder Schritt nachgelesen:**
 * 1. Rechte-Nummern aus den Definitionen (je Modul verschieden).
 * 2. Kategorien „Protokolle“ und „Mitarbeit“ der Gruppe und die gemeinsamen „Vorlagen“ finden oder anlegen.
 * 3. Rechte ausrichten: setzen, entziehen, eins nachschieben (sonst wirkt ein Entzug weiter), nachlesen.
 * 4. **Erst dann** die Einstellung schreiben – sie ist der Vermerk „eingerichtet“.
 *    Die Kategorie „Vorlagen“ bekommt beim Anlegen die drei Standard-Vorlagen (Alwin, 22.10.2026; `./vorlagen`).
 *
 * Erneut aufrufen ist gefahrlos (Soll gegen Ist) – auch nach einem Abbruch mittendrin. Ein Fehler wird
 * geworfen; es wird nichts gelöscht, was schon da war (vorübergehend ist nicht ungültig).
 */
import {
  inhaltAus,
  kategorieSicherstellen,
  kategorieSuchen,
  kategorienLesen,
  werteLesen,
  wertAendern,
  wertAnlegen,
} from '@shared/ct/modulDaten';
import {
  abweichungen,
  ausrichten,
  darfVerwalten,
  istEinstellung,
  rechteAus,
  rechteNummernAus,
  rechtRumpf,
  sollRechte,
  vergebenNachher,
  type GruppenEinstellung,
  type PunkteVonMitgliedern,
  type Recht,
  type Stufe,
} from '@shared/protokolle/einrichten';
import { kategorieName } from '@shared/protokolle/gruppen';
import { kuerzelLesen, kuerzelMitarbeit, kuerzelProtokolle } from '@shared/protokolle/speicher';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { NUR_ADMIN, vorlagenKategorie } from './vorlagen';
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';

/** Kürzel des Moduls – danach heißen die Rechte in `/permissions/definitions`. */
const MODUL_KUERZEL = 'protokolle';

export interface VerwaltungsGruppe {
  id: number;
  name: string;
  versteckt: boolean;
  /** Beide Kategorien der Gruppe gibt es schon. */
  eingerichtet: boolean;
}

export interface Kalender {
  id: number;
  name: string;
}

export interface Verwaltung {
  darf: boolean;
  gruppen: VerwaltungsGruppe[];
  kalender: Kalender[];
}

interface GruppeRoh {
  id: number;
  name: string;
  settings?: { isHidden?: boolean };
}

/**
 * Was die Verwaltung zeigt: **alle** Gruppen der Gemeinde (auch versteckte – Alwin, 22.10.2026) und die
 * Kalender. Wer nicht verwalten darf, bekommt `darf: false` und sonst nichts.
 */
export async function ladeVerwaltung(modul: number): Promise<Verwaltung> {
  if (!darfVerwalten(await ctDaten('/permissions/global')))
    return { darf: false, gruppen: [], kalender: [] };
  const [gruppen, kalender, kategorien] = await Promise.all([
    ctAlleSeiten<GruppeRoh>('/groups'),
    ctDaten<{ id: number; name: string }[]>('/calendars'),
    kategorienLesen(modulPort, modul),
  ]);
  const beide = new Map<number, Set<string>>();
  for (const k of kategorien) {
    const z = kuerzelLesen(k.shorty);
    if (z) beide.set(z.gruppe, (beide.get(z.gruppe) ?? new Set()).add(z.art));
  }
  return {
    darf: true,
    gruppen: gruppen
      .map((g) => ({
        id: g.id,
        name: g.name,
        versteckt: g.settings?.isHidden === true,
        eingerichtet: beide.get(g.id)?.size === 2,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    kalender: (kalender ?? []).map((k) => ({ id: k.id, name: k.name })),
  };
}

export interface GruppenRolle {
  /** `group_role`-ID – daran hängen die Rechte. */
  id: number;
  name: string;
  leitung: boolean;
}

interface RolleRoh {
  id: number;
  name?: string;
  nameTranslated?: string;
  isLeader?: boolean;
  isActive?: boolean;
}

/** Die Rollen der Gruppe und – falls schon eingerichtet – ihre gespeicherte Einstellung. */
export async function ladeGruppe(
  modul: number,
  gruppe: number,
): Promise<{ rollen: GruppenRolle[]; einstellung: GruppenEinstellung | null }> {
  const [rollen, einstellung] = await Promise.all([
    ctDaten<RolleRoh[]>(`/groups/${gruppe}/roles`),
    einstellungLesen(modul, gruppe),
  ]);
  return {
    rollen: (rollen ?? [])
      .filter((r) => r.isActive !== false)
      .map((r) => ({
        id: r.id,
        name: r.nameTranslated ?? r.name ?? `Rolle ${r.id}`,
        leitung: r.isLeader === true,
      })),
    einstellung: einstellung?.inhalt ?? null,
  };
}

async function einstellungLesen(
  modul: number,
  gruppe: number,
): Promise<{ id: number; kategorie: number; inhalt: GruppenEinstellung } | null> {
  const kategorie = await kategorieSuchen(modulPort, modul, kuerzelProtokolle(gruppe));
  if (kategorie === null) return null;
  for (const w of await werteLesen(modulPort, modul, kategorie)) {
    const inhalt = inhaltAus<unknown>(w, 'einstellung', 1);
    if (istEinstellung(inhalt) && inhalt.gruppe === gruppe) return { id: w.id, kategorie, inhalt };
  }
  return null;
}

export interface Wahl {
  rollen: { rolle: number; stufe: Stufe }[];
  punkte: PunkteVonMitgliedern;
  kalender: number | null;
}

/**
 * **Vorschlag für eine noch nicht eingerichtete Gruppe**: Leiter-Rollen schreiben, alle anderen lesen und
 * haken eigene To-Dos ab. Der Admin sieht die Tabelle, bevor etwas gesetzt wird.
 */
export function vorschlag(rollen: readonly GruppenRolle[]): Wahl {
  return {
    rollen: rollen.map((r) => ({ rolle: r.id, stufe: r.leitung ? 'leitung' : 'mitglied' })),
    punkte: 'vorschlagen',
    kalender: null,
  };
}

async function rechteDerRollen(rollen: readonly number[]): Promise<Recht[]> {
  const listen = await Promise.all(
    rollen.map(async (r) => rechteAus(r, await ctDaten(`/permissions/group_role/${r}`))),
  );
  return listen.flat();
}

async function recht(methode: 'PUT' | 'DELETE', r: Recht): Promise<void> {
  await ctAnfrage(`/permissions/group_role/${r.rolle}`, {
    method: methode,
    body: JSON.stringify(rechtRumpf(r)),
    verweigert: NUR_ADMIN,
  });
}

/**
 * **Eine Gruppe einrichten oder ihre Einrichtung ändern.** Liefert die gespeicherte Einstellung; wirft
 * `NichtUebernommen`, wenn das Nachlesen etwas anderes zeigt als verlangt.
 */
export async function gruppeEinrichten(
  modul: number,
  gruppe: Pick<VerwaltungsGruppe, 'id' | 'name' | 'versteckt'>,
  wahl: Wahl,
): Promise<GruppenEinstellung> {
  // 1. Rechte-Nummern – fehlt eine, ist das Modul nicht richtig installiert: nichts setzen.
  const nummern = rechteNummernAus(await ctDaten('/permissions/definitions'), MODUL_KUERZEL);
  if (!nummern)
    throw new ApiError(
      404,
      'Die Rechte der Erweiterung „Protokolle“ fehlen in ChurchTools – ist sie mit dem Kürzel „protokolle“ installiert?',
    );

  // 2. Kategorien (finden oder anlegen, danach nachgesehen – `kategorieSicherstellen`).
  const kategorie = (kuerzel: string, name: string): Promise<number> =>
    kategorieSicherstellen(
      modulPort,
      modul,
      { kuerzel, name, beschreibung: 'Angelegt von der Erweiterung „Protokolle“.' },
      NUR_ADMIN,
    );
  const kategorien = {
    protokolle: await kategorie(
      kuerzelProtokolle(gruppe.id),
      kategorieName('Protokolle', gruppe.name),
    ),
    mitarbeit: await kategorie(
      kuerzelMitarbeit(gruppe.id),
      kategorieName('Mitarbeit', gruppe.name),
    ),
    // „Vorlagen“: beim ersten Mal mit den drei Standard-Vorlagen (eine Stelle, `./vorlagen`).
    vorlagen: await vorlagenKategorie(modul),
  };

  // 3. Rechte: Soll gegen Ist, dann nachlesen.
  const einrichtung = {
    rollen: wahl.rollen,
    kategorien,
    kalender: wahl.kalender,
    versteckt: gruppe.versteckt,
  };
  // Zusatzrechte, die die Verwaltung früher selbst gesetzt hat (Kalender, 10119) – nur die darf sie entziehen.
  // Ihre Rollen werden mitgelesen, auch wenn eine davon heute nicht mehr in der Wahl steht.
  const alt = await einstellungLesen(modul, gruppe.id);
  const vergeben = alt?.inhalt.vergeben ?? [];
  const rollenIds = [
    ...new Set([...wahl.rollen.map((r) => r.rolle), ...vergeben.map((r) => r.rolle)]),
  ];
  const soll = sollRechte(einrichtung, nummern);
  const plan = ausrichten(soll, await rechteDerRollen(rollenIds), einrichtung, nummern, vergeben);
  for (const r of plan.setzen) await recht('PUT', r);
  for (const r of plan.entziehen) await recht('DELETE', r);
  // Ohne dieses PUT wirkt ein Entzug unbestimmt lange weiter (S0, S2-1) – auch ein entzogenes Leserecht.
  if (plan.nachschieben) await recht('PUT', plan.nachschieben);
  const { fehlt, nochDa } = abweichungen(soll, plan.entziehen, await rechteDerRollen(rollenIds));
  if (fehlt.length || nochDa.length) throw new NichtUebernommen('die Rechte der Rollen');

  // 4. Die Einstellung – erst jetzt, sie ist der Vermerk „eingerichtet“. Scheitert sie, bleiben die gerade
  // gesetzten Zusatzrechte ungemerkt (und werden später nicht entzogen) – lieber das als ein falsches „eingerichtet“.
  const einstellung: GruppenEinstellung = {
    art: 'einstellung',
    fassung: 1,
    gruppe: gruppe.id,
    rollen: wahl.rollen,
    punkte: wahl.punkte,
    kalender: wahl.kalender,
    vergeben: vergebenNachher(soll, plan.setzen, vergeben, nummern),
  };
  const text = JSON.stringify(einstellung);
  if (alt) await wertAendern(modulPort, modul, alt.kategorie, alt.id, text, NUR_ADMIN);
  else await wertAnlegen(modulPort, modul, kategorien.protokolle, text, NUR_ADMIN);
  const gespeichert = await einstellungLesen(modul, gruppe.id);
  if (JSON.stringify(gespeichert?.inhalt) !== text)
    throw new NichtUebernommen('die Einstellung der Gruppe');

  return einstellung;
}
