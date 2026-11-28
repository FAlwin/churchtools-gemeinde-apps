import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { PredigtserieFenster } from '@ui/ablauf/PredigtserieFenster';
import { browserSerieSetzen } from '@ui/ablauf/browserAblaufZugriff';
import { verlangtNeuLaden } from '@ui/ablauf/useAblaufBearbeiten';
import { verbundeneTermine } from '@shared/ct/ablaufNeu';
import { serieAus } from '@shared/ct/schreibKern';
import type { PlanSpalte } from '@shared/dienstplan/plan';
import { darfBearbeiten } from './ablaufBearbeiten';
import { ladeAblauf } from './ladeBeiwerk';
import type { MatrixAblauf } from './useMatrixAblauf';
import styles from './MatrixSerie.module.scss';

/**
 * **Die Predigtserie im Spaltenkopf der Matrix** (Alwin, 27.11.2026, Entwurf `predigtserie-matrix-3.html` Variante C): kursiv
 * mit Buch unter dem Termin-Namen, eine Zeile, am Ende „…“ – der ganze Titel beim Darüberfahren. Kursiv und Buch heben sie
 * vom Status („3 frei“) ab, der Füllbalken trennt beide. Ohne Serie steht nichts da. Im „Ablauf bearbeiten“ (mit Recht und
 * nicht abgeschlossen) ist die Zeile ein Knopf und öffnet dasselbe Fenster wie die Termin-Ansicht; ohne Serie steht dann
 * ein leises „Predigtserie …“. Nach dem Speichern wird der Ablauf der Spalte neu gelesen (`ma.setzen`).
 */
export function MatrixSerie({ ma, s }: { ma: MatrixAblauf; s: PlanSpalte }) {
  const [offen, setOffen] = useState(false);
  const z = ma.zustand(s.id);
  const ablauf = z?.art === 'fertig' ? z.ablauf : null;
  if (!ablauf) return null;
  const serie = serieAus(ablauf.series);
  const aendern = ma.bearbeiten && darfBearbeiten(ma, s) && ablauf.isLocked !== true;
  if (!serie && !aendern) return null;

  const neuLesen = () =>
    ladeAblauf(s.id).then(
      (neu) => ma.setzen(s.id, neu),
      () => ma.nochmal(s.id),
    );
  const inhalt = (
    <>
      <Icon name="buch" size={12} stroke={2.2} className={styles.buch} />
      <span className={styles.text}>{serie ?? 'Predigtserie …'}</span>
    </>
  );
  const titel = serie ? `Predigtserie: ${serie}` : 'Predigtserie setzen';

  return (
    <>
      {aendern ? (
        // Der stille Knopf (`TextKnopf`, R2) – kursiv mit Buch über den Inhalt, damit er wie die Serie aussieht.
        <TextKnopf
          kompakt
          titel={titel}
          ariaLabel={`${titel} – ${s.name}`}
          onClick={() => setOffen(true)}
        >
          <span className={`${styles.serie} ${styles.knopf}${serie ? '' : ` ${styles.ohne}`}`}>
            {inhalt}
          </span>
        </TextKnopf>
      ) : (
        <span className={styles.serie} title={titel}>
          {inhalt}
        </span>
      )}
      {offen && (
        <PredigtserieFenster
          serie={serie}
          geteilt={verbundeneTermine(ablauf, s.id).length > 0}
          onSpeichern={async (neu) => {
            try {
              await browserSerieSetzen(s.id, neu);
            } catch (e) {
              if (verlangtNeuLaden(e)) void neuLesen();
              throw e;
            }
            setOffen(false);
            void neuLesen();
          }}
          onClose={() => setOffen(false)}
        />
      )}
    </>
  );
}
