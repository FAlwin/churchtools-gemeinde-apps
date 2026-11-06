import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { ctBasis } from '@ui/ct/verbindung';
import { dateiAdresse } from '@shared/ct/terminDateien';
import { datumText } from '@shared/ct/datum';
import type { Plan, PlanSpalte } from '@shared/dienstplan/plan';
import { InfosFenster } from './InfosFenster';
import { CtSymbol } from './CtSymbol';
import { DateienFenster } from './DateienFenster';
import type { MatrixInfos } from './useMatrixInfos';
import planStyles from './Planen.module.scss';
import ablaufStyles from './MatrixAblauf.module.scss';
import styles from './MatrixInfos.module.scss';

/** Welches Fenster: die Infos, die Dateien, gleich „Anhang hinzufügen“ (Büroklammer) oder eine Datei (T2b). */
type Was =
  | { art: 'infos' }
  | { art: 'dateien' }
  | { art: 'neueDatei' }
  | { art: 'datei'; id: number };

/** So viele Dateien stehen in einer Zelle, der Rest als „+ N weitere“ (die Zelle soll nicht endlos wachsen). */
const DATEIEN_SICHTBAR = 3;

/**
 * **Eine Zelle wie in der Dienstplan-Liste von ChurchTools** (T2b, Alwin 03.11.2026, Entwurf
 * `matrix-infos-bearbeiten.html` Variante D1 – vorher war ein vorhandener Text nicht als bearbeitbar zu erkennen): oben
 * die Knöpfe **ⓘ** (Weitere Infos – hellblau, wenn es welche gibt) und **Büroklammer** (Anhang hinzufügen, nur wer
 * ändern darf); darunter der Infotext zum Lesen in einem grauen Kasten (wie „Testinfo“ in ChurchTools) und „Anhänge:“.
 * Wer ändern darf, bekommt beim Tipp auf eine Datei deren kleines Fenster (Öffnen, Umbenennen, Löschen); alle anderen
 * öffnen sie direkt. Ohne alles ein Strich.
 */
function InfosZelle({
  mi,
  s,
  onOeffnen,
}: {
  mi: MatrixInfos;
  s: PlanSpalte;
  onOeffnen: (was: Was) => void;
}) {
  const text = mi.text(s);
  const dateien = mi.dateien(s);
  const darf = mi.darf(s);
  const fuer = `${s.name}, ${datumText(s.tag)}`;
  if (!darf && !text && dateien.length === 0) {
    return (
      <span className={planStyles.na} aria-label="keine Infos">
        –
      </span>
    );
  }
  const basis = ctBasis();
  const rest = dateien.length - DATEIEN_SICHTBAR;
  return (
    <>
      <span className={styles.knoepfe}>
        {(text || darf) && (
          <KopfKnopf
            onClick={() => onOeffnen({ art: 'infos' })}
            label={`Weitere Infos ${fuer}`}
            symbol={<CtSymbol name="info" size={14} />}
            offen={text !== ''}
            klein
          />
        )}
        {darf && (
          <KopfKnopf
            onClick={() => onOeffnen({ art: 'neueDatei' })}
            label={`Datei an ${fuer} anhängen`}
            symbol={<CtSymbol name="paperclip" size={14} />}
            klein
          />
        )}
      </span>
      {text && (
        // Nur zum Lesen – bearbeitet wird über das ⓘ. Abgeschnitten wird innen (dritte Zeile ragte sonst in den Rand).
        <p className={styles.kasten} title={text}>
          <span className={styles.zweiZeilen}>{text}</span>
        </p>
      )}
      {dateien.length > 0 && (
        <>
          <span className={styles.anhaenge}>Anhänge:</span>
          <ul className={styles.dateien}>
            {dateien.slice(0, DATEIEN_SICHTBAR).map((d) => {
              const inhalt = (
                <>
                  <Icon name={d.art === 'link' ? 'link' : 'anhang'} size={12} />
                  <span>{d.name}</span>
                </>
              );
              const href = dateiAdresse(d, basis);
              return (
                <li key={d.id}>
                  {darf ? (
                    <button
                      type="button"
                      className={styles.datei}
                      title={d.name}
                      aria-label={`${d.name} – ${fuer}`}
                      onClick={() => onOeffnen({ art: 'datei', id: d.id })}
                    >
                      {inhalt}
                    </button>
                  ) : href ? (
                    <a
                      className={styles.datei}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={d.name}
                    >
                      {inhalt}
                    </a>
                  ) : (
                    <span className={styles.datei} title="Lässt sich hier nicht öffnen">
                      {inhalt}
                    </span>
                  )}
                </li>
              );
            })}
            {rest > 0 && (
              <li>
                <button
                  type="button"
                  className={styles.datei}
                  aria-label={`Alle ${dateien.length} Dateien ${fuer}`}
                  onClick={() => onOeffnen({ art: 'dateien' })}
                >
                  <span>+ {rest} weitere</span>
                </button>
              </li>
            )}
          </ul>
        </>
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
  was: Was;
  onClose: () => void;
}) {
  const fuer = `${s.name} · ${datumText(s.tag)}`;
  if (was.art !== 'infos') {
    return (
      <DateienFenster
        fuer={fuer}
        terminId={s.id}
        dateien={mi.dateien(s)}
        darf={mi.darf(s)}
        neu={was.art === 'neueDatei'}
        datei={was.art === 'datei' ? was.id : undefined}
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
  const [offen, setOffen] = useState<{ s: PlanSpalte; was: Was } | null>(null);
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
      {/* Aus der Tabelle heraus: Ein Fenster in `tbody` wäre kein gültiges HTML (wie die Fenster der Ablauf-Zeilen). */}
      {offen && (
        <BodyPortal>
          <Fenster mi={mi} s={offen.s} was={offen.was} onClose={() => setOffen(null)} />
        </BodyPortal>
      )}
    </>
  );
}

/** Die Gruppe am Handy – für den gewählten Termin. */
export function HandyInfos({ mi, s }: { mi: MatrixInfos; s: PlanSpalte }) {
  const [offen, setOffen] = useState<Was | null>(null);
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
