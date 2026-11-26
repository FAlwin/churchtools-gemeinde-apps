import { useMemo } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import {
  erinnerSpalten,
  fehlendeInGruppe,
  type AbfrageRegel,
  nurVorgesehene,
  termineFuerAbfrage,
  type GruppenErgebnis,
} from '@shared/dienstplan/erinnern';
import type { Personenliste } from '@shared/dienstplan/personenliste';
import { gruppenDerDienste } from '@shared/dienstplan/personenDaten';
import { rasterDienste } from '@shared/dienstplan/personenRaster';
import type { Plan, PlanGruppe } from '@shared/dienstplan/plan';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import type { TermineDaten } from './ladeTermine';
import { usePersonenAntworten } from './usePersonenAntworten';
import { usePersonenDaten } from './usePersonenDaten';

/**
 * **Die Lage einer Abfrage** (R-2): welche Termine zu ihr gehören und wem darin noch Antworten fehlen – für die Zeitleiste
 * beim Starten und für den Stand. Es ist **dieselbe Rechnung wie bei „Erinnern“** (`fehlendeInGruppe`, dieselben Lader für
 * Mitglieder, Abwesenheiten und Antworten), nur für die Termine der Abfrage statt der gezeigten Spalten.
 *
 * **Welcher Plan?** Liegt `von`–`bis` im geladenen Plan von „Planen“ (zwischen seinem ersten und letzten Termin – dort ist
 * alles geladen), gilt der. Sonst wird der Zeitraum über `ladeZeitraum` (dieselbe Lade-Funktion wie der Zeitraum-Knopf)
 * nachgeladen; gehalten wird er mit seinem Bereich, damit eine späte Antwort für einen alten Zeitraum nicht zählt. Die
 * Gruppe wird **im verwendeten Plan** gesucht – ihre Zellen sind nach dessen Spalten gezählt.
 *
 * `fest`: Die Termine stehen schon fest (eine laufende Abfrage) – sonst rechnet `termineFuerAbfrage` sie aus dem Zeitraum.
 */
export function useAbfrageLage(o: {
  plan: Plan;
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  ladePersonen: PersonenLader;
  ladeAntworten: AntwortenLader;
  personenlisten?: ReadonlyMap<number, Personenliste>;
  /** Die Dienstgruppe (aus dem Plan von „Planen“) – `null`: keine gewählt. */
  gruppe: PlanGruppe | null;
  von: string;
  bis: string;
  fest: readonly number[] | null;
  heute: string;
  /**
   * Nach welcher Regel „offen“ gilt (V-4): bei „Nur abwesend“ zählt die Bestätigung „Fertig“ der laufenden Abfrage. Beim Starten gibt
   * es noch keine Abfrage-ID (`abfrageId: null`) – dann hat niemand bestätigt.
   */
  regel: AbfrageRegel;
}): {
  /** Der Plan wird (nach-)geladen. */
  planLaedt: boolean;
  planFehler: Fehlermeldung | null;
  /** Die Termin-IDs der Abfrage. */
  termine: number[];
  /** Mitglieder, Abwesenheiten oder Antworten werden geladen. */
  laedt: boolean;
  /** `null`: nichts zu rechnen (keine Termine, noch kein Plan). */
  ergebnis: GruppenErgebnis | null;
  neuLaden: () => void;
} {
  const { plan, gruppe, von, bis, fest, heute, ladeZeitraum, regel } = o;
  const zeitraumOk = von !== '' && bis !== '' && von <= bis;
  const imGezeigten =
    zeitraumOk &&
    plan.spalten.length > 0 &&
    von >= plan.spalten[0].tag &&
    bis <= plan.spalten[plan.spalten.length - 1].tag;
  const nachladen = zeitraumOk && !imGezeigten;

  const { stand, neu } = useLaden<{ von: string; bis: string; plan: Plan }>(
    () => (nachladen ? ladeZeitraum(von, bis).then((d) => ({ von, bis, plan: d.plan })) : null),
    [nachladen, von, bis, ladeZeitraum],
  );
  const geladen = stand.art === 'fertig' && stand.daten.von === von && stand.daten.bis === bis;
  const arbeitsPlan: Plan | null = !zeitraumOk
    ? null
    : imGezeigten
      ? plan
      : geladen && stand.art === 'fertig'
        ? stand.daten.plan
        : null;
  const planLaedt = nachladen && !geladen && stand.art !== 'fehler';
  const planFehler = nachladen && stand.art === 'fehler' ? stand.fehler : null;

  const gruppeId = gruppe?.gruppe?.id ?? null;
  const imPlan =
    arbeitsPlan && gruppeId !== null
      ? (arbeitsPlan.gruppen.find((g) => g.gruppe?.id === gruppeId) ?? null)
      : null;

  const termine = useMemo(
    () =>
      fest
        ? [...fest]
        : arbeitsPlan && imPlan
          ? termineFuerAbfrage(arbeitsPlan, imPlan, von, bis, heute)
          : [],
    [fest, arbeitsPlan, imPlan, von, bis, heute],
  );
  const spalten =
    arbeitsPlan && imPlan
      ? erinnerSpalten(
          arbeitsPlan,
          arbeitsPlan.spalten.flatMap((s, i) => (termine.includes(s.id) ? [i] : [])),
          heute,
        )
      : [];

  // Laden wie bei „Erinnern“: Mitglieder und Abwesenheiten der CT-Gruppen, Antworten je Dienstgruppe.
  const dienste =
    arbeitsPlan && imPlan
      ? rasterDienste(arbeitsPlan, spalten, [nurVorgesehene(arbeitsPlan, spalten, imPlan)])
      : [];
  const ctGruppen = gruppenDerDienste(dienste.map((x) => x.zeile.dienst));
  const personen = usePersonenDaten(
    o.ladePersonen,
    spalten.length > 0 ? ctGruppen : [],
    zeitraumOk ? { von, bis } : null,
  );
  const antw = usePersonenAntworten(
    o.ladeAntworten,
    spalten.length > 0 && gruppeId !== null ? [gruppeId] : [],
  );

  const ladeFehler = antw.fehler ?? personen.fehler;
  const ergebnis: GruppenErgebnis | null =
    arbeitsPlan && imPlan && spalten.length > 0
      ? ladeFehler
        ? { art: 'gesperrt', grund: 'Nicht geladen', nochmal: true }
        : fehlendeInGruppe({
            plan: arbeitsPlan,
            spalten,
            gruppe: imPlan,
            daten: personen.daten,
            antworten: antw.antworten,
            heute,
            personenlisten: o.personenlisten,
            regel,
          })
      : null;

  return {
    planLaedt,
    planFehler,
    termine,
    laedt: spalten.length > 0 && (personen.laedt || antw.laedt),
    ergebnis,
    neuLaden: () => {
      if (planFehler) neu();
      personen.neuLaden();
      antw.neuLaden();
    },
  };
}
