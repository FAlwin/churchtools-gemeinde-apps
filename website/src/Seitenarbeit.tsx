import { useCallback, useMemo, useRef, useState } from 'react';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Icon } from '@ui/icons/icons';
import type { Schreiber } from '@shared/ct/sperre';
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
  uebernimmBearbeitung,
  type Beginn as SeitenBeginn,
  type EntwurfsOrt,
} from './daten';
import { neueId } from './ids';
import type { EditorAktion } from './nachricht';
import type { Rechte } from './regeln';
import { SperrBaender, SpeicherZustand } from './SperrBaender';
import { SEITEN_TEXTE } from './sperrTexte';
import { useSperrarbeit, type Beginn } from './useSperrarbeit';
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

/** Das Ergebnis aus `daten.ts` in der Form des gemeinsamen Ablaufs: die Seite samt Menü ist der gespeicherte Stand. */
function alsBeginn(b: SeitenBeginn): Beginn<Gespeichert> {
  if (b.art === 'gesperrt') return b;
  return { art: 'ok', frisch: b.seite ? { wert: { seite: b.seite, menue: b.menue } } : null };
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

  const sperre = useSperrarbeit<Gespeichert>({
    ich,
    anfangFremd: stand.sperren[seite.id] ?? null,
    anfang: { seite, menue: stand.menue },
    texte: SEITEN_TEXTE,
    beginne: async () => {
      const { ort: o, ich: i } = aktuell.current;
      return alsBeginn(await beginneBearbeiten(o, arbeitRef.current.id, i));
    },
    uebernimm: async () => {
      const { ort: o, ich: i } = aktuell.current;
      return alsBeginn(await uebernimmBearbeitung(o, arbeitRef.current.id, i));
    },
    beende: () => {
      const { ort: o, ich: i } = aktuell.current;
      return beendeBearbeiten(o, arbeitRef.current.id, i);
    },
    gleich: (a, b) => seiteGleich(a.seite, b.seite),
    schreibe: async (wert, gespeichert) => {
      const o = aktuell.current.ort;
      if (!seiteGleich(wert.seite, gespeichert.seite)) await speichereSeite(o, wert.seite);
      if (wert.menue && JSON.stringify(wert.menue) !== JSON.stringify(gespeichert.menue))
        await speichereMenue(o, wert.menue);
    },
    anwenden: ({ seite: s, menue }) => {
      arbeitRef.current = s;
      setArbeit(s);
      menueRef.current = menue;
      setArbeitMenue(menue);
      aktuell.current.onGespeichert(s, menue);
    },
    nachSpeichern: (w) => aktuell.current.onGespeichert(w.seite, w.menue),
    onOffen: (offen) => aktuell.current.onOffen(offen),
  });
  const { schlange, sicherstellen, setHinweis, fremd } = sperre;

  /** Prüfen, in die Arbeitskopie übernehmen und speichern. Liefert die Meldungen, wenn es nicht passt (dann geschieht nichts). */
  const uebernehmen = useCallback(
    (neu: Seite, neuesMenue: Menue | null = null): string[] => {
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
      schlange.anfordern({ seite: neu, menue: menueRef.current });
      return [];
    },
    [schlange],
  );

  /** Nur die Anzeige ändern (Vorschau beim Tippen im Fenster) – gespeichert wird erst bei „Fertig“. */
  const vorschauen = useCallback((neu: Seite) => {
    arbeitRef.current = neu;
    setArbeit(neu);
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
            menueAendern={rechte.menue}
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

  return (
    <section className={styles.arbeit} aria-label="Vorschau">
      <div className={styles.werkzeug}>
        <div className={styles.name}>
          <strong>{arbeit.titel}</strong>
          <span>{arbeit.startseite ? '/' : `/${arbeit.pfad}/`}</span>
        </div>
        <SpeicherZustand stand={sperre.speicher} />
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

      <SperrBaender a={sperre} ich={ich} texte={SEITEN_TEXTE} />

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
