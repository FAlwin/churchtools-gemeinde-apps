import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { Segment } from '@ui/bedienung/Segment';
import type { Entwurf, EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import { wannText } from '@shared/ct/zeit';
import type { FreierPlatz } from './WerKann';
import { grundText } from './ladeEntwuerfe';
import { useInsBild } from './useInsBild';
// Dieselben Fach-Bausteine (Knöpfe, Hinweiskasten, Unterzeile) wie „Wer kann?“ – ein Aussehen für beide Fächer.
import styles from './WerKann.module.scss';
import eigen from './EntwurfFach.module.scss';

type Modus = Entwurf['modus'];

/**
 * **Das Entwurfs-Fach** (Bauplan E4-3-3, Entwurf Abschnitt 3/4): einen Entwurf ansehen und ändern – wer, von
 * wem und wann, „Beim Senden: Anfrage | direkt“, andere Person, entfernen. Ist er veraltet (in ChurchTools
 * steht inzwischen jemand anderes, `inChurchTools`), gilt ChurchTools: nur noch „Entwurf verwerfen“.
 *
 * Hat ein anderer Planer den Entwurf eben geändert, steht das da – „so lassen“ oder bewusst „trotzdem“ mit
 * dessen Version (wie im „Wer kann?“-Fach). Bei Erfolg schließt der Aufrufer das Fach.
 */
export function EntwurfFach({
  platz,
  entwurf,
  inChurchTools,
  onModus,
  onEntfernen,
  onAnderePerson,
  onClose,
  zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: {
  platz: FreierPlatz;
  entwurf: Entwurf;
  /** Gesetzt, wenn der Entwurf veraltet ist: was jetzt in ChurchTools steht (Name oder „belegt“). */
  inChurchTools: string | null;
  onModus: (modus: Modus, erwartet: number) => Promise<EntwurfErgebnis>;
  onEntfernen: (erwartet: number) => Promise<EntwurfErgebnis>;
  onAnderePerson: () => void;
  onClose: () => void;
  /** Wie die App (`App.tsx`): die Zeitzone des Geräts – für Tests fest. */
  zeitzone?: string;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState<{
    jetzt: Entwurf | null;
    nochmal: (erwartet: number) => Promise<EntwurfErgebnis>;
    was: string;
  } | null>(null);
  const hinweisRef = useInsBild<HTMLDivElement>(meldung ?? konflikt);

  const tue = async (
    aktion: (erwartet: number) => Promise<EntwurfErgebnis>,
    erwartet: number,
    was: string,
  ) => {
    if (laeuft) return;
    setLaeuft(true);
    setMeldung(null);
    setKonflikt(null);
    const r = await aktion(erwartet);
    setLaeuft(false);
    if (r.ok) return;
    if (r.grund === 'konflikt') setKonflikt({ jetzt: r.jetzt ?? null, nochmal: aktion, was });
    else setMeldung(grundText(r.grund));
  };

  const gast = entwurf.ziel.art === 'gast';
  const von = entwurf.von.name;
  return (
    <Sheet title={`${platz.dienst} · ${platz.tag}`} onClose={onClose} cancelLabel="Schließen">
      <p className={styles.unter}>
        {platz.termin} um {platz.uhrzeit} Uhr · Platz {platz.nr} von {platz.von}
      </p>

      {inChurchTools !== null ? (
        <div className={styles.konflikt}>
          <p>
            <b>Inzwischen in ChurchTools geändert:</b> {inChurchTools} Der Entwurf „
            {entwurf.ziel.name}“ von {von} passt nicht mehr dazu.
          </p>
          <p>Was in ChurchTools steht, gilt. Dieser Entwurf wird nie gesendet.</p>
          <button
            type="button"
            className={`${styles.knopf} ${styles.primaer}`}
            disabled={laeuft}
            onClick={() => void tue(onEntfernen, entwurf.version, 'verwerfen')}
          >
            Entwurf verwerfen
          </button>
        </div>
      ) : (
        <>
          <div className={eigen.status}>
            <b>{entwurf.ziel.name}</b>
            {gast && ' (Gast)'} – Entwurf, noch nicht gesendet.
            <small>
              Eingetragen von {von}, {wannText(entwurf.zeit, zeitzone)}
            </small>
          </div>
          {gast ? (
            <p className={styles.hinweis}>
              Ein Gast bekommt keine Anfrage – sein Name steht beim Senden einfach im Plan.
            </p>
          ) : (
            <>
              <div className={eigen.modus}>
                <span>Beim Senden:</span>
                <Segment<Modus>
                  value={entwurf.modus}
                  options={[
                    { value: 'anfrage', label: 'Anfrage senden' },
                    { value: 'direkt', label: 'Direkt zuteilen' },
                  ]}
                  onChange={(m) => {
                    if (m !== entwurf.modus && !laeuft) {
                      void tue((v) => onModus(m, v), entwurf.version, 'ändern');
                    }
                  }}
                  ariaLabel="Beim Senden"
                  verbunden
                />
              </div>
              <p className={styles.hinweis}>
                Direkt zuteilen = ohne Rückfrage als zugesagt eintragen, z. B. für Prediger.
              </p>
            </>
          )}
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
              onClick={() => void tue(onEntfernen, entwurf.version, 'entfernen')}
            >
              Entfernen
            </button>
          </div>
        </>
      )}

      <div ref={hinweisRef}>
        {laeuft && <p className={styles.hinweis}>Wird gespeichert …</p>}
        {meldung && (
          <p className={styles.fehler} role="alert">
            {meldung}
          </p>
        )}
        {konflikt && (
          <div className={styles.konflikt} role="alert">
            <p>
              <b>
                {konflikt.jetzt
                  ? `${konflikt.jetzt.von.name} hat diesen Entwurf eben geändert:`
                  : 'Jemand hat diesen Entwurf eben entfernt.'}
              </b>{' '}
              {konflikt.jetzt && `„${konflikt.jetzt.ziel.name}“. `}
              Nichts{' '}
              {konflikt.was === 'ändern'
                ? 'geändert'
                : konflikt.was === 'verwerfen'
                  ? 'verworfen'
                  : 'entfernt'}
              .
            </p>
            <div className={styles.knoepfe}>
              <button
                type="button"
                className={`${styles.knopf} ${styles.primaer}`}
                onClick={onClose}
              >
                So lassen
              </button>
              {konflikt.jetzt && (
                <button
                  type="button"
                  className={styles.knopf}
                  disabled={laeuft}
                  onClick={() => {
                    const jetzt = konflikt.jetzt;
                    if (jetzt) void tue(konflikt.nochmal, jetzt.version, konflikt.was);
                  }}
                >
                  Trotzdem {konflikt.was}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
