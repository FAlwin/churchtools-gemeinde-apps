import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { ctDaten } from '@ui/ct/verbindung';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { datumText, tagKurz, tagPunkt } from '@shared/ct/datum';
import { gemeindeZeitzone, heuteImKalender, uhrText } from '@shared/ct/zeit';
import type { Person } from '@shared/organigramm/mitglieder';
import {
  angelegte,
  zeilenOhneEvent,
  zusammenfassung,
  type TagErgebnis,
} from '@shared/protokolle/reiheEventAnlegen';
import {
  eventFenster,
  eventsZurZeile,
  istTag,
  naechstesDatum,
  neueZeile,
  reiheEventsAus,
  reiheFehlt,
  zeileMitEvent,
  type ReiheEvent,
  type ReiheZeile,
  type Themenreihe,
} from '@shared/protokolle/themenreihe';
import { eventsPfad } from './eventsLesen';
import { ReiheEventAnlegenFenster } from './ReiheEventAnlegenFenster';
import type { MitarbeitOrt } from './mitarbeitWerte';
import { themenreiheSpeichern, ReiheGeaendert } from './themenreiheSchreiben';
import felder from './Fensterfelder.module.scss';
import styles from './ReiheFenster.module.scss';

/**
 * **Fenster „Reihe“** (Baustein „Reihe“, Entwurf `reihe-events-v1`): der Name und je Abend eine Karte mit Datum, Event, Thema,
 * Wer, Bibelstelle und Notiz; „+ Abend“ schlägt das Datum eine Woche nach dem letzten vor. Wer: Vorschläge aus den
 * Gruppenmitgliedern, ein freier Name ist erlaubt. Die Events zu einem Abend werden erst beim Antippen gelesen
 * (`GET /events`, ±7 Tage – 429-Lehre). Gespeichert wird in „Mitarbeit“ (`themenreiheSpeichern`); hat jemand die Reihe
 * inzwischen anders gespeichert, wird nichts überschrieben.
 */
export function ReiheFenster({
  reihe,
  neu,
  mitglieder,
  ort,
  ich,
  gruppenwahl,
  eventAnlegen,
  onGespeichert,
  onClose,
}: {
  /** Die Reihe beim Öffnen – bei einer neuen mit schon vergebener ID und leerem Namen. */
  reihe: Themenreihe;
  neu: boolean;
  mitglieder: readonly Person[] | 'verborgen' | null;
  ort: MitarbeitOrt;
  ich: { person: number };
  /**
   * Nur bei „Neue Reihe“ aus dem Reiter „Reihen“ mit mehr als einer Gruppe: das Feld „Gruppe“. Die Wahl liegt beim Aufrufer
   * (`ort` und die Mitglieder folgen ihr, das Fenster bleibt stehen); gespeichert wird in die gewählte Gruppe.
   */
  gruppenwahl?: {
    gruppen: readonly { id: number; name: string }[];
    gewaehlt: number;
    onWahl: (gruppe: number) => void;
  };
  /**
   * Kalender, in denen die Person Termine **und** Events anlegen darf (`kalenderMitEvents`) – leer oder fehlend: keine Knöpfe
   * „Event neu anlegen“. Stabil halten (das Fenster „Event anlegen“ liest die Kalender neu, sobald sich die Liste ändert).
   */
  eventAnlegen?: readonly number[];
  onGespeichert: (r: Themenreihe) => void;
  onClose: () => void;
}) {
  // Der Stand beim Öffnen – damit das Speichern merkt, ob jemand dazwischen gespeichert hat.
  const [gesehen] = useState(reihe);
  const [name, setName] = useState(reihe.name);
  const [zeilen, setZeilen] = useState<ReiheZeile[]>(reihe.zeilen);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [wahlFuer, setWahlFuer] = useState<string | null>(null);
  // Das Fenster „Event anlegen“: für welche Abende (Zeilen-IDs) – und danach die eine Zusammenfassung.
  const [anlegenFuer, setAnlegenFuer] = useState<string[] | null>(null);
  const [angelegt, setAngelegt] = useState<ReturnType<typeof zusammenfassung> | null>(null);
  // Die Meldung steht unter den Abenden – bei langen Reihen außer Sicht. Nach jedem Anlegen ins Bild holen. Rumpf in
  // geschweiften Klammern: `scrollIntoView` liefert in Chrome 152 ein Promise, das kein Aufräumer sein darf.
  const angelegtRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (angelegt) angelegtRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [angelegt]);
  // Ein Speichern wurde versucht: Die Gruppe ist ab jetzt gesperrt. Ein vorübergehender Fehler kann schon in Gruppe A
  // geschrieben haben – ein Wechsel auf B legte beim zweiten Versuch mit derselben ID ein Doppel an.
  const [versucht, setVersucht] = useState(false);

  const fehlt = reiheFehlt({ name, zeilen });
  const geaendert =
    name !== gesehen.name || JSON.stringify(zeilen) !== JSON.stringify(gesehen.zeilen);
  const namen = useMemo(
    () => (Array.isArray(mitglieder) ? (mitglieder as readonly Person[]) : []),
    [mitglieder],
  );

  const set = (id: string, f: Partial<ReiheZeile>) =>
    setZeilen((l) => l.map((z) => (z.id === id ? { ...z, ...f } : z)));

  async function speichern(): Promise<void> {
    if (fehlt) return;
    setVersucht(true);
    setLaeuft(true);
    setFehler(null);
    try {
      const r = await themenreiheSpeichern(
        ort,
        { ...reihe, gruppe: gruppenwahl ? gruppenwahl.gewaehlt : reihe.gruppe, name, zeilen },
        neu ? null : gesehen,
        ich.person,
        new Date().toISOString(),
      );
      onGespeichert(r);
    } catch (e) {
      setFehler(e instanceof ReiheGeaendert ? e.message : fehlerMeldung(e).text);
    } finally {
      setLaeuft(false);
    }
  }

  const darfAnlegen = !!eventAnlegen && eventAnlegen.length > 0;
  const ohneEvent = darfAnlegen ? zeilenOhneEvent(zeilen) : [];
  const anlegenAbende = zeilen.filter((z) => anlegenFuer?.includes(z.id));

  /** Das Fenster „Event anlegen“ ist durch: die neuen Events in die Zeilen, die Zusammenfassung zeigen. */
  function angelegtUebernehmen(ergebnisse: TagErgebnis[]): void {
    const neue = angelegte(ergebnisse);
    setZeilen((l) =>
      l.map((z) => {
        const n = neue.find((x) => x.id === z.id);
        return n ? zeileMitEvent(z, n.event) : z;
      }),
    );
    setAngelegt(zusammenfassung(ergebnisse));
    setAnlegenFuer(null);
  }

  const wahlZeile = zeilen.find((z) => z.id === wahlFuer);
  return (
    <>
      <Sheet
        title={neu ? 'Neue Reihe' : 'Reihe'}
        onClose={onClose}
        breit
        beschaeftigt={laeuft}
        // Ein Tipp daneben soll nichts verwerfen, was man eingetippt hat.
        onHintergrund={geaendert ? () => {} : undefined}
        knoepfe={
          <FensterKnopf
            disabled={laeuft || !!fehlt || (!neu && !geaendert)}
            onClick={() => void speichern()}
          >
            {laeuft ? 'Speichert …' : 'Speichern'}
          </FensterKnopf>
        }
      >
        {gruppenwahl && (
          <label className={felder.feld}>
            <span>Gruppe</span>
            <select
              className={felder.eingabe}
              value={gruppenwahl.gewaehlt}
              disabled={laeuft || versucht}
              onChange={(e) => gruppenwahl.onWahl(Number(e.target.value))}
            >
              {gruppenwahl.gruppen.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={felder.feld}>
          <span>Name der Reihe</span>
          <input
            className={felder.eingabe}
            value={name}
            maxLength={120}
            placeholder="z. B. Jona – Gott gibt nicht auf"
            autoFocus={neu}
            disabled={laeuft}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <ul className={styles.zeilen} aria-label="Abende">
          {zeilen.map((z, i) => (
            <li key={z.id} className={styles.abend}>
              <div className={styles.abendKopf}>
                <b>Abend {i + 1}</b>
                <ZeilenKnopf
                  label={`Abend ${i + 1} entfernen`}
                  disabled={laeuft}
                  onClick={() => setZeilen((l) => l.filter((x) => x.id !== z.id))}
                >
                  <Icon name="trash" size={16} />
                </ZeilenKnopf>
              </div>
              <div className={styles.raster}>
                <label className={styles.klein}>
                  <span>Datum</span>
                  <input
                    type="date"
                    className={styles.eingabe}
                    aria-label={`Datum Abend ${i + 1}`}
                    value={z.datum}
                    disabled={laeuft}
                    onChange={(e) => set(z.id, { datum: e.target.value })}
                  />
                </label>
                <div className={styles.klein}>
                  <span>Event</span>
                  <span className={styles.event}>
                    <Icon name="calendar" size={14} />
                    <TextKnopf disabled={laeuft || !z.datum} onClick={() => setWahlFuer(z.id)}>
                      {z.eventId !== null ? z.eventTitel || `Event ${z.eventId}` : 'Event wählen'}
                    </TextKnopf>
                  </span>
                </div>
                <label className={`${styles.klein} ${styles.breit}`}>
                  <span>Thema</span>
                  <input
                    className={styles.eingabe}
                    value={z.thema}
                    disabled={laeuft}
                    onChange={(e) => set(z.id, { thema: e.target.value })}
                  />
                </label>
                <label className={styles.klein}>
                  <span>Wer</span>
                  <input
                    className={styles.eingabe}
                    list={`reihe-wer-${z.id}`}
                    value={z.wer?.name ?? ''}
                    placeholder="Name"
                    disabled={laeuft}
                    onChange={(e) => {
                      const text = e.target.value;
                      const p = namen.find((x) => x.name === text);
                      set(z.id, {
                        wer: text.trim() === '' ? null : { personId: p ? p.id : null, name: text },
                      });
                    }}
                  />
                  <datalist id={`reihe-wer-${z.id}`}>
                    {namen.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </label>
                <label className={styles.klein}>
                  <span>Bibelstelle</span>
                  <input
                    className={styles.eingabe}
                    value={z.bibelstelle}
                    disabled={laeuft}
                    onChange={(e) => set(z.id, { bibelstelle: e.target.value })}
                  />
                </label>
                <label className={`${styles.klein} ${styles.breit}`}>
                  <span>Notiz</span>
                  <textarea
                    className={`${styles.eingabe} ${styles.notiz}`}
                    rows={2}
                    value={z.notiz}
                    disabled={laeuft}
                    onChange={(e) => set(z.id, { notiz: e.target.value })}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.fuss}>
          <TextKnopf
            disabled={laeuft}
            onClick={() =>
              setZeilen((l) => [
                ...l,
                neueZeile(crypto.randomUUID(), naechstesDatum(l, heuteImKalender())),
              ])
            }
          >
            + Abend
          </TextKnopf>
          {ohneEvent.length > 0 && (
            <TextKnopf
              disabled={laeuft}
              onClick={() => {
                setAngelegt(null);
                setAnlegenFuer(ohneEvent.map((z) => z.id));
              }}
            >
              {ohneEvent.length === 1
                ? 'Event für 1 Abend anlegen …'
                : `Events für ${ohneEvent.length} Abende anlegen …`}
            </TextKnopf>
          )}
        </div>
        {angelegt && (
          <div ref={angelegtRef} className={styles.zusammen} role="status">
            <p>{angelegt.kopf}</p>
            {angelegt.meldungen.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
        {mitglieder === 'verborgen' && (
          <p className={felder.leise}>
            Die Mitglieder der Gruppe lassen sich nicht anzeigen – bei „Wer“ geht nur ein freier
            Name.
          </p>
        )}
        {gruppenwahl && versucht && (
          <p className={felder.leise}>
            Die Gruppe lässt sich nicht mehr ändern, sobald du gespeichert hast.
          </p>
        )}
        {fehlt && geaendert && <p className={felder.leise}>{fehlt}</p>}
        {fehler && (
          <p className={felder.fehler} role="alert">
            {fehler}
          </p>
        )}
      </Sheet>
      {wahlZeile && (
        <EventWahl
          zeile={wahlZeile}
          vergeben={
            new Set(
              zeilen
                .filter((x) => x.id !== wahlZeile.id)
                .flatMap((x) => (x.eventId ? [x.eventId] : [])),
            )
          }
          onWahl={(e) => {
            setZeilen((l) => l.map((x) => (x.id === wahlZeile.id ? zeileMitEvent(x, e) : x)));
            setWahlFuer(null);
          }}
          onKeins={() => {
            set(wahlZeile.id, { eventId: null, eventTitel: '' });
            setWahlFuer(null);
          }}
          onAnlegen={
            darfAnlegen && istTag(wahlZeile.datum)
              ? () => {
                  setWahlFuer(null);
                  setAngelegt(null);
                  setAnlegenFuer([wahlZeile.id]);
                }
              : undefined
          }
          onClose={() => setWahlFuer(null)}
        />
      )}
      {anlegenAbende.length > 0 && eventAnlegen && (
        <ReiheEventAnlegenFenster
          abende={anlegenAbende}
          reiheName={name}
          kalender={eventAnlegen}
          onFertig={angelegtUebernehmen}
          onClose={() => setAnlegenFuer(null)}
        />
      )}
    </>
  );
}

/**
 * **Event wählen** (Entwurf: „Events der Jugend um dieses Datum“): `GET /events` für ±7 Tage – erst jetzt, beim Antippen –,
 * die am Tag selbst zuerst, dann nach Abstand. Ein Event, das schon zu einem anderen Abend gehört, wird nicht angeboten.
 * Wer eins wählt, übernimmt Titel **und den Tag des Events** in die Zeile.
 */
function EventWahl({
  zeile,
  vergeben,
  onWahl,
  onKeins,
  onAnlegen,
  onClose,
}: {
  zeile: ReiheZeile;
  vergeben: ReadonlySet<number>;
  onWahl: (e: ReiheEvent) => void;
  onKeins: () => void;
  /** Nur mit Recht und Datum: „+ Event am … neu anlegen …“ (öffnet das Fenster „Event anlegen“ für diesen Abend). */
  onAnlegen?: () => void;
  onClose: () => void;
}) {
  const zeitzone = gemeindeZeitzone();
  const { stand, neu } = useLaden(async () => {
    const f = eventFenster(zeile.datum);
    return reiheEventsAus(await ctDaten<unknown>(eventsPfad(f.von, f.bis)), zeitzone);
  }, [zeile.datum, zeitzone]);
  const [gewaehlt, setGewaehlt] = useState<number | null>(zeile.eventId);
  const liste = stand.art === 'fertig' ? eventsZurZeile(zeile.datum, stand.daten, vergeben) : [];
  const amTag = liste.some((x) => x.amTag);
  const ev = liste.find((x) => x.event.id === gewaehlt)?.event;
  return (
    <Sheet
      title={`Event für ${datumText(zeile.datum)}`}
      onClose={onClose}
      mittel
      knoepfe={
        <FensterKnopf disabled={!ev} onClick={() => ev && onWahl(ev)}>
          Übernehmen
        </FensterKnopf>
      }
      links={
        zeile.eventId !== null ? (
          <FensterKnopf art="loeschen" onClick={onKeins}>
            Zuordnung entfernen
          </FensterKnopf>
        ) : undefined
      }
    >
      {stand.art === 'laedt' && <p className={styles.stand}>Events werden gelesen …</p>}
      {stand.art === 'fehler' && (
        <p className={styles.stand} role="alert">
          {stand.fehler.text}{' '}
          {stand.fehler.nochmal && <TextKnopf onClick={neu}>Erneut versuchen</TextKnopf>}
        </p>
      )}
      {stand.art === 'fertig' && (
        <div className={styles.liste} role="radiogroup" aria-label="Events">
          <p className={styles.stand}>Events um dieses Datum:</p>
          {liste.map(({ event }) => (
            <label key={event.id} className={styles.wahl}>
              <input
                type="radio"
                name="reihe-event"
                checked={gewaehlt === event.id}
                onChange={() => setGewaehlt(event.id)}
              />
              <span>
                <b>
                  {tagKurz(event.tag)} · {uhrText(event.startDate, zeitzone)} · {event.name}
                </b>
              </span>
            </label>
          ))}
          {!amTag && (
            <p className={styles.stand}>Am {datumText(zeile.datum)} gibt es kein Event.</p>
          )}
          {onAnlegen && (
            <TextKnopf onClick={onAnlegen}>
              + Event am {tagPunkt(zeile.datum)} neu anlegen …
            </TextKnopf>
          )}
        </div>
      )}
    </Sheet>
  );
}
