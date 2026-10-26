import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import {
  alsFormular,
  formularPruefen,
  type VerweisArt,
  type VorlagenFormular,
} from '@shared/protokolle/vorlagen';
import { vorlageLoeschen, vorlageSpeichern, type GespeicherteVorlage } from './vorlagen';
import styles from './VorlageBearbeiten.module.scss';

/** Eine neue Vorlage beginnt wie im Entwurf mit „Gebet“ und „Offene To-Dos“. */
const NEUE_VORLAGE: VorlagenFormular = {
  name: '',
  punkte: [
    { titel: 'Gebet', text: '', verweis: null },
    { titel: 'Offene To-Dos', text: '', verweis: 'offene-aufgaben' },
  ],
  aufgaben: [],
};

const VERWEIS: Record<VerweisArt, { titel: string; hinweis: string }> = {
  'offene-aufgaben': {
    titel: 'Offene To-Dos',
    hinweis: 'Füllt sich selbst mit den offenen To-Dos der Gruppe.',
  },
  'letztes-protokoll': {
    titel: 'Protokoll der letzten Sitzung',
    hinweis: 'Zeigt das letzte Protokoll der Gruppe.',
  },
};

/**
 * **Fenster „Vorlage“** (Bauplan S2-3, Entwurf 7): Name, Tagesordnungspunkte (Titel, vorbereiteter Text, Reihenfolge;
 * feste Punkte füllen sich selbst) und feste Aufgaben. Gespeichert wird erst mit „Speichern“ – jeder Schritt
 * nachgelesen; scheitert es, bleibt das Fenster offen und sagt warum. Löschen fragt vorher.
 */
export function VorlageBearbeiten({
  modul,
  vorlage,
  onClose,
  onFertig,
}: {
  modul: number;
  vorlage: GespeicherteVorlage | null;
  onClose: () => void;
  onFertig: (hinweis: string) => void;
}) {
  const [f, setF] = useState<VorlagenFormular>(() =>
    vorlage ? alsFormular(vorlage.vorlage) : NEUE_VORLAGE,
  );
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);

  const punktAendern = (i: number, teil: Partial<VorlagenFormular['punkte'][number]>) =>
    setF({ ...f, punkte: f.punkte.map((p, j) => (j === i ? { ...p, ...teil } : p)) });
  const verschieben = (i: number, um: -1 | 1) => {
    const punkte = [...f.punkte];
    [punkte[i], punkte[i + um]] = [punkte[i + um], punkte[i]];
    setF({ ...f, punkte });
  };

  const ausfuehren = (arbeit: () => Promise<unknown>, hinweis: string) => {
    setLaeuft(true);
    setFehler(null);
    arbeit().then(
      () => onFertig(hinweis),
      (e: unknown) => {
        setFehler(fehlerMeldung(e).text);
        setLaeuft(false);
      },
    );
  };
  const speichern = () => {
    const offen = formularPruefen(f);
    if (offen.length) return setFehler(offen[0]);
    ausfuehren(() => vorlageSpeichern(modul, f, vorlage), 'Vorlage gespeichert');
  };

  return (
    <Sheet
      title={vorlage ? 'Vorlage' : 'Neue Vorlage'}
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={laeuft} onClick={speichern}>
          {laeuft ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <p className={styles.unter}>Gilt für alle Gruppen.</p>

      <div className={styles.abschnitt}>
        <label className={styles.titel} htmlFor="vorlage-name">
          Name
        </label>
        <input
          id="vorlage-name"
          className={styles.feld}
          value={f.name}
          placeholder="z. B. Jahresplanung"
          disabled={laeuft}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </div>

      <div className={styles.abschnitt}>
        <span className={styles.titel}>Tagesordnungspunkte</span>
        <ol className={styles.punkte}>
          {f.punkte.map((p, i) => (
            <li key={i} className={styles.punkt}>
              <div className={styles.punktKopf}>
                <input
                  className={styles.feld}
                  value={p.titel}
                  aria-label={`Punkt ${i + 1}`}
                  disabled={laeuft}
                  onChange={(e) => punktAendern(i, { titel: e.target.value })}
                />
                <button
                  type="button"
                  className={`${styles.ibtn} ${styles.hoch}`}
                  aria-label="Nach oben"
                  disabled={laeuft || i === 0}
                  onClick={() => verschieben(i, -1)}
                >
                  <Icon name="chev-down" size={18} />
                </button>
                <button
                  type="button"
                  className={styles.ibtn}
                  aria-label="Nach unten"
                  disabled={laeuft || i === f.punkte.length - 1}
                  onClick={() => verschieben(i, 1)}
                >
                  <Icon name="chev-down" size={18} />
                </button>
                <button
                  type="button"
                  className={styles.ibtn}
                  aria-label={`Punkt ${i + 1} entfernen`}
                  disabled={laeuft}
                  onClick={() => setF({ ...f, punkte: f.punkte.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
              {p.verweis ? (
                <small className={styles.klein}>{VERWEIS[p.verweis].hinweis}</small>
              ) : (
                <textarea
                  className={styles.text}
                  rows={2}
                  value={p.text}
                  placeholder="Vorbereiteter Text (optional)"
                  aria-label={`Text zu Punkt ${i + 1}`}
                  disabled={laeuft}
                  onChange={(e) => punktAendern(i, { text: e.target.value })}
                />
              )}
            </li>
          ))}
        </ol>
        <div className={styles.knoepfe}>
          <button
            type="button"
            className={styles.kleinKnopf}
            disabled={laeuft}
            onClick={() =>
              setF({ ...f, punkte: [...f.punkte, { titel: '', text: '', verweis: null }] })
            }
          >
            <Icon name="plus" size={15} />
            Punkt
          </button>
          {(Object.keys(VERWEIS) as VerweisArt[]).map((art) => (
            <button
              key={art}
              type="button"
              className={styles.kleinKnopf}
              disabled={laeuft}
              onClick={() =>
                setF({
                  ...f,
                  punkte: [...f.punkte, { titel: VERWEIS[art].titel, text: '', verweis: art }],
                })
              }
            >
              <Icon name="plus" size={15} />
              {VERWEIS[art].titel}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.abschnitt}>
        <span className={styles.titel}>Feste Aufgaben</span>
        <small className={styles.klein}>
          Werden bei jeder Sitzung mit dieser Vorlage angelegt.
        </small>
        {f.aufgaben.map((a, i) => (
          <div key={i} className={styles.punktKopf}>
            <input
              className={styles.feld}
              value={a}
              aria-label={`Aufgabe ${i + 1}`}
              disabled={laeuft}
              onChange={(e) =>
                setF({ ...f, aufgaben: f.aufgaben.map((x, j) => (j === i ? e.target.value : x)) })
              }
            />
            <button
              type="button"
              className={styles.ibtn}
              aria-label={`Aufgabe ${i + 1} entfernen`}
              disabled={laeuft}
              onClick={() => setF({ ...f, aufgaben: f.aufgaben.filter((_, j) => j !== i) })}
            >
              <Icon name="trash" size={17} />
            </button>
          </div>
        ))}
        <div className={styles.knoepfe}>
          <button
            type="button"
            className={styles.kleinKnopf}
            disabled={laeuft}
            onClick={() => setF({ ...f, aufgaben: [...f.aufgaben, ''] })}
          >
            <Icon name="plus" size={15} />
            Aufgabe
          </button>
        </div>
      </div>

      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}

      {vorlage && (
        <button
          type="button"
          className={styles.loeschen}
          disabled={laeuft}
          onClick={() => setLoeschenFragen(true)}
        >
          Vorlage löschen
        </button>
      )}

      {loeschenFragen && vorlage && (
        <ConfirmDialog
          title="Vorlage löschen?"
          message={`„${vorlage.vorlage.name}“ steht danach keiner Gruppe mehr zur Auswahl. Bestehende Protokolle bleiben, wie sie sind.`}
          confirmLabel="Löschen"
          onCancel={() => setLoeschenFragen(false)}
          onConfirm={() => {
            setLoeschenFragen(false);
            ausfuehren(() => vorlageLoeschen(modul, vorlage), 'Vorlage gelöscht');
          }}
        />
      )}
    </Sheet>
  );
}
