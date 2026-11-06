import { useEffect, useRef, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf, FensterLink } from '@ui/fenster/FensterKnopf';
import { DateiZeile } from '@ui/dateien/DateiZeile';
import { terminDateiAnzeige } from '@ui/dateien/terminDatei';
import { ctBasis } from '@ui/ct/verbindung';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { nameTeilen } from '@shared/ct/arrangementFiles';
import { dateiAdresse, neuerName, type TerminDatei } from '@shared/ct/terminDateien';
import { dateienAendern, ladeDateien } from './ladeTerminDateien';
import { AnhangHinzufuegen } from './AnhangHinzufuegen';
import infos from './InfosFenster.module.scss';
import styles from './DateienFenster.module.scss';
import { datumUhrText } from '@shared/ct/zeit';

/** Welche Seite das Fenster zeigt. Eine Datei wird über ihre ID gemerkt – ihre Daten kommen aus der aktuellen Liste. */
type Seite =
  | { art: 'liste' }
  | { art: 'hinzufuegen' }
  | { art: 'datei' | 'umbenennen' | 'loeschen'; id: number };

/**
 * **Die Dateien eines Termins** (Scheiben T2a/T2b, Entwurf `termin-einstellungen.html` Variante B, Alwin 02.11.2026):
 * das Fenster hinter der Büroklammer. Sofort steht da, was der Plan kennt (ohne Größe); dann kommt die frische Liste
 * aus ChurchTools mit Größe und geht über `onAktuell` zurück – so stimmt danach auch die Zahl an der Büroklammer. Klappt
 * das Nachladen nicht, bleibt die bekannte Liste stehen: Ein Aussetzer von ChurchTools darf keine Dateien
 * „verschwinden“ lassen. Wer nicht ändern darf, öffnet eine Datei mit einem Tipp aus ChurchTools (`dateiAdresse`).
 *
 * **Ändern (T2b)** nur, wer den Termin ändern darf (`terminAenderbar`): „Anhang hinzufügen“ unten; ein Tipp auf eine
 * Datei zeigt ein kleines Fenster mit „Öffnen“, „Umbenennen“, „Löschen“ und wann/von wem angehängt – wie in ChurchTools
 * (Alwin 03.11.2026, Entwurf `matrix-infos-bearbeiten.html` Variante D1; vorher Stift und Papierkorb an jeder Zeile).
 * Noch keine Dateien und man darf: gleich „Anhang hinzufügen“, wie die Infos gleich im Textfeld öffnen.
 */
export function DateienFenster({
  fuer,
  terminId,
  dateien,
  darf,
  neu: gleichNeu = false,
  datei: gleichDatei,
  onAktuell,
  onClose,
  laden = ladeDateien,
  aendern = dateienAendern,
}: {
  /** „Gottesdienst · So, 08.11.2026“ – steht über der Liste. */
  fuer: string;
  terminId: number;
  /** Was der Plan kennt – steht da, bis die frische Liste kommt. */
  dateien: readonly TerminDatei[];
  /** Darf ich die Dateien ändern? */
  darf: boolean;
  /** Gleich „Anhang hinzufügen“ – die Büroklammer in der Matrix. */
  neu?: boolean;
  /** Gleich das kleine Fenster dieser Datei – eine Datei-Zeile in der Matrix. */
  datei?: number;
  onAktuell: (dateien: TerminDatei[]) => void;
  onClose: () => void;
  /** Nur für Tests. */
  laden?: typeof ladeDateien;
  aendern?: typeof dateienAendern;
}) {
  const direkt = darf && (gleichNeu || dateien.length === 0);
  const [seite, setSeite] = useState<Seite>(
    direkt
      ? { art: 'hinzufuegen' }
      : gleichDatei !== undefined
        ? { art: 'datei', id: gleichDatei }
        : { art: 'liste' },
  );
  // Der Rückruf ändert sich mit jedem Zeichnen der Eltern – nachgeladen wird trotzdem nur einmal je Termin.
  const melden = useRef(onAktuell);
  melden.current = onAktuell;

  // Frisch nachladen; bis dahin gilt die Liste, die der Termin schon kennt. Scheitert es, bleibt sie mit Hinweis stehen.
  const { stand, setze } = useLaden(() => laden(terminId), [terminId, laden]);
  const liste: readonly TerminDatei[] = stand.art === 'fertig' ? stand.daten : dateien;
  const ladeFehler = stand.art === 'fehler';
  // Jede frische Liste – geladen oder nach dem Ändern – auch an die Eltern.
  useEffect(() => {
    if (stand.art === 'fertig') melden.current(stand.daten);
  }, [stand]);

  /** Eine neue Liste nach dem Ändern – hier und (über den Effekt oben) bei den Eltern. */
  function neu(frisch: TerminDatei[]): void {
    setze(frisch);
  }

  const zurListe = () => setSeite({ art: 'liste' });

  if (seite.art === 'hinzufuegen') {
    return (
      <AnhangHinzufuegen
        fuer={fuer}
        terminId={terminId}
        vorhanden={liste}
        onAktuell={neu}
        onFertig={zurListe}
        onClose={onClose}
        zurueck={direkt && liste.length === 0 ? undefined : zurListe}
        aendern={aendern}
      />
    );
  }
  const basis = ctBasis();
  // Die Datei der Seite aus der aktuellen Liste – gibt es sie nicht mehr (woanders gelöscht), zeigt das Fenster die Liste.
  const gewaehlt = seite.art === 'liste' ? undefined : liste.find((d) => d.id === seite.id);
  if (seite.art === 'datei' && gewaehlt) {
    return (
      <DateiAktionen
        datei={gewaehlt}
        href={dateiAdresse(gewaehlt, basis)}
        onUmbenennen={() => setSeite({ art: 'umbenennen', id: gewaehlt.id })}
        onLoeschen={() => setSeite({ art: 'loeschen', id: gewaehlt.id })}
        onZurueck={zurListe}
        onClose={onClose}
      />
    );
  }
  const zurDatei = () => gewaehlt && setSeite({ art: 'datei', id: gewaehlt.id });
  if (seite.art === 'umbenennen' && gewaehlt) {
    return (
      <Umbenennen
        datei={gewaehlt}
        onUmbenennen={(eingabe) => aendern.umbenennen(terminId, gewaehlt.id, eingabe)}
        onFertig={(frisch) => {
          neu(frisch);
          zurListe();
        }}
        onZurueck={zurDatei}
        onClose={onClose}
      />
    );
  }
  if (seite.art === 'loeschen' && gewaehlt) {
    return (
      <Loeschen
        datei={gewaehlt}
        onLoeschen={() => aendern.loeschen(terminId, gewaehlt.id)}
        onFertig={(frisch) => {
          neu(frisch);
          zurListe();
        }}
        onZurueck={zurDatei}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet
      title="Dateien"
      onClose={onClose}
      knoepfe={
        darf ? (
          <FensterKnopf onClick={() => setSeite({ art: 'hinzufuegen' })}>
            Anhang hinzufügen
          </FensterKnopf>
        ) : null
      }
      cancelLabel={null}
    >
      <p className={infos.fuer}>{fuer}</p>
      {liste.length === 0 ? (
        <p className={infos.leer}>An diesem Termin hängen keine Dateien.</p>
      ) : (
        <ul className={infos.dateiListe}>
          {liste.map((d) => {
            const a = terminDateiAnzeige(d);
            return (
              <li key={d.id}>
                {darf ? (
                  <DateiZeile
                    onClick={() => setSeite({ art: 'datei', id: d.id })}
                    symbol={a.symbol}
                    titel={d.name}
                    unter={a.unter}
                  />
                ) : (
                  <DateiZeile
                    href={dateiAdresse(d, basis)}
                    symbol={a.symbol}
                    titel={d.name}
                    unter={a.unter}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {ladeFehler && (
        <p className={infos.hinweis} role="status">
          Die aktuelle Liste ließ sich gerade nicht laden – das ist der zuletzt bekannte Stand.
        </p>
      )}
    </Sheet>
  );
}

/** Wann angehängt, wie ChurchTools es zeigt: „03.11.2026 11:05“ (in der Uhr der Gemeinde, #847). */
function angehaengtText(d: TerminDatei): string | null {
  if (!d.angelegt) return null;
  const zeit = datumUhrText(d.angelegt.am);
  if (!zeit) return null;
  return `Angehängt am ${zeit}${d.angelegt.von ? ` von ${d.angelegt.von}` : ''}`;
}

/**
 * **Das kleine Fenster einer Datei** (T2b, Variante D1 – wie das Fenster an einem Anhang in ChurchTools): Name, Art und
 * Größe, wann und von wem angehängt; „Öffnen“, „Umbenennen“, „Löschen“ (fragt nach).
 */
function DateiAktionen({
  datei,
  href,
  onUmbenennen,
  onLoeschen,
  onZurueck,
  onClose,
}: {
  datei: TerminDatei;
  href: string | null;
  onUmbenennen: () => void;
  onLoeschen: () => void;
  onZurueck: () => void;
  onClose: () => void;
}) {
  const a = terminDateiAnzeige(datei);
  const angehaengt = angehaengtText(datei);
  return (
    <Sheet
      title={datei.name}
      onClose={onClose}
      zurueck={onZurueck}
      cancelLabel={null}
      knoepfe={
        <>
          <FensterKnopf art="loeschen" onClick={onLoeschen}>
            Löschen
          </FensterKnopf>
          <FensterKnopf art="zweit" onClick={onUmbenennen}>
            Umbenennen
          </FensterKnopf>
          {href ? (
            <FensterLink href={href} target="_blank" rel="noopener noreferrer">
              Öffnen
            </FensterLink>
          ) : (
            <FensterKnopf disabled title="Lässt sich hier nicht öffnen">
              Öffnen
            </FensterKnopf>
          )}
        </>
      }
    >
      <p className={infos.text}>{a.unter}</p>
      {angehaengt && <p className={infos.hinweis}>{angehaengt}</p>}
    </Sheet>
  );
}

/** „Umbenennen“ – bei einer Datei steht die Endung fest daneben (dieselbe Regel wie in der Musik-App, `neuerName`). */
function Umbenennen({
  datei,
  onUmbenennen,
  onFertig,
  onZurueck,
  onClose,
}: {
  datei: TerminDatei;
  onUmbenennen: (eingabe: string) => Promise<TerminDatei[]>;
  onFertig: (frisch: TerminDatei[]) => void;
  onZurueck: () => void;
  onClose: () => void;
}) {
  const teile = datei.art === 'datei' ? nameTeilen(datei.name) : { basis: datei.name, endung: '' };
  const [eingabe, setEingabe] = useState(teile.basis);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const pruefung = neuerName(datei, eingabe);
  const gleich = pruefung.name === datei.name;
  const bereit = !laeuft && pruefung.fehler === null && !gleich;

  async function los(): Promise<void> {
    setLaeuft(true);
    setFehler(null);
    try {
      onFertig(await onUmbenennen(eingabe));
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setLaeuft(false);
    }
  }

  return (
    <Sheet
      title={datei.art === 'link' ? 'Link umbenennen' : 'Datei umbenennen'}
      onClose={onClose}
      zurueck={onZurueck}
      onAbbrechen={onZurueck}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={() => void los()}>
          {laeuft ? 'Wird umbenannt …' : 'Umbenennen'}
        </FensterKnopf>
      }
    >
      <form
        className={infos.feld}
        onSubmit={(e) => {
          e.preventDefault();
          if (bereit) void los();
        }}
      >
        <span>Name</span>
        <span className={styles.nameZeile}>
          <input
            className={styles.eingabe}
            aria-label="Name"
            value={eingabe}
            autoFocus
            disabled={laeuft}
            onChange={(e) => setEingabe(e.target.value)}
          />
          {teile.endung && <span className={styles.endung}>{teile.endung}</span>}
        </span>
      </form>
      {(fehler ?? (gleich ? null : pruefung.fehler)) && (
        <p className={infos.fehler} role="alert">
          {fehler ?? pruefung.fehler}
        </p>
      )}
    </Sheet>
  );
}

/** „Löschen“ – fragt nach; wiederherstellen geht nur durch erneutes Hochladen. */
function Loeschen({
  datei,
  onLoeschen,
  onFertig,
  onZurueck,
  onClose,
}: {
  datei: TerminDatei;
  onLoeschen: () => Promise<TerminDatei[]>;
  onFertig: (frisch: TerminDatei[]) => void;
  onZurueck: () => void;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function los(): Promise<void> {
    setLaeuft(true);
    setFehler(null);
    try {
      onFertig(await onLoeschen());
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setLaeuft(false);
    }
  }

  return (
    <Sheet
      title={datei.art === 'link' ? 'Link löschen' : 'Datei löschen'}
      onClose={onClose}
      zurueck={onZurueck}
      onAbbrechen={onZurueck}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf art="gefahr" disabled={laeuft} onClick={() => void los()}>
          {laeuft ? 'Wird gelöscht …' : 'Löschen'}
        </FensterKnopf>
      }
    >
      <p className={infos.text}>
        „{datei.name}“ löschen? Das lässt sich nicht rückgängig machen – nur durch erneutes{' '}
        {datei.art === 'link' ? 'Anhängen' : 'Hochladen'}.
      </p>
      {fehler && (
        <p className={infos.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
