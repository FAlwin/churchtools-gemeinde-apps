import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { leseImGeraet, merkeImGeraet } from '@ui/bedienung/geraet';
import { Segment } from '@ui/bedienung/Segment';
import { PdfKnoepfe, PdfStandUndVorschau } from '@ui/teilen/pdfFenster';
import { useGebautesPdf, useStand } from '@ui/teilen/pdfFensterZustand';
import { planBlattPdf } from '@ui/teilen/planBlattPdf';
import styles from '@ui/teilen/TeilenFenster.module.scss';
import { gruppenName } from '@shared/dienstplan/plan';
import {
  PLAN_BLATT_STANDARD,
  planBlatt,
  planBlattWahlAus,
  spanneLang,
  type PlanBlattAnsicht,
  type PlanBlattQuelle,
  type PlanBlattSeiten,
  type PlanBlattWahl,
} from '@shared/dienstplan/planBlatt';

const SCHLUESSEL = 'teilen.planBlatt';

/** Schlüssel einer Gruppe für die Knöpfe (`null` = „Weitere Dienste“). */
const gruppenSchluessel = (id: number | null) => String(id ?? 'ohne');

/**
 * **„Plan teilen“** (Bauplan E8-2/E8-4, Entwurf `e8-4-ansichten.html`) – aus „Planen“: **was** geteilt wird (der ganze
 * Plan oder eine Gruppe, dann mit einer Zeile der eingeblendeten Gruppen), jeweils für die Termine und Gruppen, die
 * „Planen“ gerade zeigt, in der **Ansicht** „Termine“ (Termine × Dienste), „Personen“ (Personen × Termine, E8-4b) oder
 * „Je Person“ (E8-4c; dann eine Reihe **Seiten**: „Seite je Person“ oder „Untereinander“). Was, Ansicht und Seiten sind
 * unabhängig – der Wechsel der einen behält die anderen. Darunter die fertigen
 * Seiten und „Herunterladen“/„Teilen“ wie bei „Termin teilen“ (`ui/teilen/pdfFenster.tsx`). Das Gerät merkt sich die
 * Wahl (`planBlattWahlAus` liest auch die ältere Form); eine gemerkte Gruppe, die gerade ausgeblendet ist, wird zum ganzen
 * Plan.
 */
export function PlanTeilenFenster({
  quelle,
  onClose,
}: {
  quelle: Omit<PlanBlattQuelle, 'stand'>;
  onClose: () => void;
}) {
  const stand = useStand();
  const [gemerkt, setGemerkt] = useState<PlanBlattWahl>(() =>
    leseImGeraet(SCHLUESSEL, PLAN_BLATT_STANDARD, planBlattWahlAus),
  );
  const wahl: PlanBlattWahl =
    gemerkt.was === 'gruppe' &&
    !quelle.gruppen.some((g) => (g.gruppe?.id ?? null) === gemerkt.gruppe)
      ? { ...gemerkt, was: 'plan' }
      : gemerkt;
  const waehle = (w: PlanBlattWahl) => {
    setGemerkt(w);
    merkeImGeraet(SCHLUESSEL, w);
  };

  // Neu nur, wenn sich Plan, Termine, Gruppen oder Wahl ändern – „Planen“ baut die Listen bei jedem Zeichnen neu.
  const spaltenText = quelle.spalten.join(',');
  const gruppenText = quelle.gruppen.map((g) => g.gruppe?.id ?? 'ohne').join(',');
  const wahlText = JSON.stringify(wahl);
  const blatt = useMemo(
    () => planBlatt({ ...quelle, stand }, wahl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- die Listen stecken vollständig in den Texten
    [quelle.plan, quelle.personenlisten, spaltenText, gruppenText, wahlText, stand],
  );
  const { stand: pdf, geladen, setGeladen } = useGebautesPdf(blatt, planBlattPdf);

  const tage = quelle.spalten.map((i) => quelle.plan.spalten[i].tag).sort();
  const zeitraum = tage.length > 0 ? spanneLang(tage[0], tage[tage.length - 1]) : '';
  const waehleWas = (was: 'plan' | 'gruppe') => {
    if (was === wahl.was) return; // „Eine Gruppe“ noch einmal angetippt: die gewählte Gruppe bleibt
    const { ansicht, seiten } = wahl;
    if (was === 'plan') return waehle({ was: 'plan', ansicht, seiten });
    const erste = quelle.gruppen[0]; // „Eine Gruppe“: zuerst die erste eingeblendete
    if (erste) waehle({ was: 'gruppe', gruppe: erste.gruppe?.id ?? null, ansicht, seiten });
  };

  return (
    <Sheet
      title="Plan teilen"
      onClose={onClose}
      knoepfe={
        <PdfKnoepfe
          pdf={pdf}
          dateiname={blatt.dateiname}
          onGeladen={() => setGeladen(true)}
          onClose={onClose}
        />
      }
    >
      <div className={styles.inhalt}>
        <div className={styles.ueber}>Was</div>
        <Segment<'plan' | 'gruppe'>
          verbunden
          ariaLabel="Was teilen"
          value={wahl.was}
          options={[
            { value: 'plan', label: 'Ganzer Plan' },
            { value: 'gruppe', label: 'Eine Gruppe' },
          ]}
          onChange={waehleWas}
        />
        {wahl.was === 'gruppe' && (
          <>
            <div className={styles.ueber}>Gruppe</div>
            <Segment
              verbunden
              ariaLabel="Welche Gruppe"
              value={gruppenSchluessel(wahl.gruppe)}
              options={quelle.gruppen.map((g) => ({
                value: gruppenSchluessel(g.gruppe?.id ?? null),
                label: gruppenName(g),
              }))}
              onChange={(k) => {
                const g = quelle.gruppen.find((x) => gruppenSchluessel(x.gruppe?.id ?? null) === k);
                if (g)
                  waehle({
                    was: 'gruppe',
                    gruppe: g.gruppe?.id ?? null,
                    ansicht: wahl.ansicht,
                    seiten: wahl.seiten,
                  });
              }}
            />
          </>
        )}
        <div className={styles.ueber}>Ansicht</div>
        <Segment<PlanBlattAnsicht>
          verbunden
          ariaLabel="Ansicht"
          value={wahl.ansicht}
          options={[
            { value: 'termine', label: 'Termine' },
            { value: 'personen', label: 'Personen' },
            { value: 'person', label: 'Je Person' },
          ]}
          onChange={(ansicht) => waehle({ ...wahl, ansicht })}
        />
        {wahl.ansicht === 'person' && (
          <>
            <div className={styles.ueber}>Seiten</div>
            <Segment<PlanBlattSeiten>
              verbunden
              ariaLabel="Seiten"
              value={wahl.seiten}
              options={[
                { value: 'seite', label: 'Seite je Person' },
                { value: 'alle', label: 'Untereinander' },
              ]}
              onChange={(seiten) => waehle({ ...wahl, seiten })}
            />
          </>
        )}
        <p className={styles.hinweis}>
          {zeitraum} · {quelle.spalten.length} {quelle.spalten.length === 1 ? 'Termin' : 'Termine'}{' '}
          – wie gerade in „Planen“ eingestellt.
        </p>
        <PdfStandUndVorschau pdf={pdf} dateiname={blatt.dateiname} geladen={geladen} />
      </div>
    </Sheet>
  );
}
