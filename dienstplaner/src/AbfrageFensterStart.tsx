import { useLaden } from '@ui/ct/useLaden';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { Plan, PlanGruppe } from '@shared/dienstplan/plan';
import { AbfrageFenster, type AbfrageAnschluss } from './AbfrageFenster';
import { ladeEntwuerfe } from './ladeEntwuerfe';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import type { TermineDaten } from './ladeTermine';

/**
 * **Das Fenster „Abfrage“ von der Startseite aus** (R-3, Entwurf Schritt 6 links): das vorhandene `AbfrageFenster`, im Stand
 * der einen Dienstgruppe. Planen bringt die Personenlisten (Pause) von dort mit; hier holt sie `ladeEntwuerfe` – dieselben
 * Werte, damit der Stand derselbe ist wie in Planen. Gelesen wird einmal beim Öffnen; scheitert es, geht das Fenster ohne
 * Pause-Angaben auf (sie sind Beiwerk, `useAbfrageLage` rechnet dann ohne).
 */
export function AbfrageFensterStart({
  plan,
  gruppe,
  dienstgruppe,
  heute,
  ladeZeitraum,
  ladePersonen,
  ladeAntworten,
  anschluss,
  onClose,
}: {
  plan: Plan;
  /** Die Dienstgruppe im Plan (fehlt sie in den Terminen der Startseite, eine leere – der Stand lädt den Zeitraum nach). */
  gruppe: PlanGruppe;
  dienstgruppe: Dienstgruppe;
  heute: string;
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  ladePersonen: PersonenLader;
  ladeAntworten: AntwortenLader;
  anschluss: AbfrageAnschluss;
  onClose: () => void;
}) {
  const { stand } = useLaden(
    () =>
      ladeEntwuerfe([dienstgruppe]).then(
        (d) => d.personenlisten,
        () => undefined,
      ),
    [dienstgruppe],
  );
  if (stand.art === 'laedt') return null;
  return (
    <AbfrageFenster
      plan={plan}
      spalten={[]}
      gruppen={[gruppe]}
      heute={heute}
      ladeZeitraum={ladeZeitraum}
      ladePersonen={ladePersonen}
      ladeAntworten={ladeAntworten}
      personenlisten={stand.art === 'fertig' ? stand.daten : undefined}
      anschluss={anschluss}
      onClose={onClose}
    />
  );
}
