import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { datumText } from '@shared/ct/datum';
import type { Plan, PlanSpalte } from '@shared/dienstplan/plan';
import { InfosFenster } from './InfosFenster';
import type { MatrixInfos } from './useMatrixInfos';
import planStyles from './Planen.module.scss';
import ablaufStyles from './MatrixAblauf.module.scss';
import styles from './MatrixInfos.module.scss';

/** Eine Zelle: die ersten zwei Zeilen (antippen öffnet alles), „+ Infos“ für wen darf, sonst nichts. */
function InfosZelle({
  mi,
  s,
  onOeffnen,
}: {
  mi: MatrixInfos;
  s: PlanSpalte;
  onOeffnen: () => void;
}) {
  const text = mi.text(s);
  if (text) {
    return (
      <button
        type="button"
        className={styles.text}
        title={text}
        aria-label={`Weitere Infos ${s.name}, ${datumText(s.tag)}: ${text}`}
        onClick={onOeffnen}
      >
        {/* Abgeschnitten wird innen – am Knopf selbst ragte die dritte Zeile in den Innenabstand (Demo, 02.11.2026). */}
        <span className={styles.zweiZeilen}>{text}</span>
      </button>
    );
  }
  if (mi.darf(s)) {
    return (
      <button
        type="button"
        className={styles.plus}
        aria-label={`Infos für ${s.name}, ${datumText(s.tag)} schreiben`}
        onClick={onOeffnen}
      >
        <Icon name="plus" size={14} /> Infos
      </button>
    );
  }
  return (
    <span className={planStyles.na} aria-label="keine Infos">
      –
    </span>
  );
}

/** Das Fenster für den angetippten Termin – dasselbe wie in der Termin-Ansicht. */
function Fenster({ mi, s, onClose }: { mi: MatrixInfos; s: PlanSpalte; onClose: () => void }) {
  return (
    <InfosFenster
      fuer={`${s.name} · ${datumText(s.tag)}`}
      terminId={s.id}
      text={mi.text(s)}
      darf={mi.darf(s)}
      onGespeichert={(t) => mi.gespeichert(s, t)}
      onClose={onClose}
    />
  );
}

/** Der Kopf der Gruppe – zuklappbar wie „Ablauf“, der Zustand bleibt auf dem Gerät. */
function GruppenKopf({ mi }: { mi: MatrixInfos }) {
  return (
    <button
      type="button"
      className={planStyles.gruppenKnopf}
      aria-expanded={!mi.zu}
      onClick={() => mi.setZu(!mi.zu)}
    >
      <span className={planStyles.chev}>
        <Icon name="chev-down" size={16} />
      </span>
      Infos &amp; Dateien
    </button>
  );
}

/** Die Gruppe in der Matrix-Tabelle: über dem Ablauf, je Termin eine Zelle. */
export function InfosZeilen({
  mi,
  plan,
  spalten,
  zelleKlasse,
}: {
  mi: MatrixInfos;
  plan: Plan;
  spalten: number[];
  zelleKlasse: (s: PlanSpalte) => string;
}) {
  const [offen, setOffen] = useState<PlanSpalte | null>(null);
  return (
    <>
      <tr className={planStyles.gruppe}>
        <th className={planStyles.svc} style={{ padding: 0 }} scope="row">
          <div className={planStyles.gruppenKopfZeile}>
            <GruppenKopf mi={mi} />
          </div>
        </th>
        {spalten.map((i) => (
          <td key={plan.spalten[i].id} />
        ))}
      </tr>
      {!mi.zu && (
        <tr className={styles.zeile}>
          <th className={planStyles.svc} scope="row">
            <span className={ablaufStyles.unsichtbar}>Infos</span>
          </th>
          {spalten.map((i) => {
            const s = plan.spalten[i];
            return (
              <td key={s.id} className={`${styles.zelle}${zelleKlasse(s)}`}>
                <InfosZelle mi={mi} s={s} onOeffnen={() => setOffen(s)} />
              </td>
            );
          })}
        </tr>
      )}
      {offen && <Fenster mi={mi} s={offen} onClose={() => setOffen(null)} />}
    </>
  );
}

/** Die Gruppe am Handy – für den gewählten Termin. */
export function HandyInfos({ mi, s }: { mi: MatrixInfos; s: PlanSpalte }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className={planStyles.handyGruppe}>
      <div className={planStyles.handyGruppenKopf}>
        <GruppenKopf mi={mi} />
      </div>
      {!mi.zu && (
        <div className={ablaufStyles.handyInhalt}>
          <InfosZelle mi={mi} s={s} onOeffnen={() => setOffen(true)} />
        </div>
      )}
      {offen && <Fenster mi={mi} s={s} onClose={() => setOffen(false)} />}
    </div>
  );
}
