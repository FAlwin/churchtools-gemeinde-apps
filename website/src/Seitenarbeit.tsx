import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Icon } from '@ui/icons/icons';
import { sperreLage, type Schreiber, type Sperre } from '@shared/ct/sperre';
import {
  abschnittEinfuegen,
  abschnittErsetzen,
  abschnittKopieren,
  abschnittLoeschen,
  abschnittVerschieben,
  bausteinEntfernen,
  bausteinErsetzen,
  bausteinHinzufuegen,
  seiteGleich,
  seitePruefen,
} from '@shared/website/bearbeiten';
import type { Abschnitt, Baustein, BausteinTyp, Menue, Seite } from '@shared/website/modell';
import { Speicherschlange, type SchlangenStand } from '@shared/website/schlange';
import type { WebsiteStand } from '@shared/website/speicher';
import { neuerBaustein, type Vorlage } from '@shared/website/vorlagen';
import { AbschnittEinfuegen } from './AbschnittEinfuegen';
import { AbschnittGestalten } from './AbschnittGestalten';
import { BausteinBearbeiten } from './BausteinBearbeiten';
import { BausteinHinzufuegen } from './BausteinHinzufuegen';
import { SeiteEinstellen } from './SeiteEinstellen';
import { Vorschau, type Ansicht } from './Vorschau';
import {
  beendeBearbeiten,
  beginneBearbeiten,
  speichereMenue,
  speichereSeite,
  type EntwurfsOrt,
} from './daten';
import { neueId } from './ids';
import type { EditorAktion } from './nachricht';
import { LEBENSZEICHEN_MS, type Rechte } from './regeln';
import styles from './Seitenarbeit.module.scss';

/** Alle Fenster, die der Editor öffnet – genau eins ist offen (oder keins). */
type Dialog =
  | { art: 'einfuegen'; i: number }
  | { art: 'gestalten'; i: number; sicherung: Abschnitt }
  | { art: 'baustein'; i: number; j: number; k: number; sicherung: Baustein }
  | { art: 'baustein-neu'; i: number; j: number }
  | { art: 'abschnitt-loeschen'; i: number }
  | { art: 'baustein-entfernen'; i: number; j: number; k: number; sicherung: Baustein }
  | { art: 'einstellen' };

interface Gespeichert {
  seite: Seite;
  menue: Menue | null;
}

/** Das Bild der Sperre für die Anzeige: Wer, und ist es dieselbe Person in einem anderen Fenster? */
function fremdText(s: Sperre, ichPerson: number): string {
  return s.von === ichPerson
    ? 'Diese Seite ist gerade in einem anderen Fenster von dir geöffnet und wird dort bearbeitet. Du kannst sie hier ansehen.'
    : `Gerade bearbeitet von ${s.name}. Du kannst die Seite ansehen – ändern kannst du sie, sobald ${s.name} fertig ist.`;
}

/**
 * **Eine Seite bearbeiten – in der Vorschau** (Bauplan Website W3a-2, wie bei Squarespace). Die Arbeitsfläche: Werkzeugleiste
 * (Titel, Computer/Handy, „Seite einstellen“, Speicherzustand), Hinweise zur Sperre und die Vorschau mit der
 * Bearbeiten-Ebene. Alle Fenster und Rechenregeln stehen in eigenen Dateien; hier läuft zusammen, was zusammengehört:
 *
 * - **Die Arbeitskopie** (`arbeit`) gehört diesem Bauteil. Sie wird beim Öffnen aus der gespeicherten Seite genommen und
 *   danach **nie von außen überschrieben** – auch nicht, wenn nach dem Speichern der Stand der Seitenliste neu kommt.
 * - **Jede Änderung geht durch `uebernehmen`:** erst mit dem Schema prüfen (`seitePruefen`), dann in die Arbeitskopie, dann in
 *   die Schlange zum Speichern. Ungültiges wird nie gespeichert; die Meldung steht im Fenster.
 * - **Gespeichert wird eins nach dem anderen** (`Speicherschlange`), und ein Fehler lässt die Arbeitskopie stehen („Erneut
 *   versuchen“, kein Neuladen, das alles überschreibt).
 * - **Die Sperre** (`sperre.ts`) wird beim ersten Handgriff genommen, solange erneuert, wie die Seite offen ist, und beim
 *   Verlassen freigegeben (so gut es geht). Fremd gesperrt: nur ansehen. Vor jedem Speichern wird sie erneut geprüft.
 * - **Die Vorschau** darf nur durch Nachrichten aus ihrem iframe etwas auslösen (`Vorschau`, `nachricht.ts`); **Löschen
 *   fragt immer nach**.
 */
export function Seitenarbeit({
  seite,
  stand,
  ort,
  ich,
  gemeinde,
  ansicht,
  onAnsicht,
  rechte,
  onGespeichert,
  onOffen,
  onLoeschen,
}: {
  /** Die gespeicherte Seite beim Öffnen. */
  seite: Seite;
  stand: WebsiteStand;
  ort: EntwurfsOrt;
  ich: Schreiber;
  gemeinde: string | null;
  ansicht: Ansicht;
  onAnsicht: (a: Ansicht) => void;
  rechte: Rechte;
  /** Nach jedem gelungenen Speichern: Die Seitenliste übernimmt den Stand (ohne neu zu lesen). */
  onGespeichert: (seite: Seite, menue: Menue | null) => void;
  /** Ist etwas noch nicht gespeichert? (Dann bleibt man auf dieser Seite.) */
  onOffen: (offen: boolean) => void;
  /** „Seite löschen“ – das Fenster dafür hat die Seitenliste. */
  onLoeschen: () => void;
}) {
  const [arbeit, setArbeit] = useState<Seite>(seite);
  const [arbeitMenue, setArbeitMenue] = useState<Menue | null>(stand.menue);
  const arbeitRef = useRef(arbeit);
  const menueRef = useRef(arbeitMenue);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [meldungen, setMeldungen] = useState<string[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [speicher, setSpeicher] = useState<SchlangenStand>({ art: 'gespeichert' });
  /** Wer sonst bearbeitet (Anzeige) – `null`: niemand. Beim Öffnen aus dem gelesenen Stand, danach aus jeder Prüfung. */
  const [fremd, setFremd] = useState<Sperre | null>(() => {
    const s = stand.sperren[seite.id] ?? null;
    return s && sperreLage(s, ich, new Date()) === 'fremd' ? s : null;
  });
  /** Gehört die Sperre diesem Fenster? */
  const halte = useRef(false);
  /** Was zuletzt gespeichert oder geladen ist – die Grundlage für „hat jemand anderes etwas geändert?“. */
  const letzte = useRef<Gespeichert>({ seite, menue: stand.menue });
  /** Alles, was ein (vielleicht halb gelungener) Speicherversuch geschrieben haben kann. */
  const versucht = useRef<Seite[]>([]);
  const lauf = useRef<Promise<boolean> | null>(null);

  const aktuell = useRef({ stand, ort, ich, onGespeichert, onOffen });
  aktuell.current = { stand, ort, ich, onGespeichert, onOffen };

  const andereSeiten = useMemo(
    () => stand.seiten.filter((s) => s.id !== seite.id),
    [stand.seiten, seite.id],
  );
  const vorschauStand = useMemo(
    () => ({
      seiten: stand.seiten.some((s) => s.id === arbeit.id)
        ? stand.seiten.map((s) => (s.id === arbeit.id ? arbeit : s))
        : [...stand.seiten, arbeit],
      menue: arbeitMenue,
      einstellungen: stand.einstellungen,
    }),
    [stand.seiten, stand.einstellungen, arbeit, arbeitMenue],
  );

  // ── Speichern ──────────────────────────────────────────────────────────────────────────────────────────────

  const schlange = useRef<Speicherschlange<Gespeichert> | null>(null);
  schlange.current ??= new Speicherschlange<Gespeichert>(async (wert) => {
    const { ort: o, ich: i, onGespeichert: fertig } = aktuell.current;
    // Unmittelbar vor dem Schreiben: Gehört die Sperre noch uns? Und hat niemand die Seite inzwischen geändert?
    const b = await beginneBearbeiten(o, wert.seite.id, i);
    if (b.art === 'gesperrt') {
      halte.current = false;
      setFremd(b.sperre);
      return { art: 'gesperrt' };
    }
    halte.current = true;
    setFremd(null);
    const gespeichert = letzte.current;
    const kennt = (s: Seite) =>
      seiteGleich(s, gespeichert.seite) || versucht.current.some((v) => seiteGleich(s, v));
    if (!b.seite || !kennt(b.seite)) return { art: 'veraendert' };
    if (!seiteGleich(wert.seite, gespeichert.seite)) {
      versucht.current.push(wert.seite);
      await speichereSeite(o, wert.seite);
    }
    if (wert.menue && JSON.stringify(wert.menue) !== JSON.stringify(gespeichert.menue))
      await speichereMenue(o, wert.menue);
    letzte.current = wert;
    versucht.current = [];
    fertig(wert.seite, wert.menue);
    return { art: 'ok' };
  }, setSpeicher);

  const offen = speicher.art !== 'gespeichert';
  useEffect(() => {
    aktuell.current.onOffen(offen);
  }, [offen]);
  // Eine Seite mit ungespeicherten Änderungen verlässt man nicht aus Versehen.
  useEffect(() => {
    if (!offen) return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [offen]);

  /** Prüfen, in die Arbeitskopie übernehmen und speichern. Liefert die Meldungen, wenn es nicht passt (dann geschieht nichts). */
  const uebernehmen = useCallback((neu: Seite, neuesMenue: Menue | null = null): string[] => {
    const menue = neuesMenue ?? menueRef.current;
    const probleme = seitePruefen(
      neu,
      aktuell.current.stand.seiten,
      menue,
      aktuell.current.stand.einstellungen,
    );
    if (probleme.length > 0) return probleme;
    arbeitRef.current = neu;
    setArbeit(neu);
    if (neuesMenue) {
      menueRef.current = neuesMenue;
      setArbeitMenue(neuesMenue);
    }
    schlange.current!.anfordern({ seite: neu, menue: menueRef.current });
    return [];
  }, []);

  /** Nur die Anzeige ändern (Vorschau beim Tippen im Fenster) – gespeichert wird erst bei „Fertig“. */
  const vorschauen = useCallback((neu: Seite) => {
    arbeitRef.current = neu;
    setArbeit(neu);
  }, []);

  /** Die Arbeitskopie bewusst durch den gespeicherten Stand ersetzen. */
  const uebernimmFrisch = useCallback((frisch: Seite, menue: Menue | null) => {
    arbeitRef.current = frisch;
    setArbeit(frisch);
    menueRef.current = menue;
    setArbeitMenue(menue);
    letzte.current = { seite: frisch, menue };
    versucht.current = [];
    aktuell.current.onGespeichert(frisch, menue);
  }, []);

  // ── Sperre ─────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Vor dem ersten Handgriff: die Sperre nehmen. `true` = es darf losgehen. `false` = nein (fremd gesperrt, die Seite hat sich
   * inzwischen geändert und wurde neu geladen, oder ChurchTools antwortet nicht) – der Grund steht dann im Hinweis.
   * Gleichzeitige Aufrufe teilen sich ein Ergebnis.
   */
  const sicherstellen = useCallback((): Promise<boolean> => {
    if (halte.current) return Promise.resolve(true);
    lauf.current ??= (async () => {
      try {
        const { ort: o, ich: i } = aktuell.current;
        const b = await beginneBearbeiten(o, arbeitRef.current.id, i);
        if (b.art === 'gesperrt') {
          setFremd(b.sperre);
          return false;
        }
        halte.current = true;
        setFremd(null);
        if (!b.seite) {
          setHinweis('Diese Seite gibt es nicht mehr. Bitte lade die Seitenliste neu.');
          return false;
        }
        if (!seiteGleich(b.seite, letzte.current.seite)) {
          uebernimmFrisch(b.seite, b.menue);
          setHinweis(
            'Die Seite wurde inzwischen von jemand anderem geändert und ist neu geladen. Bitte versuche es noch einmal.',
          );
          return false;
        }
        return true;
      } catch (e) {
        setHinweis(fehlerMeldung(e).text);
        return false;
      } finally {
        lauf.current = null;
      }
    })();
    return lauf.current;
  }, [uebernimmFrisch]);

  // Lebenszeichen, solange die Sperre bei uns liegt.
  useEffect(() => {
    if (fremd !== null) return;
    const takt = setInterval(() => {
      if (!halte.current) return;
      const { ort: o, ich: i } = aktuell.current;
      beginneBearbeiten(o, arbeitRef.current.id, i).then(
        (b) => {
          if (b.art === 'gesperrt') {
            halte.current = false;
            setFremd(b.sperre);
          }
        },
        () => {
          // Ein Aussetzer ist kein Verlust: Das nächste Lebenszeichen (oder das Speichern) versucht es wieder.
        },
      );
    }, LEBENSZEICHEN_MS);
    return () => clearInterval(takt);
  }, [fremd]);

  // Beim Verlassen freigeben – so gut es geht (sonst verfällt die Sperre nach zehn Minuten von selbst).
  useEffect(() => {
    const frei = () => {
      if (!halte.current) return;
      halte.current = false;
      const { ort: o, ich: i } = aktuell.current;
      beendeBearbeiten(o, arbeitRef.current.id, i).catch(() => {});
    };
    window.addEventListener('pagehide', frei);
    return () => {
      window.removeEventListener('pagehide', frei);
      frei();
    };
  }, []);

  // ── Aktionen aus der Vorschau ──────────────────────────────────────────────────────────────────────────────

  const schliessen = () => {
    setDialog(null);
    setMeldungen([]);
  };

  const aktion = async (a: EditorAktion) => {
    setHinweis(null);
    if (!(await sicherstellen())) return;
    const s = arbeitRef.current;
    const leistenAktion = (neu: Seite) => {
      const p = uebernehmen(neu);
      if (p.length > 0) setHinweis(`Das geht so nicht: ${p.join(' ')}`);
    };
    switch (a.was) {
      case 'einfuegen':
        return setDialog({ art: 'einfuegen', i: a.i });
      case 'gestalten':
        return setDialog({ art: 'gestalten', i: a.i, sicherung: s.abschnitte[a.i] });
      case 'hoch':
      case 'runter':
        return leistenAktion(abschnittVerschieben(s, a.i, a.was));
      case 'kopieren':
        return leistenAktion(abschnittKopieren(s, a.i, neueId));
      case 'loeschen':
        // Nie ohne Rückfrage – auch nicht, wenn die Nachricht aus dem iframe gefälscht wäre (nachricht.ts).
        return setDialog({ art: 'abschnitt-loeschen', i: a.i });
      case 'baustein':
        return setDialog({
          art: 'baustein',
          i: a.i,
          j: a.j,
          k: a.k,
          sicherung: s.abschnitte[a.i].spalten[a.j].bausteine[a.k],
        });
      case 'baustein-neu':
        return setDialog({ art: 'baustein-neu', i: a.i, j: a.j });
    }
  };
  const aktionRef = useRef(aktion);
  aktionRef.current = aktion;
  const beiAktion = useCallback((a: EditorAktion) => void aktionRef.current(a), []);
  const bearbeiten = useMemo(() => ({ onAktion: beiAktion }), [beiAktion]);

  const einstellen = async () => {
    setHinweis(null);
    if (await sicherstellen()) setDialog({ art: 'einstellen' });
  };

  /** „Neu laden“ nach einer Abweisung: der gespeicherte Stand ersetzt die Arbeitskopie – bewusst, mit Folge. */
  const neuLaden = async () => {
    schlange.current!.verwerfen();
    setSpeicher({ art: 'gespeichert' });
    halte.current = false;
    try {
      const { ort: o, ich: i } = aktuell.current;
      const b = await beginneBearbeiten(o, arbeitRef.current.id, i);
      if (b.art === 'gesperrt') return setFremd(b.sperre);
      halte.current = true;
      setFremd(null);
      if (b.seite) uebernimmFrisch(b.seite, b.menue);
      else setHinweis('Diese Seite gibt es nicht mehr. Bitte lade die Seitenliste neu.');
    } catch (e) {
      setHinweis(fehlerMeldung(e).text);
    }
  };

  // ── Fenster ────────────────────────────────────────────────────────────────────────────────────────────────

  const fensterFertig = () => {
    const p = uebernehmen(arbeitRef.current);
    if (p.length > 0) return setMeldungen(p);
    schliessen();
  };

  const htmlErlaubt = rechte.html;
  const fenster = (() => {
    if (!dialog) return null;
    switch (dialog.art) {
      case 'einfuegen':
        return (
          <AbschnittEinfuegen
            rechte={rechte}
            onClose={schliessen}
            onWahl={(v: Vorlage) => {
              const p = uebernehmen(
                abschnittEinfuegen(arbeitRef.current, dialog.i, v.erzeugen(neueId)),
              );
              if (p.length > 0) setMeldungen(p);
              else schliessen();
            }}
          />
        );
      case 'gestalten': {
        const a = arbeit.abschnitte[dialog.i];
        if (!a) return null;
        const abbrechen = () => {
          vorschauen(abschnittErsetzen(arbeitRef.current, dialog.i, dialog.sicherung));
          schliessen();
        };
        return (
          <AbschnittGestalten
            abschnitt={a}
            andereAnker={arbeit.abschnitte.flatMap((x, n) =>
              n === dialog.i ? [] : (x.gestaltung.anker ?? []),
            )}
            einstellungen={stand.einstellungen}
            meldungen={meldungen}
            onAendern={(neu) => vorschauen(abschnittErsetzen(arbeitRef.current, dialog.i, neu))}
            onFertig={fensterFertig}
            onAbbrechen={abbrechen}
          />
        );
      }
      case 'baustein': {
        const b = arbeit.abschnitte[dialog.i]?.spalten[dialog.j]?.bausteine[dialog.k];
        if (!b) return null;
        const abbrechen = () => {
          vorschauen(
            bausteinErsetzen(arbeitRef.current, dialog.i, dialog.j, dialog.k, dialog.sicherung),
          );
          schliessen();
        };
        return (
          <BausteinBearbeiten
            baustein={b}
            kontext={{ seiten: vorschauStand.seiten, seite: arbeit, htmlErlaubt }}
            meldungen={meldungen}
            onAendern={(neu) =>
              vorschauen(bausteinErsetzen(arbeitRef.current, dialog.i, dialog.j, dialog.k, neu))
            }
            onEntfernen={() => setDialog({ ...dialog, art: 'baustein-entfernen' })}
            onFertig={fensterFertig}
            onAbbrechen={abbrechen}
          />
        );
      }
      case 'baustein-entfernen': {
        const b = arbeit.abschnitte[dialog.i]?.spalten[dialog.j]?.bausteine[dialog.k];
        if (!b) return null;
        return (
          <ConfirmDialog
            title="Baustein entfernen?"
            message="Der Baustein wird von der Seite entfernt. Das lässt sich nicht rückgängig machen."
            confirmLabel="Entfernen"
            onCancel={() => setDialog({ ...dialog, art: 'baustein' })}
            onConfirm={() => {
              // Die Sicherung zuerst zurück: Entfernt wird der Baustein, wie er VOR dem Bearbeiten war – nie ein halber.
              const p = uebernehmen(
                bausteinEntfernen(
                  bausteinErsetzen(
                    arbeitRef.current,
                    dialog.i,
                    dialog.j,
                    dialog.k,
                    dialog.sicherung,
                  ),
                  dialog.i,
                  dialog.j,
                  dialog.k,
                ),
              );
              if (p.length > 0) setHinweis(`Das geht so nicht: ${p.join(' ')}`);
              schliessen();
            }}
          />
        );
      }
      case 'baustein-neu':
        return (
          <BausteinHinzufuegen
            rechte={rechte}
            onClose={schliessen}
            onWahl={(typ: BausteinTyp) => {
              const neu = neuerBaustein(typ, neueId);
              const naechste = bausteinHinzufuegen(arbeitRef.current, dialog.i, dialog.j, neu);
              const p = uebernehmen(naechste);
              if (p.length > 0) return setMeldungen(p);
              // Gleich zum Bearbeiten öffnen – der neue steht ganz unten in der Spalte.
              const k = naechste.abschnitte[dialog.i].spalten[dialog.j].bausteine.length - 1;
              setMeldungen([]);
              setDialog({ art: 'baustein', i: dialog.i, j: dialog.j, k, sicherung: neu });
            }}
          />
        );
      case 'abschnitt-loeschen':
        return (
          <ConfirmDialog
            title="Abschnitt löschen?"
            message="Der Abschnitt und alles darin werden von dieser Seite entfernt. Das lässt sich nicht rückgängig machen."
            confirmLabel="Löschen"
            onCancel={schliessen}
            onConfirm={() => {
              const p = uebernehmen(abschnittLoeschen(arbeitRef.current, dialog.i));
              if (p.length > 0) setHinweis(`Das geht so nicht: ${p.join(' ')}`);
              schliessen();
            }}
          />
        );
      case 'einstellen':
        return (
          <SeiteEinstellen
            seite={arbeit}
            menue={arbeitMenue}
            andereSeiten={andereSeiten}
            meldungen={meldungen}
            onClose={schliessen}
            onFertig={(neu, menue) => {
              const p = uebernehmen(neu, menue);
              if (p.length > 0) setMeldungen(p);
              else schliessen();
            }}
            onLoeschen={() => {
              schliessen();
              onLoeschen();
            }}
          />
        );
    }
  })();

  // ── Anzeige ────────────────────────────────────────────────────────────────────────────────────────────────

  const abgewiesen = speicher.art === 'gesperrt' || speicher.art === 'veraendert';
  return (
    <section className={styles.arbeit} aria-label="Vorschau">
      <div className={styles.werkzeug}>
        <div className={styles.name}>
          <strong>{arbeit.titel}</strong>
          <span>{arbeit.startseite ? '/' : `/${arbeit.pfad}/`}</span>
        </div>
        <Zustand stand={speicher} />
        <Segment
          value={ansicht}
          options={[
            { value: 'computer', label: 'Computer' },
            { value: 'handy', label: 'Handy' },
          ]}
          onChange={onAnsicht}
          ariaLabel="Vorschau-Ansicht"
          verbunden
        />
        <KopfKnopf
          label="Seite einstellen"
          symbol={<Icon name="regler" size={16} />}
          disabled={fremd !== null}
          onClick={() => void einstellen()}
        />
      </div>

      {speicher.art === 'fehler' && (
        <div className={styles.band} role="alert">
          <p>
            Nicht gespeichert – {fehlerMeldung(speicher.fehler).text} Deine Änderung ist noch hier
            zu sehen und geht nicht verloren.
          </p>
          <KopfKnopf
            label="Erneut versuchen"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => schlange.current!.nochmal()}
          />
        </div>
      )}
      {fremd && (
        <div className={styles.band} role="status">
          <p>{fremdText(fremd, ich.person)}</p>
          <KopfKnopf
            label="Erneut prüfen"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => void sicherstellen()}
          />
        </div>
      )}
      {abgewiesen && !fremd && (
        <div className={styles.band} role="alert">
          <p>
            Die Seite wurde inzwischen von jemand anderem geändert. Deine Änderungen sind noch nicht
            gespeichert – sonst gingen seine verloren.
          </p>
          <KopfKnopf
            label="Neu laden"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => void neuLaden()}
          />
        </div>
      )}
      {abgewiesen && fremd && speicher.art === 'gesperrt' && (
        <div className={styles.band} role="alert">
          <p>Deine letzten Änderungen sind nicht gespeichert.</p>
          <KopfKnopf
            label="Neu laden"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => void neuLaden()}
          />
        </div>
      )}
      {hinweis && (
        <div className={styles.band} role="alert">
          <p>{hinweis}</p>
        </div>
      )}

      <Vorschau
        seite={arbeit}
        stand={vorschauStand}
        gemeinde={gemeinde}
        ansicht={ansicht}
        bearbeiten={fremd ? undefined : bearbeiten}
      />
      {fenster}
    </section>
  );
}

/** „Speichert … / Gespeichert / Nicht gespeichert“ – kurz, damit die Werkzeugleiste ruhig bleibt; der Grund steht im Band darunter. */
function Zustand({ stand }: { stand: SchlangenStand }) {
  if (stand.art === 'speichert')
    return (
      <span className={styles.zustand} role="status">
        <Icon name="refresh" size={16} />
        Speichert …
      </span>
    );
  if (stand.art === 'fehler' || stand.art === 'gesperrt' || stand.art === 'veraendert')
    return (
      <span className={`${styles.zustand} ${styles.fehler}`}>
        <Icon name="warnung" size={16} />
        Nicht gespeichert
      </span>
    );
  return (
    <span className={styles.zustand} role="status">
      <Icon name="cloud-check" size={16} />
      Gespeichert
    </span>
  );
}
