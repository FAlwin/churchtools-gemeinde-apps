import { useEffect, useMemo, useRef, useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import type { Schreiber } from '@shared/ct/sperre';
import type { Menue, Seite } from '@shared/website/modell';
import {
  hatStartseite,
  menueOhneSeite,
  neueStartseite,
  seitenFuerListe,
} from '@shared/website/seitenListe';
import { Hinweis, Leise } from './Hinweis';
import { NeueSeite } from './NeueSeite';
import type { Rechte } from './regeln';
import { Seitenarbeit } from './Seitenarbeit';
import type { Ansicht } from './Vorschau';
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
 * **Seit W3a-2 wird die gezeigte Seite direkt in der Vorschau bearbeitet** (`Seitenarbeit`). Die Liste bekommt nach jedem
 * Speichern den neuen Stand der Seite (`onGespeichert`), ohne neu zu lesen; solange etwas nicht gespeichert ist, lässt sich
 * keine andere Seite wählen – die Arbeitskopie bliebe sonst ohne Besitzer.
 *
 * Eine Website ohne Startseite zeigt einen Hinweis mit dem Knopf „Startseite anlegen“ (Vorlage `start-schriftzug`) –
 * angelegt wird nie von selbst.
 */
export function Seiten({
  ort,
  gemeinde,
  ich,
  rechte,
  einstellungenStand = 0,
}: {
  ort: EntwurfsOrt;
  gemeinde: string | null;
  /** Wer bearbeitet – für die Sperre je Seite (W3a-2). */
  ich: Schreiber;
  rechte: Rechte;
  /**
   * Zählt gelungene Speicherungen der Einstellungen (Fenster „Einstellungen“, Reiter „Aussehen“ – beide in `App`). Ändert
   * er sich, liest dieser Reiter **nur die Einstellungen** neu (W3a-3c). Der Wert beim Öffnen zählt nicht: Da hat das
   * Lesen ohnehin den neuesten Stand geholt.
   */
  einstellungenStand?: number;
}) {
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
  /** Ist an der gezeigten Seite etwas noch nicht gespeichert? Dann bleibt man auf ihr. */
  const [ungespeichert, setUngespeichert] = useState(false);

  /** Das Nachlesen der Einstellungen ist gescheitert – die Vorschau zeigt die bisherigen. */
  const [einstellungenAlt, setEinstellungenAlt] = useState(false);
  const zaehlerBeimOeffnen = useRef(einstellungenStand);
  const { setze } = geladen;
  // **Der Server bleibt die einzige Quelle**: Hier wird nichts Eigenes gehalten, nur nachgelesen und – ausschließlich – die
  // Einstellungen im gelesenen Stand ersetzt. Seiten, Menü, Sperren und die offene Bearbeitung (`Seitenarbeit` hält ihre
  // eigene Arbeitskopie) bleiben unberührt. Scheitert das Lesen, bleibt die bisherige Vorschau stehen (vorübergehend ist
  // nicht ungültig); der nächste gelungene Speicherstand versucht es wieder.
  useEffect(() => {
    if (einstellungenStand === zaehlerBeimOeffnen.current) return;
    let aktuell = true;
    ladeWebsite({ modul, kategorie }).then(
      (neu) => {
        if (!aktuell) return;
        setEinstellungenAlt(false);
        setze((alt) => ({ ...alt, einstellungen: neu.einstellungen }));
      },
      () => aktuell && setEinstellungenAlt(true),
    );
    return () => {
      aktuell = false;
    };
  }, [einstellungenStand, modul, kategorie, setze]);

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

  /** Eine gespeicherte Seite (und ggf. das Menü) in den gelesenen Stand übernehmen – ohne neu zu lesen. */
  const uebernehmen = (neueSeite: Seite, neuesMenue: Menue | null) =>
    geladen.setze((alt) => ({
      ...alt,
      seiten: alt.seiten.some((x) => x.id === neueSeite.id)
        ? alt.seiten.map((x) => (x.id === neueSeite.id ? neueSeite : x))
        : [...alt.seiten, neueSeite],
      menue: neuesMenue ?? alt.menue,
    }));

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
      {einstellungenAlt && (
        <div role="status">
          <Leise>
            Die Vorschau zeigt noch die alten Einstellungen (Name, Fußzeile …) – sie ließen sich
            gerade nicht neu lesen. Beim Wechsel des Reiters oder bei der nächsten Speicherung wird
            es erneut versucht.
          </Leise>
        </div>
      )}

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
                gesperrt={ungespeichert}
              />
              <ListenGruppe
                titel="Weitere Seiten"
                leer="Keine weiteren Seiten."
                seiten={listen.weitere}
                aktuell={aktuell}
                onWahl={(s) => setGewaehlt(s.id)}
                gesperrt={ungespeichert}
              />
              <div className={styles.listenFuss}>
                <FensterKnopf art="hell" disabled={ungespeichert} onClick={() => setNeu(true)}>
                  <Icon name="plus" size={16} />
                  Neue Seite
                </FensterKnopf>
              </div>
            </aside>

            {aktuell ? (
              <Seitenarbeit
                key={aktuell.id}
                seite={aktuell}
                stand={stand}
                ort={ort}
                ich={ich}
                gemeinde={gemeinde}
                ansicht={ansicht}
                onAnsicht={setAnsicht}
                rechte={rechte}
                onGespeichert={(neueSeite, neuesMenue) => uebernehmen(neueSeite, neuesMenue)}
                onOffen={setUngespeichert}
                onLoeschen={() => setLoeschen(aktuell)}
              />
            ) : (
              <section className={styles.arbeit} aria-label="Vorschau">
                <Leise>Noch keine Seite – lege die erste an.</Leise>
              </section>
            )}
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
  gesperrt,
}: {
  titel: string;
  leer: string;
  seiten: readonly Seite[];
  aktuell: Seite | null;
  onWahl: (s: Seite) => void;
  /** Etwas ist noch nicht gespeichert: Die Seite wechseln geht erst danach. */
  gesperrt: boolean;
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
          disabled={gesperrt && s.id !== aktuell?.id}
          onClick={() => onWahl(s)}
        >
          <Icon name={s.startseite ? 'home' : 'dokument'} size={16} />
          <span className={styles.titel}>{s.titel}</span>
          {s.startseite && <Etikett>Startseite</Etikett>}
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
