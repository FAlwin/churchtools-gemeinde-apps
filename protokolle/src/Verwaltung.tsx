import { useCallback, useEffect, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { Toast } from '@ui/fenster/Toast';
import { useToast } from '@ui/fenster/useToast';
import { ladeVerwaltung, type Verwaltung as Daten, type VerwaltungsGruppe } from './einrichten';
import { GruppeEinrichten } from './GruppeEinrichten';
import { Marke } from './Marke';
import { VorlagenKarte } from './VorlagenKarte';
import styles from './Verwaltung.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: Daten };

/**
 * **Verwaltung** (Bauplan S2-2, nur Admins): alle Gruppen der Gemeinde als Liste (Alwin, 22.10.2026), je Gruppe
 * „eingerichtet“ oder „Einrichten“. Ein Tipp öffnet das Fenster „Gruppe einrichten“. Darunter die Vorlagen (S2-3).
 */
export function Verwaltung({ modul }: { modul: number }) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [offen, setOffen] = useState<VerwaltungsGruppe | null>(null);
  const { toast, showToast } = useToast();

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeVerwaltung(modul).then(
      (daten) => setZustand({ art: 'fertig', daten }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul]);

  useEffect(laden, [laden]);

  if (zustand.art === 'laedt') return <p className={styles.ruhig}>Wird geladen …</p>;
  if (zustand.art === 'fehler') return <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />;
  const { daten } = zustand;
  if (!daten.darf)
    return (
      <p className={styles.ruhig}>
        Die Verwaltung ist nur für Admins – wer in ChurchTools Rechte vergeben darf.
      </p>
    );

  return (
    <>
      <section className={styles.karte} aria-labelledby="gruppen-titel">
        <div className={styles.kopf}>
          <h2 id="gruppen-titel">Gruppen</h2>
          <span className={styles.anzahl}>{daten.gruppen.length}</span>
        </div>
        <p className={styles.erklaerung}>
          Einrichten legt den geschützten Speicher der Gruppe an und vergibt die Rechte an ihre
          Rollen.
        </p>
        <ul className={styles.liste}>
          {daten.gruppen.map((g) => (
            <li key={g.id}>
              <button type="button" className={styles.zeile} onClick={() => setOffen(g)}>
                <span className={styles.name}>
                  {g.name}
                  {g.versteckt && <Marke art="leise">versteckt</Marke>}
                </span>
                {g.eingerichtet ? (
                  <Marke art="gut">eingerichtet</Marke>
                ) : (
                  <span className={styles.einrichten}>Einrichten</span>
                )}
                <Icon name="chev-right" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <VorlagenKarte modul={modul} onHinweis={showToast} />
      {offen && (
        <GruppeEinrichten
          modul={modul}
          gruppe={offen}
          kalender={daten.kalender}
          onClose={() => setOffen(null)}
          onFertig={() => {
            showToast(offen.eingerichtet ? 'Gruppe gespeichert' : 'Gruppe eingerichtet');
            setOffen(null);
            laden();
          }}
        />
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}
