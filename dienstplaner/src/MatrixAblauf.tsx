import { useEffect } from 'react';
import { Icon } from '@ui/icons/icons';
import type { Plan, PlanSpalte } from '@shared/dienstplan/plan';
import { ablaufBearbeitbar } from './start';
import { TerminAblauf } from './TerminAblauf';
import type { AblaufZustand, MatrixAblauf } from './useMatrixAblauf';
import planStyles from './Planen.module.scss';
import styles from './MatrixAblauf.module.scss';

/**
 * **Der Ablauf in der Matrix** (Bauplan E6-6a, Entwurf `e6-6-entwurf-2.html`, abgenommen 28.10.2026): die Gruppe
 * „Ablauf“ **oben**, über den Dienstgruppen, mit „N Punkte“ je Termin; darunter je Spalte der Ablauf in der schmalen
 * Form (`TerminAblauf schmal` – dieselbe Stelle wie die Termin-Ansicht). **Ein Stift** links in der Gruppenzeile öffnet
 * alle Termine, die man bearbeiten darf (Variante A); zugeklappt merkt sich das Gerät (`PlanenAnsicht.ablaufZu`).
 * Am Handy steht der Ablauf des gewählten Termins wie in der Termin-Ansicht. Ziehen zwischen Terminen kommt mit E6-6b.
 */

/** „8 Punkte“, „kein Ablauf“ – was die Gruppenzeile je Termin zeigt. */
function anzahlText(z: AblaufZustand | undefined): string {
  if (!z || z.art === 'laedt') return '…';
  if (z.art === 'fehler') return 'nicht geladen';
  if (z.ablauf === null) return 'kein Ablauf';
  const n = z.ablauf.items.length;
  return n === 1 ? '1 Punkt' : `${n} Punkte`;
}

/** Darf man den Ablauf dieses Termins bearbeiten? Abgesagte Termine stehen nur zum Ansehen da (Entwurf E6-6). */
const darfBearbeiten = (ma: MatrixAblauf, s: PlanSpalte) =>
  !s.abgesagt && ablaufBearbeitbar(ma.start, s.ablaufTermin);

/** Stift (bearbeiten) bzw. „Fertig“ – wie in der Termin-Ansicht, hier für alle gezeigten Termine. */
function StiftKnopf({ ma, fuer }: { ma: MatrixAblauf; fuer: string }) {
  if (ma.bearbeiten) {
    return (
      <button type="button" className={styles.fertig} onClick={() => ma.setBearbeiten(false)}>
        <Icon name="check" size={14} /> Fertig
      </button>
    );
  }
  return (
    <button
      type="button"
      className={styles.stift}
      aria-label={`Ablauf bearbeiten – ${fuer}`}
      title={`Ablauf bearbeiten – ${fuer}`}
      onClick={() => {
        ma.setBearbeiten(true);
        ma.setZu(false); // zugeklappt sähe man nicht, was sich öffnet
      }}
    >
      <Icon name="pencil" size={15} />
    </button>
  );
}

/** Der Ablauf eines Termins in seiner Zelle: wird geladen, Fehler mit „Erneut versuchen“ oder der Ablauf selbst. */
function AblaufZelle({ ma, s, schmal }: { ma: MatrixAblauf; s: PlanSpalte; schmal: boolean }) {
  const z = ma.zustand(s.id);
  if (!z || z.art === 'laedt') return <p className={styles.leise}>Ablauf wird geladen …</p>;
  if (z.art === 'fehler') {
    return (
      <p className={styles.leise}>
        Ablauf nicht geladen.{' '}
        <button type="button" className={styles.nochmal} onClick={() => ma.nochmal(s.id)}>
          Erneut versuchen
        </button>
      </p>
    );
  }
  return (
    <TerminAblauf
      key={s.id}
      start={ma.start}
      zeitzone={ma.zeitzone}
      termin={s}
      ablauf={z.ablauf}
      onAblauf={(neu) => ma.setzen(s.id, neu)}
      bearbeiten={ma.bearbeiten && darfBearbeiten(ma, s)}
      // Nach „Ablauf anlegen“ bleibt die Matrix im Bearbeiten; ein inzwischen gelöschter Ablauf schließt es nicht für
      // die anderen Termine.
      onBearbeiten={(an) => an && ma.setBearbeiten(true)}
      musikApp={ma.musikApp}
      schmal={schmal}
      mitNeuAufsetzen={false}
    >
      {(teile) => (
        <>
          {teile.inhalt}
          {teile.ueberlagerung}
        </>
      )}
    </TerminAblauf>
  );
}

/**
 * Die zwei Zeilen „Ablauf“ oben in der Tabelle: die Gruppenzeile (aufklappen, Stift, „N Punkte“ je Termin, Schloss
 * beim Bearbeiten) und darunter die Abläufe. `zelleKlasse` wie die Dienst-Zellen (abgesagt, andere Veranstaltung).
 */
export function AblaufZeilen({
  ma,
  plan,
  spalten,
  zelleKlasse,
}: {
  ma: MatrixAblauf;
  plan: Plan;
  spalten: number[];
  zelleKlasse: (s: PlanSpalte) => string;
}) {
  const ids = spalten.map((i) => plan.spalten[i].id);
  const schluessel = ids.join(',');
  const { laden } = ma;
  useEffect(() => {
    laden(schluessel ? schluessel.split(',').map(Number) : []);
  }, [laden, schluessel]);
  const darfIrgendwo = spalten.some((i) => darfBearbeiten(ma, plan.spalten[i]));

  return (
    <>
      <tr className={planStyles.gruppe}>
        <th className={planStyles.svc} style={{ padding: 0 }} scope="row">
          <div className={planStyles.gruppenKopfZeile}>
            <button
              type="button"
              className={planStyles.gruppenKnopf}
              aria-expanded={!ma.zu}
              onClick={() => ma.setZu(!ma.zu)}
            >
              <span className={planStyles.chev}>
                <Icon name="chev-down" size={16} />
              </span>
              Ablauf
            </button>
            {darfIrgendwo && <StiftKnopf ma={ma} fuer="alle gezeigten Termine" />}
          </div>
        </th>
        {spalten.map((i) => {
          const s = plan.spalten[i];
          const z = ma.zustand(s.id);
          const gesperrt = z?.art === 'fertig' && z.ablauf?.isLocked === true;
          return (
            <td key={s.id}>
              <div className={planStyles.gruppenZelle}>
                <span
                  className={`${styles.anzahl}${z?.art === 'fertig' && z.ablauf === null ? ` ${styles.ohne}` : ''}`}
                >
                  {anzahlText(z)}
                </span>
                {ma.bearbeiten && (gesperrt || !darfBearbeiten(ma, s)) && (
                  <span
                    className={styles.schloss}
                    title={gesperrt ? 'Abgeschlossen – nur ansehen' : 'Nur ansehen'}
                    aria-label={gesperrt ? 'Abgeschlossen – nur ansehen' : 'Nur ansehen'}
                  >
                    <Icon name="lock" size={14} />
                  </span>
                )}
              </div>
            </td>
          );
        })}
      </tr>
      {!ma.zu && (
        <tr className={styles.ablaufZeile}>
          <th className={planStyles.svc} scope="row">
            <span className={styles.unsichtbar}>Ablauf</span>
          </th>
          {spalten.map((i) => {
            const s = plan.spalten[i];
            return (
              <td key={s.id} className={`${styles.zelle}${zelleKlasse(s)}`}>
                <AblaufZelle ma={ma} s={s} schmal />
              </td>
            );
          })}
        </tr>
      )}
    </>
  );
}

/** Am Handy: der Ablauf des gewählten Termins wie in der Termin-Ansicht – oben in der Karte, zuklappbar wie die Gruppen. */
export function HandyAblauf({ ma, s }: { ma: MatrixAblauf; s: PlanSpalte }) {
  const { laden } = ma;
  useEffect(() => {
    laden([s.id]);
  }, [laden, s.id]);
  const z = ma.zustand(s.id);
  const darf = darfBearbeiten(ma, s) && z?.art === 'fertig' && z.ablauf !== null;
  return (
    <div className={planStyles.handyGruppe}>
      <div className={planStyles.handyGruppenKopf}>
        <button
          type="button"
          className={planStyles.gruppenKnopf}
          aria-expanded={!ma.zu}
          onClick={() => ma.setZu(!ma.zu)}
        >
          <span className={planStyles.chev}>
            <Icon name="chev-down" size={16} />
          </span>
          Ablauf
        </button>
        <span className={`${styles.anzahl} ${styles.handyAnzahl}`}>{anzahlText(z)}</span>
        {darf && <StiftKnopf ma={ma} fuer={s.name} />}
      </div>
      {!ma.zu && (
        <div className={styles.handyInhalt}>
          <AblaufZelle ma={ma} s={s} schmal={false} />
        </div>
      )}
    </div>
  );
}
