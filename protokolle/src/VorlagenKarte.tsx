import { useCallback, useEffect, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { alsFormular, vorlageKurz } from '@shared/protokolle/vorlagen';
import { ladeVorlagen, type GespeicherteVorlage } from './vorlagen';
import { VorlageBearbeiten } from './VorlageBearbeiten';
import styles from './Verwaltung.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; vorlagen: GespeicherteVorlage[] };

/**
 * **Karte „Vorlagen“ in der Verwaltung** (Bauplan S2-3, Entwurf 7): gemeindeweit, für alle Gruppen. Je Vorlage Name,
 * Umfang und die Punkte; ein Tipp öffnet das Fenster zum Bearbeiten, „Neue Vorlage“ ein leeres.
 */
export function VorlagenKarte({
  modul,
  onHinweis,
}: {
  modul: number;
  onHinweis: (text: string) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  // `null` = zu, `'neu'` = neue Vorlage, sonst die geöffnete
  const [offen, setOffen] = useState<GespeicherteVorlage | 'neu' | null>(null);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeVorlagen(modul).then(
      ({ vorlagen }) => setZustand({ art: 'fertig', vorlagen }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul]);

  useEffect(laden, [laden]);

  return (
    <section className={styles.karte} aria-labelledby="vorlagen-titel">
      <div className={styles.kopf}>
        <h2 id="vorlagen-titel">Vorlagen</h2>
        <button type="button" className={styles.aktion} onClick={() => setOffen('neu')}>
          <Icon name="plus" size={16} />
          Neue Vorlage
        </button>
      </div>
      <p className={styles.erklaerung}>Gemeindeweit, für alle Gruppen.</p>
      {zustand.art === 'laedt' && <p className={styles.innen}>Wird geladen …</p>}
      {zustand.art === 'fehler' && (
        <div className={styles.innen}>
          <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />
        </div>
      )}
      {zustand.art === 'fertig' && zustand.vorlagen.length === 0 && (
        <p className={styles.innen}>
          Noch keine Vorlagen. Beim ersten Einrichten einer Gruppe entstehen drei zum Anpassen.
        </p>
      )}
      {zustand.art === 'fertig' && zustand.vorlagen.length > 0 && (
        <ul className={styles.liste}>
          {zustand.vorlagen.map((g) => (
            <li key={g.wert}>
              <button type="button" className={styles.zeile} onClick={() => setOffen(g)}>
                <span className={styles.zweizeilig}>
                  <b>{g.vorlage.name}</b>
                  <small>
                    {vorlageKurz(g.vorlage)} ·{' '}
                    {alsFormular(g.vorlage)
                      .punkte.map((p) => p.titel)
                      .join(' · ')}
                  </small>
                </span>
                <Icon name="chev-right" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {offen && (
        <VorlageBearbeiten
          modul={modul}
          vorlage={offen === 'neu' ? null : offen}
          onClose={() => setOffen(null)}
          onFertig={(text) => {
            setOffen(null);
            onHinweis(text);
            laden();
          }}
        />
      )}
    </section>
  );
}
