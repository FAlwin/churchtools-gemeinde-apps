import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import type { EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import { EintragenStand, type Eintragen, type FreierPlatz } from './WerKann';
import { grundText } from './ladeEntwuerfe';
import { wegHinweis } from './sendenTexte';
import { useInsBild } from './useInsBild';
// Dieselben Fach-Bausteine wie „Wer kann?“ und das Entwurfs-Fach – ein Aussehen für alle Fächer.
import styles from './WerKann.module.scss';
import eigen from './EntwurfFach.module.scss';

/**
 * **Das Fenster am belegten Platz** (Bauplan E4-5-2, Entwurf `e4-5-entwurf.html` Abschnitt 1): wer dort steht und
 * wie (angefragt, zugesagt, Gast), dazu „Andere Person wählen“ (ersetzen) und „Zurückziehen“. Beides wird erst ein
 * **Entwurf** und geht mit „Ansehen und senden“ an ChurchTools (Alwin, 15.10.2026). Ein Modal, kein Drawer.
 *
 * Was die Person mitbekommt, steht vorher da (gemessen E4-5-0, `bisherHinweis`). Ob man hier überhaupt Entwürfe
 * anlegen darf, sagt dasselbe `Eintragen` wie im „Wer kann?“-Fach.
 */
export function BelegtFach({
  platz,
  eintragen,
  onZurueckziehen,
  onAnderePerson,
  onClose,
}: {
  platz: FreierPlatz & { bisher: NonNullable<FreierPlatz['bisher']> };
  eintragen?: Eintragen;
  onZurueckziehen: () => Promise<EntwurfErgebnis>;
  onAnderePerson: () => void;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const hinweisRef = useInsBild<HTMLDivElement>(meldung);
  const b = platz.bisher;
  const stand =
    b.belegung.art === 'zusage'
      ? 'hat zugesagt.'
      : b.belegung.art === 'anfrage'
        ? 'angefragt, noch keine Antwort.'
        : 'als Gast eingetragen.';
  // Beide Wege, je mit der gemessenen Folge – aus derselben Regel wie Entwurfs- und Senden-Fach.
  const beimZurueck = wegHinweis('zurueckziehen', b.belegung, b.name);
  const beimErsetzen = wegHinweis('ersetzen', b.belegung, b.name);
  const bereit = eintragen?.art === 'bereit';

  const zurueck = async () => {
    if (laeuft) return;
    setLaeuft(true);
    setMeldung(null);
    const r = await onZurueckziehen();
    setLaeuft(false);
    if (r.ok) return;
    setMeldung(
      r.grund === 'konflikt'
        ? 'Hier hat eben jemand einen Entwurf angelegt – er steht jetzt in der Matrix. Nichts geändert.'
        : grundText(r.grund),
    );
  };

  return (
    <Sheet
      title={`${platz.dienst} · ${platz.tag}`}
      onClose={onClose}
      cancelLabel="Schließen"
      knoepfe={null}
    >
      <p className={styles.unter}>
        {platz.termin} um {platz.uhrzeit} Uhr · Platz {platz.nr} von {platz.von}
      </p>
      <div className={eigen.status}>
        <b>{b.name}</b> – {stand}
      </div>
      {bereit && (
        <>
          <div className={styles.knoepfe}>
            <button
              type="button"
              className={styles.knopf}
              disabled={laeuft}
              onClick={onAnderePerson}
            >
              Andere Person wählen
            </button>
            <button
              type="button"
              className={`${styles.knopf} ${eigen.gefahr}`}
              disabled={laeuft}
              onClick={() => void zurueck()}
            >
              Zurückziehen
            </button>
          </div>
          {beimZurueck && (
            <p className={styles.fehler}>
              <b>Zurückziehen:</b> {beimZurueck.text}
            </p>
          )}
          {beimErsetzen && (
            <p className={styles.hinweis}>
              <b>Andere Person:</b> {beimErsetzen.text}
            </p>
          )}
          <p className={styles.hinweis}>
            Beides wird zuerst ein Entwurf – geändert wird ChurchTools erst mit „Ansehen und
            senden“.
          </p>
        </>
      )}
      <EintragenStand eintragen={eintragen} laeuft={false} />
      <div ref={hinweisRef}>
        {laeuft && <p className={styles.hinweis}>Wird gespeichert …</p>}
        {meldung && (
          <p className={styles.fehler} role="alert">
            {meldung}
          </p>
        )}
      </div>
    </Sheet>
  );
}
