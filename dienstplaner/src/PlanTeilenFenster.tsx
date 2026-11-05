import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { leseImGeraet, merkeImGeraet } from '@ui/bedienung/geraet';
import { PdfKnoepfe, PdfStandUndVorschau } from '@ui/teilen/pdfFenster';
import { useGebautesPdf, useStand } from '@ui/teilen/pdfFensterZustand';
import { planBlattPdf } from '@ui/teilen/planBlattPdf';
import styles from '@ui/teilen/TeilenFenster.module.scss';
import { gruppenName } from '@shared/dienstplan/plan';
import {
  planBlatt,
  spanneLang,
  type PlanBlattQuelle,
  type PlanBlattWahl,
} from '@shared/dienstplan/planBlatt';

const SCHLUESSEL = 'teilen.planBlatt';

/** Gemerktes lesen – nur bekannte Formen, sonst der ganze Plan. */
function wahlAus(roh: unknown): PlanBlattWahl {
  const r = roh as { art?: unknown; gruppe?: unknown } | null;
  if (r?.art === 'suchen') return { art: 'suchen' };
  if (r?.art === 'gruppe' && (typeof r.gruppe === 'number' || r.gruppe === null))
    return { art: 'gruppe', gruppe: r.gruppe };
  return { art: 'plan' };
}

/**
 * **„Plan teilen“** (Bauplan E8-2, Entwurf `e8-teilen.html`) – aus „Planen“: der ganze Plan, nur eine Gruppe oder „Wir
 * suchen noch …“, jeweils für die Termine und Gruppen, die „Planen“ gerade zeigt. Hier gibt es nur diese eine Wahl, darum
 * keine Unterseiten; darunter die fertigen Seiten und „Herunterladen“/„Teilen“ wie bei „Termin teilen“
 * (`ui/teilen/pdfFenster.tsx`). Das Gerät merkt sich die Wahl; eine gemerkte Gruppe, die gerade ausgeblendet ist, wird
 * zum ganzen Plan.
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
    leseImGeraet(SCHLUESSEL, { art: 'plan' }, wahlAus),
  );
  const wahl: PlanBlattWahl =
    gemerkt.art === 'gruppe' &&
    !quelle.gruppen.some((g) => (g.gruppe?.id ?? null) === gemerkt.gruppe)
      ? { art: 'plan' }
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
    [quelle.plan, spaltenText, gruppenText, wahlText, stand],
  );
  const { stand: pdf, geladen, setGeladen } = useGebautesPdf(blatt, planBlattPdf);

  const tage = quelle.spalten.map((i) => quelle.plan.spalten[i].tag).sort();
  const zeitraum = tage.length > 0 ? spanneLang(tage[0], tage[tage.length - 1]) : '';
  const optionen: { wahl: PlanBlattWahl; titel: string; klein?: string }[] = [
    { wahl: { art: 'plan' }, titel: 'Ganzer Plan', klein: 'alle eingeblendeten Gruppen' },
    ...quelle.gruppen.map((g, i) => ({
      wahl: { art: 'gruppe' as const, gruppe: g.gruppe?.id ?? null },
      titel: `Nur ${gruppenName(g)}`,
      ...(i === 0 ? { klein: 'z. B. für den Gruppenchat' } : {}),
    })),
    {
      wahl: { art: 'suchen' },
      titel: 'Wir suchen noch …',
      klein: 'nur offene Dienste – zum Rumschicken',
    },
  ];

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
        <div className={styles.liste} role="radiogroup" aria-label="Was teilen">
          {optionen.map((o) => (
            <button
              key={JSON.stringify(o.wahl)}
              type="button"
              role="radio"
              aria-checked={JSON.stringify(o.wahl) === wahlText}
              className={styles.wahl}
              onClick={() => waehle(o.wahl)}
            >
              <span className={styles.punkt} aria-hidden="true" />
              <span className={styles.text}>
                <b>{o.titel}</b>
                {o.klein && <small>{o.klein}</small>}
              </span>
            </button>
          ))}
        </div>
        <p className={styles.hinweis}>
          {zeitraum} · {quelle.spalten.length} {quelle.spalten.length === 1 ? 'Termin' : 'Termine'}{' '}
          – wie gerade in „Planen“ eingestellt.
        </p>
        <PdfStandUndVorschau pdf={pdf} dateiname={blatt.dateiname} geladen={geladen} />
      </div>
    </Sheet>
  );
}
