import { useMemo, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import type { Seite } from '@shared/website/modell';
import {
  hatStartseite,
  menueOhneSeite,
  neueStartseite,
  seitenFuerListe,
} from '@shared/website/seitenListe';
import { Hinweis, Leise } from './Hinweis';
import { NeueSeite } from './NeueSeite';
import { Vorschau, type Ansicht } from './Vorschau';
import {
  ladeWebsite,
  loescheSeite,
  speichereMenue,
  speichereSeite,
  type EntwurfsOrt,
} from './daten';
import { neueId } from './ids';
import styles from './Seiten.module.scss';

/**
 * **Der Reiter „Seiten“** (Bauplan Website W3a-1): links die Seitenliste (Startseite markiert, „Im Menü“ und „Weitere
 * Seiten“), rechts die Vorschau mit dem Umschalter Computer | Handy. „Neue Seite“ und „Seite löschen“ schreiben in die
 * Entwürfe. Gelesen wird die ganze Kategorie mit einem Aufruf; nach jedem Schreiben wird neu gelesen, damit die Liste
 * zeigt, was wirklich gespeichert ist.
 *
 * Eine Website ohne Startseite zeigt einen Hinweis mit dem Knopf „Startseite anlegen“ (Vorlage `start-schriftzug`) –
 * angelegt wird nie von selbst.
 */
export function Seiten({ ort, gemeinde }: { ort: EntwurfsOrt; gemeinde: string | null }) {
  const { modul, kategorie } = ort;
  const geladen = useLaden(() => ladeWebsite({ modul, kategorie }), [modul, kategorie], {
    behalten: true,
  });
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>('computer');
  const [neu, setNeu] = useState(false);
  const [loeschen, setLoeschen] = useState<Seite | null>(null);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const stand = geladen.stand.art === 'fertig' ? geladen.stand.daten : null;
  const listen = useMemo(
    () => (stand ? seitenFuerListe(stand.seiten, stand.menue) : null),
    [stand],
  );
  const aktuell: Seite | null =
    stand && listen
      ? (stand.seiten.find((s) => s.id === gewaehlt) ??
        stand.seiten.find((s) => s.startseite) ??
        listen.imMenue[0] ??
        listen.weitere[0] ??
        null)
      : null;

  const startseiteAnlegen = async () => {
    if (!stand) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const s = neueStartseite(stand.seiten, neueId);
      await speichereSeite(ort, s);
      setGewaehlt(s.id);
      geladen.neu();
    } catch (e) {
      setFehler(fehlerMeldung(e));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className={styles.seite}>
      {geladen.stand.art === 'laedt' && <Leise>Die Seiten werden geladen …</Leise>}
      {geladen.stand.art === 'fehler' && (
        <FehlerKasten fehler={geladen.stand.fehler} onNochmal={geladen.neu} />
      )}
      {geladen.stand.art === 'fertig' && geladen.stand.neuFehler && (
        <FehlerKasten fehler={geladen.stand.neuFehler} onNochmal={geladen.neu} />
      )}
      {fehler && <FehlerKasten fehler={fehler} onNochmal={() => setFehler(null)} />}

      {stand && listen && (
        <>
          {stand.probleme.length > 0 && (
            <Hinweis titel="Mit manchen Daten stimmt etwas nicht">
              <Leise>
                Diese Einträge in ChurchTools lassen sich nicht lesen. Sie bleiben unberührt –
                niemand löscht sie automatisch.
              </Leise>
              <ul className={styles.probleme}>
                {stand.probleme.map((p, i) => (
                  <li key={`${p.wert ?? 'x'}-${i}`}>{p.text}</li>
                ))}
              </ul>
            </Hinweis>
          )}
          {!hatStartseite(stand.seiten) && (
            <Hinweis titel="Diese Website hat noch keine Startseite">
              <p>
                {stand.seiten.length === 0
                  ? 'Es gibt noch keine Seite.'
                  : 'Keine der Seiten ist als Startseite festgelegt.'}{' '}
                Du kannst eine Startseite aus einer Vorlage anlegen und danach nach Belieben ändern.
              </p>
              <div className={styles.aktionen}>
                <FensterKnopf disabled={laeuft} onClick={() => void startseiteAnlegen()}>
                  <Icon name="home" size={16} />
                  Startseite anlegen
                </FensterKnopf>
              </div>
            </Hinweis>
          )}

          <div className={styles.raster}>
            <aside className={styles.liste} aria-label="Seiten">
              <ListenGruppe
                titel="Im Menü"
                leer="Noch keine Seite im Menü."
                seiten={listen.imMenue}
                aktuell={aktuell}
                onWahl={(s) => setGewaehlt(s.id)}
              />
              <ListenGruppe
                titel="Weitere Seiten"
                leer="Keine weiteren Seiten."
                seiten={listen.weitere}
                aktuell={aktuell}
                onWahl={(s) => setGewaehlt(s.id)}
              />
              <div className={styles.listenFuss}>
                <FensterKnopf art="hell" onClick={() => setNeu(true)}>
                  <Icon name="plus" size={16} />
                  Neue Seite
                </FensterKnopf>
              </div>
            </aside>

            <section className={styles.arbeit} aria-label="Vorschau">
              {aktuell ? (
                <>
                  <div className={styles.werkzeug}>
                    <div className={styles.name}>
                      <strong>{aktuell.titel}</strong>
                      <span>{aktuell.startseite ? '/' : `/${aktuell.pfad}/`}</span>
                    </div>
                    <Segment
                      value={ansicht}
                      options={[
                        { value: 'computer', label: 'Computer' },
                        { value: 'handy', label: 'Handy' },
                      ]}
                      onChange={setAnsicht}
                      ariaLabel="Vorschau-Ansicht"
                      verbunden
                    />
                    <KopfKnopf
                      gefahr
                      label="Seite löschen"
                      symbol={<Icon name="trash" size={16} />}
                      onClick={() => setLoeschen(aktuell)}
                    />
                  </div>
                  {aktuell.abschnitte.length === 0 && (
                    <Leise>Diese Seite ist noch leer – Inhalte kommen im nächsten Schritt.</Leise>
                  )}
                  <Vorschau seite={aktuell} stand={stand} gemeinde={gemeinde} ansicht={ansicht} />
                </>
              ) : (
                <Leise>Noch keine Seite – lege die erste an.</Leise>
              )}
            </section>
          </div>
        </>
      )}

      {neu && stand && (
        <NeueSeite
          seiten={stand.seiten}
          speichern={(s) => speichereSeite(ort, s)}
          onAngelegt={(s) => {
            setNeu(false);
            setGewaehlt(s.id);
            geladen.neu();
          }}
          onClose={() => setNeu(false)}
        />
      )}
      {loeschen && stand && (
        <SeiteLoeschen
          seite={loeschen}
          imMenue={menueOhneSeite(stand.menue, loeschen.id) !== null}
          onLoeschen={async () => {
            // Erst das Menü: Scheitert das Löschen der Seite danach, steht sie nur nicht mehr im Menü – nie ein
            // Menüpunkt, der ins Leere zeigt.
            const menue = menueOhneSeite(stand.menue, loeschen.id);
            if (menue) await speichereMenue(ort, menue);
            await loescheSeite(ort, loeschen.id);
            setLoeschen(null);
            setGewaehlt(null);
            geladen.neu();
          }}
          onClose={() => setLoeschen(null)}
        />
      )}
    </div>
  );
}

function ListenGruppe({
  titel,
  leer,
  seiten,
  aktuell,
  onWahl,
}: {
  titel: string;
  leer: string;
  seiten: readonly Seite[];
  aktuell: Seite | null;
  onWahl: (s: Seite) => void;
}) {
  return (
    <div className={styles.gruppe}>
      <h3 className={styles.gruppenTitel}>{titel}</h3>
      {seiten.length === 0 && <p className={styles.leer}>{leer}</p>}
      {seiten.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`${styles.eintrag}${s.id === aktuell?.id ? ' ' + styles.an : ''}`}
          aria-current={s.id === aktuell?.id ? 'page' : undefined}
          onClick={() => onWahl(s)}
        >
          <Icon name={s.startseite ? 'home' : 'dokument'} size={16} />
          <span className={styles.titel}>{s.titel}</span>
          {s.startseite && <span className={styles.marke}>Startseite</span>}
        </button>
      ))}
    </div>
  );
}

function SeiteLoeschen({
  seite,
  imMenue,
  onLoeschen,
  onClose,
}: {
  seite: Seite;
  imMenue: boolean;
  onLoeschen: () => Promise<void>;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const folgen = [
    seite.startseite ? 'Danach hat die Website keine Startseite.' : null,
    imMenue ? 'Der Menüpunkt zu dieser Seite wird entfernt.' : null,
  ].filter((x) => x !== null);
  return (
    <ConfirmDialog
      title="Seite löschen?"
      message={`Die Seite „${seite.titel}“ und alles darauf wird aus den Entwürfen gelöscht. Das lässt sich nicht rückgängig machen. ${folgen.join(' ')}`.trim()}
      confirmLabel={laeuft ? 'Wird gelöscht …' : 'Löschen'}
      beschaeftigt={laeuft}
      onCancel={onClose}
      onConfirm={() => {
        setLaeuft(true);
        setFehler(null);
        onLoeschen().catch((e: unknown) => {
          setLaeuft(false);
          setFehler(fehlerMeldung(e));
        });
      }}
    >
      {fehler && (
        <p className={styles.fehlerText} role="alert">
          {fehler.text}
        </p>
      )}
    </ConfirmDialog>
  );
}
