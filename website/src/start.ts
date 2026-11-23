/**
 * **Was die Website beim Öffnen braucht** (Bauplan Website W3a-1): wer angemeldet ist, welche Website eingerichtet ist
 * (Kategorien) und was die Person darf. Die Regeln stehen in `@shared/website/` (`einrichten`, `zugang`); hier wird nur
 * gelesen. **Der Zugang kommt aus den eigenen Rechten** der Person am Modul (`/permissions/global`, W3b-1), nicht mehr daraus,
 * ob sie die Gruppe leitet.
 *
 * **Bereiche (W3b-4b):** Dazu die eingerichteten Untergruppen (direkte Kinder der Website aus `/groups/hierarchies`, deren
 * `veroeffentlicht-g<ID>` man sieht) und die eigenen Mitgliedschaften (`ladeIch` → `/persons/{ich}/groups`) – daraus ergibt
 * sich, welche Seiten man sieht und wo man freigibt (`zugangFuer`).
 *
 * Ein Fehler beim Lesen wird **geworfen**, nicht zu „nicht eingerichtet“ oder „kein Bereich“ gemacht – vorübergehend ist nicht
 * leer (die Seite zeigt dann „Erneut versuchen“). Das gilt auch für die Mitgliedschaften: `ladeIch` wirft, wenn sie nicht lesbar
 * sind, statt „in keiner Gruppe“ zu melden.
 */
import { ladeIch } from '@ui/ct/ich';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';
import { kategorienLesen } from '@shared/ct/modulDaten';
import {
  bereicheAus,
  einrichtungAus,
  einrichtungsStand,
  untergruppenAus,
  type BereichsKategorie,
  type Einrichtung,
  type EinrichtungsStand,
} from '@shared/website/einrichten';
import { darfVerwalten } from '@shared/ct/rollenRechte';
import type { RohHierarchie } from '@shared/organigramm/gruppen';
import {
  istAdmin,
  leitetGruppe,
  leitetWebsite,
  meineGruppenIds,
  schreibtIn,
  zugangFuer,
  type Zugang,
} from '@shared/website/zugang';
import { gruppenName } from './rechte';

/** Eine eingerichtete Untergruppe, wie die Oberfläche sie zeigt: Gruppe, Veröffentlicht-Kategorie und Name. */
export interface Untergruppe {
  gruppe: number;
  kategorie: number;
  name: string;
}

export interface Start {
  ichId: number;
  vorname: string;
  /** Vor- und Nachname – so steht man in „Gerade bearbeitet von …“. */
  name: string;
  gemeinde: string | null;
  modul: number;
  /** Die sichtbare Website – `null`, wenn keine Kategorie zu sehen ist. */
  einrichtung: Einrichtung | null;
  stand: EinrichtungsStand;
  /** Gruppen verwalten dürfen (ChurchTools „Admin“) → sieht „Einrichten“. */
  admin: boolean;
  /**
   * Was man sieht und wo man freigibt (aus den eigenen Rechten und Mitgliedschaften, W3b-4b) – `null`: nicht hinein (Hinweis
   * statt Editor).
   */
  zugang: Zugang | null;
  /**
   * Die eingerichteten Untergruppen, deren Kategorie man sieht (W3b-4b) – für Bereiche an Seiten, Freigeben je Bereich und
   * Meldungen. Fehlt (alte Aufrufer): keine.
   */
  untergruppen?: Untergruppe[];
  /** Rechte an Rollen setzen dürfen (ChurchTools „Personen administrieren“) – nur dann gibt es „Wer darf was“. */
  darfRechteSetzen: boolean;
  /**
   * Leitet die Gruppe, hat aber keine Rechte an der Website (noch nicht eingerichtet) – der Hinweis nennt den Weg:
   * Ein Admin setzt sie unter Einstellungen → „Wer darf was“.
   */
  leitungOhneRechte: boolean;
}

/**
 * Der Name einer Untergruppe: für die Leitung der Website frisch aus der Gruppe (wie in „Wer darf was“, `gruppenName`), sonst
 * aus dem Namen ihrer Kategorie – den sieht jeder, der die Kategorie sieht (eine fremde Gruppe vielleicht nicht). Ein Name ist
 * nur Anzeige: Scheitert das Lesen der Gruppe, bleibt der aus der Kategorie (es geht nichts verloren).
 */
async function namenLaden(
  bereiche: readonly BereichsKategorie[],
  frisch: boolean,
): Promise<Untergruppe[]> {
  return Promise.all(
    bereiche.map(async (b) => {
      const ersatz = b.name ?? `Gruppe ${b.gruppe}`;
      const name = frisch ? await gruppenName(b.gruppe).catch(() => ersatz) : ersatz;
      return { gruppe: b.gruppe, kategorie: b.kategorie, name };
    }),
  );
}

export async function ladeStart(): Promise<Start> {
  const [ich, modul, rechte] = await Promise.all([
    ladeIch(),
    modulId('Die Erweiterung „Website“'),
    ctDaten<unknown>('/permissions/global'),
  ]);
  const liste = await kategorienLesen(modulPort, modul);
  const einrichtung = einrichtungAus(liste);
  // Die Untergruppen nur, wenn es eine Website gibt; ein Lesefehler der Hierarchie wirft (nie „keine Untergruppen“).
  const bereiche = einrichtung
    ? bereicheAus(
        liste,
        untergruppenAus(
          await ctDaten<RohHierarchie[] | null>('/groups/hierarchies'),
          einrichtung.gruppe,
        ),
      )
    : [];
  const admin = istAdmin(rechte);
  const zugang = zugangFuer({
    admin,
    schreibt: schreibtIn(rechte),
    website: einrichtung,
    untergruppen: bereiche,
    meineGruppen: meineGruppenIds(ich.mitgliedschaften, ich.rollen),
  });
  const leitetSieDieGruppe = einrichtung
    ? leitetGruppe(ich.mitgliedschaften, ich.rollen, einrichtung.gruppe)
    : false;
  return {
    ichId: ich.id,
    vorname: ich.vorname,
    name: [ich.vorname, ich.nachname].filter((t) => t && t.trim() !== '').join(' '),
    gemeinde: ich.gemeinde,
    modul,
    einrichtung,
    stand: einrichtungsStand(einrichtung, admin),
    admin,
    zugang,
    untergruppen: await namenLaden(bereiche, leitetWebsite(zugang)),
    darfRechteSetzen: darfVerwalten(rechte),
    leitungOhneRechte: zugang === null && leitetSieDieGruppe,
  };
}
