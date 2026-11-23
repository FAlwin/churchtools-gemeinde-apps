import { useEffect, useMemo, useRef, useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { useNeuAnlegen } from '@ui/bedienung/NeuAnlegen';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import type { Schreiber } from '@shared/ct/sperre';
import { seitenLage } from '@shared/website/freigabe';
import type { Menue, Seite } from '@shared/website/modell';
import type { SeitenStatus } from '@shared/website/status';
import { darfFreigeben, type Zugang } from '@shared/website/zugang';
import {
  hatStartseite,
  menueOhneSeite,
  neueStartseite,
  seitenFuerListe,
} from '@shared/website/seitenListe';
import { FreigabeBand, FreigabeLeiste } from './FreigabeLeiste';
import { mailHinweis, misserfolg, seitenEtikett, type MailZweck } from './freigabeAnzeige';
import { mailAnLeitung, mailFreigaben, type MailErgebnis } from './mailVersand';
import { Hinweis, Leise } from './Hinweis';
import { ListenZeile } from './ListenZeile';
import { NeueSeite } from './NeueSeite';
import type { Rechte } from './regeln';
import { Seitenarbeit } from './Seitenarbeit';
import type { Ansicht } from './Vorschau';
import {
  gebeFrei,
  ladeOnline,
  ladeWebsite,
  loescheSeite,
  setzeStatus,
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
 * **Freigabe (W3b-2):** Mit `freigabe` kennt die Liste auch „Veröffentlicht“ (Online-Stand, gelesen von allen Rollen). Die Seite
 * trägt dann ein Etikett (Entwurf · Eingereicht · Zurück · Online …); ein Redakteur reicht ein und fragt das Löschen an, die
 * Leitung veröffentlicht direkt. Eine Seite mit nicht gespeicherten Änderungen lässt sich nicht einreichen oder
 * veröffentlichen – sonst ginge etwas anderes online als das, was man sieht.
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
  freigabe,
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
  /** Ohne: kein Freigabe-Weg (alte Aufrufer, Tests). */
  freigabe?: {
    zugang: Zugang;
    /** Die Kategorie „Veröffentlicht“. */
    veroeffentlicht: number;
    /** Nach jedem Statuswechsel und jedem Veröffentlichen: Der Zähler am Reiter „Freigaben“ liest neu. */
    onGeaendert: () => void;
    /** Die Website-Gruppe – an ihre Leitung gehen die Mails beim Einreichen und Löschen anfragen (W3b-3). */
    gruppe: number;
  };
}) {
  const { modul, kategorie } = ort;
  const geladen = useLaden(() => ladeWebsite({ modul, kategorie }), [modul, kategorie], {
    behalten: true,
  });
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>('computer');
  const [neu, setNeu] = useState(false);
  const [loeschen, setLoeschen] = useState<Seite | null>(null);
  /** Die Rückfrage „Löschen anfragen?“ (Redakteur, E-W23) – für diese Seite. */
  const [anfragen, setAnfragen] = useState<Seite | null>(null);
  /** Etwas, das gelang, aber nicht ganz (z. B. online, doch der Status blieb) – ruhig, kein Fehler. */
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /** Ist an der gezeigten Seite etwas noch nicht gespeichert? Dann bleibt man auf ihr. */
  const [ungespeichert, setUngespeichert] = useState(false);

  const zaehlerBeimOeffnen = useRef(einstellungenStand);
  // **Der Server bleibt die einzige Quelle**: Hier wird nichts Eigenes gehalten, nur nachgelesen und – ausschließlich – die
  // Einstellungen im gelesenen Stand ersetzt. Seiten, Menü, Sperren und die offene Bearbeitung (`Seitenarbeit` hält ihre
  // eigene Arbeitskopie) bleiben unberührt. Späte Antworten und Fehler regelt `useLaden` (Wächter `ladenAufruf`: kein
  // handgeschriebener Ladeblock). Beim Öffnen gibt es nichts nachzulesen (`null` = aus).
  const nachgelesen = useLaden(
    () =>
      einstellungenStand === zaehlerBeimOeffnen.current
        ? null
        : ladeWebsite({ modul, kategorie }).then((w) => ({ einstellungen: w.einstellungen })),
    [einstellungenStand, modul, kategorie],
  );
  const { setze } = geladen;
  useEffect(() => {
    if (nachgelesen.stand.art !== 'fertig') return;
    const { einstellungen } = nachgelesen.stand.daten;
    setze((alt) => ({ ...alt, einstellungen }));
  }, [nachgelesen.stand, setze]);
  /** Das Nachlesen ist gescheitert – die Vorschau zeigt die bisherigen (vorübergehend ist nicht ungültig); der nächste
   *  gelungene Speicherstand versucht es wieder. */
  const einstellungenAlt = nachgelesen.stand.art === 'fehler';

  // Der Online-Stand (W3b-2): nur gelesen, nie geschrieben; scheitert das Lesen, bleibt „unbekannt“ (nichts Falsches anzeigen).
  const veroeffentlicht = freigabe?.veroeffentlicht;
  const kategorien =
    veroeffentlicht !== undefined ? { modul, entwuerfe: kategorie, veroeffentlicht } : null;
  const online = useLaden(
    () =>
      veroeffentlicht !== undefined
        ? ladeOnline({ modul, entwuerfe: kategorie, veroeffentlicht })
        : null,
    [modul, kategorie, veroeffentlicht],
    { behalten: true },
  );
  const onlineStaende = online.stand.art === 'fertig' ? online.stand.daten.staende : null;

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

  const darfFrei = darfFreigeben(freigabe?.zugang ?? null);
  const aktuellStatus: SeitenStatus | null =
    aktuell && stand ? (stand.status[aktuell.id] ?? null) : null;
  const aktuellLage = aktuell && freigabe ? seitenLage(aktuell, onlineStaende) : null;

  /** Den Status einer Seite im gelesenen Stand ersetzen (`null`: entfernt) – ohne neu zu lesen (er wurde nachgelesen). */
  const statusUebernehmen = (id: string, neu: SeitenStatus | null) =>
    geladen.setze((alt) => {
      const status = { ...alt.status };
      if (neu) status[id] = neu;
      else delete status[id];
      return { ...alt, status };
    });

  /** Eine Freigabe-Handlung: Fehler und Meldung einheitlich; **was nicht nachgelesen ist, gilt nicht als geschehen**. */
  const handle = async (tun: () => Promise<void>, nichtGeschehen: string) => {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    try {
      await tun();
    } catch (e) {
      const m = misserfolg(e, nichtGeschehen);
      setFehler({ text: m, nochmal: true });
    } finally {
      setLaeuft(false);
    }
  };

  /** Wohin die Mails gehören (W3b-3). */
  const mailOrt = (gruppe: number) => ({ modul, entwuerfe: kategorie, gruppe });
  /** Der kurze Hinweis zur Mail – hängt an einen schon gesetzten Hinweis an, ersetzt ihn nicht. */
  const hinweisen = (ergebnis: MailErgebnis, zweck: MailZweck) => {
    const h = mailHinweis(ergebnis, zweck);
    if (h) setMeldung((alt) => (alt ? `${alt} ${h}` : h));
  };

  const einreichen = (s: Seite) =>
    kategorien &&
    freigabe &&
    handle(async () => {
      statusUebernehmen(s.id, await setzeStatus(kategorien, s.id, { zustand: 'eingereicht' }, ich));
      freigabe.onGeaendert();
      // Erst jetzt, nachdem der Status geschrieben und nachgelesen ist – und die Mail ändert nichts an dem, was gilt.
      hinweisen(
        await mailAnLeitung(mailOrt(freigabe.gruppe), { art: 'eingereicht', seite: s.titel }, ich),
        'einreichen',
      );
    }, 'Die Seite wurde nicht eingereicht.');

  const loeschenAnfragen = (s: Seite) =>
    kategorien &&
    freigabe &&
    handle(async () => {
      statusUebernehmen(
        s.id,
        await setzeStatus(kategorien, s.id, { zustand: 'loeschenAngefragt' }, ich),
      );
      setAnfragen(null);
      freigabe.onGeaendert();
      hinweisen(
        await mailAnLeitung(
          mailOrt(freigabe.gruppe),
          { art: 'loeschenAngefragt', seite: s.titel },
          ich,
        ),
        'loeschen',
      );
    }, 'Das Löschen wurde nicht angefragt.');

  const veroeffentlichen = (s: Seite) =>
    kategorien &&
    freigabe &&
    handle(async () => {
      // Wer hatte eingereicht? Nur dann geht eine Mail („ist freigegeben“) – gelesen VOR dem Freigeben, danach ist der Status weg.
      const eingereicht =
        stand?.status[s.id]?.zustand === 'eingereicht' ? stand.status[s.id] : null;
      const r = await gebeFrei(kategorien, { einheit: 'seite', id: s.id });
      if (r.statusEntfernt) statusUebernehmen(s.id, null);
      else
        setMeldung(
          r.grund === 'geaendert'
            ? 'Die Seite ist online. Danach wurde sie noch einmal geändert – diese Änderung ist noch nicht freigegeben, die Seite bleibt unter „Freigaben“.'
            : 'Die Seite ist online. Ihr Status ließ sich aber gerade nicht zurücksetzen – unter „Freigaben“ kannst du das noch einmal versuchen.',
        );
      online.neu();
      freigabe.onGeaendert();
      if (eingereicht)
        hinweisen(
          await mailFreigaben(
            mailOrt(freigabe.gruppe),
            [{ titel: s.titel, einreicher: eingereicht.von }],
            ich,
          ),
          'freigeben',
        );
    }, 'Die Seite wurde nicht veröffentlicht – online steht weiter die bisherige Fassung.');

  /** Eine gespeicherte Seite (und ggf. das Menü) in den gelesenen Stand übernehmen – ohne neu zu lesen. */
  const uebernehmen = (neueSeite: Seite, neuesMenue: Menue | null) =>
    geladen.setze((alt) => ({
      ...alt,
      seiten: alt.seiten.some((x) => x.id === neueSeite.id)
        ? alt.seiten.map((x) => (x.id === neueSeite.id ? neueSeite : x))
        : [...alt.seiten, neueSeite],
      menue: neuesMenue ?? alt.menue,
    }));

  // „Neu anlegen“ ist grün (R3): am Rechner der grüne Knopf unter der Seitenliste, am Handy das runde Plus unten rechts.
  // Bis 20.11.2026 ein heller Fensterknopf – der einzige „Neu“-Knopf der Erweiterungen, der nicht grün war.
  const neueSeiteKnopf = useNeuAnlegen({
    label: 'Neue Seite',
    onClick: () => setNeu(true),
    sichtbar: listen !== null,
    disabled: ungespeichert,
  });

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
      {meldung && (
        <div role="status">
          <Leise>{meldung}</Leise>
        </div>
      )}
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
                status={stand.status}
              />
              <ListenGruppe
                titel="Weitere Seiten"
                leer="Keine weiteren Seiten."
                seiten={listen.weitere}
                aktuell={aktuell}
                onWahl={(s) => setGewaehlt(s.id)}
                gesperrt={ungespeichert}
                status={stand.status}
              />
              {neueSeiteKnopf.kopf && (
                <div className={styles.listenFuss}>{neueSeiteKnopf.kopf}</div>
              )}
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
                onLoeschen={() =>
                  freigabe && !darfFrei ? setAnfragen(aktuell) : setLoeschen(aktuell)
                }
                loeschen={
                  !freigabe || darfFrei
                    ? 'loeschen'
                    : aktuellStatus?.zustand === 'loeschenAngefragt'
                      ? 'angefragt'
                      : 'anfragen'
                }
                freigabeLeiste={
                  freigabe && (
                    <FreigabeLeiste
                      status={aktuellStatus}
                      lage={aktuellLage}
                      darfFreigeben={darfFrei}
                      beschaeftigt={laeuft}
                      gesperrt={ungespeichert}
                      onEinreichen={() => void einreichen(aktuell)}
                      onVeroeffentlichen={() => void veroeffentlichen(aktuell)}
                    />
                  )
                }
                freigabeBand={
                  freigabe && <FreigabeBand status={aktuellStatus} darfFreigeben={darfFrei} />
                }
              />
            ) : (
              <section className={styles.arbeit} aria-label="Vorschau">
                <Leise>Noch keine Seite – lege die erste an.</Leise>
              </section>
            )}
          </div>
          {neueSeiteKnopf.schwebend}
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
      {anfragen && (
        <ConfirmDialog
          title="Löschen anfragen?"
          message={`Die Leitung bekommt die Bitte, die Seite „${anfragen.titel}“ zu löschen. Bis sie entscheidet, bleibt die Seite unverändert.`}
          confirmLabel={laeuft ? 'Wird angefragt …' : 'Löschen anfragen'}
          harmlos
          beschaeftigt={laeuft}
          onCancel={() => setAnfragen(null)}
          onConfirm={() => void loeschenAnfragen(anfragen)}
        />
      )}
      {loeschen && stand && (
        <SeiteLoeschen
          seite={loeschen}
          online={
            freigabe !== undefined &&
            ['gleich', 'geaendert'].includes(seitenLage(loeschen, onlineStaende) ?? '')
          }
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
  status,
}: {
  titel: string;
  leer: string;
  seiten: readonly Seite[];
  aktuell: Seite | null;
  onWahl: (s: Seite) => void;
  /** Etwas ist noch nicht gespeichert: Die Seite wechseln geht erst danach. */
  gesperrt: boolean;
  /** Wo steht welche Seite im Freigabe-Weg – ein leises Etikett dort, wo etwas wartet (W3b-2). */
  status: Record<string, SeitenStatus>;
}) {
  return (
    <div className={styles.gruppe}>
      <h3 className={styles.gruppenTitel}>{titel}</h3>
      {seiten.length === 0 && <p className={styles.leer}>{leer}</p>}
      {seiten.map((s) => {
        const e = seitenEtikett(status[s.id] ?? null, null);
        return (
          <ListenZeile
            key={s.id}
            titel={s.titel}
            symbol={s.startseite ? 'home' : 'dokument'}
            aktiv={s.id === aktuell?.id}
            gesperrt={gesperrt && s.id !== aktuell?.id}
            onClick={() => onWahl(s)}
            etikett={
              <>
                {s.startseite && <Etikett>Startseite</Etikett>}
                {e && (
                  <Etikett ton={e.ton} title={e.title}>
                    {e.text}
                  </Etikett>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

function SeiteLoeschen({
  seite,
  online,
  imMenue,
  onLoeschen,
  onClose,
}: {
  seite: Seite;
  /** Steht die Seite (in irgendeiner Fassung) schon auf der Website? Dann bleibt sie dort, bis sie unter „Freigaben“ offline geht. */
  online: boolean;
  imMenue: boolean;
  onLoeschen: () => Promise<void>;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const folgen = [
    seite.startseite ? 'Danach hat die Website keine Startseite.' : null,
    imMenue ? 'Der Menüpunkt zu dieser Seite wird entfernt.' : null,
    online
      ? 'Sie steht schon auf der Website und bleibt dort, bis du sie danach unter „Freigaben“ offline nimmst.'
      : null,
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
