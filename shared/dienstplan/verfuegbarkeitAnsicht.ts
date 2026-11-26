/**
 * **Welche Ansichten „Verfügbarkeit“ im Dienstplaner hat** (V-3, Entwurf `verfuegbarkeit-einstellungen-v4.html`): die
 * Rechnungen hinter dem Umschalter „Abwesenheiten | Zusagen“ – welche eigenen Dienstgruppen nach Zusagen fragen, womit die
 * Seite aufgeht und welche Termine unter „Zusagen“ stehen. Geladen wird im Browser (`dienstplaner/src/useVerfuegbarkeitAnsichten.ts`).
 *
 * **Eine Regel:** „fragt nach Zusagen?“ ist ausschließlich `fragtZusagen` (V-2) – hier nur auf die eigenen Gruppen angewandt.
 */
import type { Dienstgruppe } from '../ct/dienstgruppen';
import { fragtZusagen, type AbfragenInhalt, type VerfuegbarkeitArt } from './abfragen';
import type { RohTermin } from './termine';

export type VerfuegbarkeitAnsicht = 'abwesenheiten' | 'zusagen';

/**
 * Die eigenen Dienstgruppen, die nach Zusagen fragen, in der Reihenfolge von `gruppen`. `inhalt` liefert das Dokument der
 * Gruppe – `null` (nicht gelesen, nicht lesbar, Lesefehler) gilt wie der Startwert als „Zusagen“ (`fragtZusagen`): Ein
 * Lesefehler darf nie Ja/Vielleicht verstecken, nichts geht verloren.
 */
export function zusagenGruppen(
  gruppen: readonly Dienstgruppe[],
  inhalt: (dienstgruppeId: number) => Pick<AbfragenInhalt, 'verfuegbarkeit'> | null,
): Dienstgruppe[] {
  return gruppen.filter((g) => fragtZusagen(inhalt(g.id)));
}

/**
 * **Womit die Seite aufgeht:** immer mit „Abwesenheiten“ – außer man kommt über eine Abfrage (`#/abwesenheiten?abfrage=<id>`,
 * Karte oder Mail) einer Dienstgruppe, die nach Zusagen fragt: dann „Zusagen“. `abfrageGruppe` ist die Gruppe der gültigen
 * Abfrage (`null` ohne). Ohne Zusagen-Gruppe gibt es keine Ansicht „Zusagen“.
 *
 * **`abfrageArt` (V-4):** die Art, wie die Gruppe der Abfrage fragt, aus dem Dokument, das die Abfrage selbst geliefert hat. Fragt sie
 * „Nur abwesend“, gilt immer „Abwesenheiten“ – dort steht das Band mit „Fertig“. Das gilt auch dann, wenn die Liste der Zusagen-Gruppen
 * die Gruppe wegen eines vorübergehenden Lesefehlers fälschlich enthält (`null` = Zusagen, V-3): Sonst ginge die Seite auf „Zusagen“ auf,
 * und das Band mit „Fertig“ fehlte ganz.
 */
export function ansichtBeimOeffnen(
  abfrageGruppe: number | null,
  zusagen: readonly Pick<Dienstgruppe, 'id'>[],
  abfrageArt: VerfuegbarkeitArt | null = null,
): VerfuegbarkeitAnsicht {
  return abfrageArt !== 'abwesend' &&
    abfrageGruppe !== null &&
    zusagen.some((g) => g.id === abfrageGruppe)
    ? 'zusagen'
    : 'abwesenheiten';
}

/**
 * **Die Termine unter „Zusagen“:** die, an denen mindestens eine der `gruppen` Dienste hat – ein gültiger Platz
 * (`isValid` nicht `false`) in einem Dienst dieser Dienstgruppe. Das Ergebnis nennt je Termin-ID die Namen dieser Gruppen
 * (in der Reihenfolge von `gruppen`, für das Schild am Termin).
 *
 * Gerechnet wird am rohen Termin, nicht an der Matrix (`gruppeHatDienste`): Die Matrix lässt Dienste weg, die ChurchTools
 * einem einfachen Mitglied nur mit den eigenen Einträgen liefert (`ganzSichtbar`) – die gehören hier trotzdem dazu.
 * Dass der Termin nicht vorbei ist, entscheidet die Seite (sie zeigt nur Termine ab heute).
 */
export function zusagenTermine(
  termine: readonly Pick<RohTermin, 'id' | 'eventServices'>[],
  dienstgruppeVon: (serviceId: number) => number | null | undefined,
  gruppen: readonly Pick<Dienstgruppe, 'id' | 'name'>[],
): Map<number, string[]> {
  const ergebnis = new Map<number, string[]>();
  for (const t of termine) {
    const da = new Set<number>();
    for (const p of t.eventServices ?? []) {
      if (typeof p.serviceId !== 'number' || p.isValid === false) continue;
      const gruppe = dienstgruppeVon(p.serviceId);
      if (gruppe !== null && gruppe !== undefined) da.add(gruppe);
    }
    const namen = gruppen.filter((g) => da.has(g.id)).map((g) => g.name);
    if (namen.length > 0) ergebnis.set(t.id, namen);
  }
  return ergebnis;
}
