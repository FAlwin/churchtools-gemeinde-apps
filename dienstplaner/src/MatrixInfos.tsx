import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { datumText } from '@shared/ct/datum';
import type { Plan, PlanSpalte } from '@shared/dienstplan/plan';
import { InfosFenster } from './InfosFenster';
import { DateienFenster } from './DateienFenster';
import type { MatrixInfos } from './useMatrixInfos';
import planStyles from './Planen.module.scss';
import ablaufStyles from './MatrixAblauf.module.scss';
import styles from './MatrixInfos.module.scss';

/** Welches Fenster gerade offen ist. */
type Offen = 'infos' | 'dateien' | null;

/** So viele Dateien stehen in einer Zelle, der Rest als „+ N weitere“ (die Zelle soll nicht endlos wachsen). */
const DATEIEN_SICHTBAR = 3;

/**
 * Eine Zelle: oben die ersten zwei Zeilen der Infos (antippen öffnet alles), „+ Infos“ für wen darf; darunter die
 * Dateien (T2a, Alwin 02.11.2026: eine Datei-Zeile öffnet das Dateien-Fenster). Ohne beides ein Strich.
 */
function InfosZelle({
  mi,
  s,
  onOeffnen,
}: {
  mi: MatrixInfos;
  s: PlanSpalte;
  onOeffnen: (was: 'infos' | 'dateien') => void;
}) {
  const text = mi.text(s);
  const dateien = mi.dateien(s);
  const infos = text ? (
    <button
      type="button"
      className={styles.text}
      title={text}
      aria-label={`Weitere Infos ${s.name}, ${datumText(s.tag)}: ${text}`}
      onClick={() => onOeffnen('infos')}
    >
      {/* Abgeschnitten wird innen – am Knopf selbst ragte die dritte Zeile in den Innenabstand (Demo, 02.11.2026). */}
      <span className={styles.zweiZeilen}>{text}</span>
    </button>
  ) : mi.darf(s) ? (
    <button
      type="button"
      className={styles.plus}
      aria-label={`Infos für ${s.name}, ${datumText(s.tag)} schreiben`}
      onClick={() => onOeffnen('infos')}
    >
      <Icon name="plus" size={14} /> Infos
    </button>
  ) : null;
  if (!infos && dateien.length === 0) {
    return (
      <span className={planStyles.na} aria-label="keine Infos">
        –
      </span>
    );
  }
  const rest = dateien.length - DATEIEN_SICHTBAR;
  return (
    <>
      {infos}
      {dateien.length > 0 && (
        <ul className={styles.dateien}>
          {dateien.slice(0, DATEIEN_SICHTBAR).map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={styles.datei}
                title={d.name}
                aria-label={`Dateien ${s.name}, ${datumText(s.tag)}: ${d.name}`}
                onClick={() => onOeffnen('dateien')}
              >
                <Icon name="anhang" size={12} />
                <span>{d.name}</span>
              </button>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <button
                type="button"
                className={styles.datei}
                aria-label={`Alle ${dateien.length} Dateien ${s.name}, ${datumText(s.tag)}`}
                onClick={() => onOeffnen('dateien')}
              >
                <span>+ {rest} weitere</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  );
}

/** Das Fenster für den angetippten Termin – dieselben wie in der Termin-Ansicht. */
function Fenster({
  mi,
  s,
  was,
  onClose,
}: {
  mi: MatrixInfos;
  s: PlanSpalte;
  was: 'infos' | 'dateien';
  onClose: () => void;
}) {
  const fuer = `${s.name} · ${datumText(s.tag)}`;
  if (was === 'dateien') {
    return (
      <DateienFenster
        fuer={fuer}
        terminId={s.id}
        dateien={mi.dateien(s)}
        onAktuell={(d) => mi.dateienAktuell(s, d)}
        onClose={onClose}
      />
    );
  }
  return (
    <InfosFenster
      fuer={fuer}
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
  const [offen, setOffen] = useState<{ s: PlanSpalte; was: 'infos' | 'dateien' } | null>(null);
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
                <InfosZelle mi={mi} s={s} onOeffnen={(was) => setOffen({ s, was })} />
              </td>
            );
          })}
        </tr>
      )}
      {offen && <Fenster mi={mi} s={offen.s} was={offen.was} onClose={() => setOffen(null)} />}
    </>
  );
}

/** Die Gruppe am Handy – für den gewählten Termin. */
export function HandyInfos({ mi, s }: { mi: MatrixInfos; s: PlanSpalte }) {
  const [offen, setOffen] = useState<Offen>(null);
  return (
    <div className={planStyles.handyGruppe}>
      <div className={planStyles.handyGruppenKopf}>
        <GruppenKopf mi={mi} />
      </div>
      {!mi.zu && (
        <div className={ablaufStyles.handyInhalt}>
          <InfosZelle mi={mi} s={s} onOeffnen={setOffen} />
        </div>
      )}
      {offen && <Fenster mi={mi} s={s} was={offen} onClose={() => setOffen(null)} />}
    </div>
  );
}
