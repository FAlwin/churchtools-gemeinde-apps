import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Icon } from '@ui/icons/icons';
import type { Schreiber } from '@shared/ct/sperre';
import {
  abschnittDa,
  abschnittEinfuegen,
  abschnittErsetzen,
  abschnittKopieren,
  abschnittLoeschen,
  abschnittVerschiebenNach,
  aufteilungZiehen,
  bausteinDa,
  bausteinEntfernen,
  bausteinErsetzen,
  bausteinHinzufuegen,
  bausteinVerschieben,
  gestaltungAendern,
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
import { SeiteEinstellen, type BereichsWahl } from './SeiteEinstellen';
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
import { textUebernehmen } from './textAenderung';
import {
  LEERER_VERLAUF,
  verlaufMerken,
  verlaufVor,
  verlaufZurueck,
  type Verlauf,
} from './seitenVerlauf';
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
  bereichWahl,
  onGespeichert,
  onOffen,
  onLoeschen,
  loeschen,
  freigabeLeiste,
  freigabeBand,
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
  /** „Bereich“ in „Seite einstellen“ (W3b-4b) – nur für die Leitung der Website; fehlt: kein Feld. */
  bereichWahl?: readonly BereichsWahl[];
  /** Nach jedem gelungenen Speichern: Die Seitenliste übernimmt den Stand (ohne neu zu lesen). */
  onGespeichert: (seite: Seite, menue: Menue | null) => void;
  /** Ist etwas noch nicht gespeichert? (Dann bleibt man auf dieser Seite.) */
  onOffen: (offen: boolean) => void;
  /** „Seite löschen“ – das Fenster dafür hat die Seitenliste. */
  onLoeschen: () => void;
  /** Was „Seite löschen“ im Fenster „Seite einstellen“ heißt (W3b-2): löschen, anfragen (Redakteur), schon angefragt. */
  loeschen?: 'loeschen' | 'anfragen' | 'angefragt';
  /** Etikett und Knopf der Freigabe (W3b-2) – gehören der Seitenliste, die den Online-Stand kennt. */
  freigabeLeiste?: ReactNode;
  /** Das Band darunter (Anmerkung der Leitung, angefragtes Löschen). */
  freigabeBand?: ReactNode;
}) {
  const [arbeit, setArbeit] = useState<Seite>(seite);
  const [arbeitMenue, setArbeitMenue] = useState<Menue | null>(stand.menue);
  const arbeitRef = useRef(arbeit);
  const menueRef = useRef(arbeitMenue);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [meldungen, setMeldungen] = useState<string[]>([]);
  /** Zählt hoch, wenn die Vorschau neu gezeichnet werden muss, obwohl sich die Seite nicht (so) geändert hat – der getippte Text steht dort sonst falsch. */
  const [zeichneNeu, setZeichneNeu] = useState(0);
  /** Rückgängig/Wiederholen dieser Seite (`seitenVerlauf.ts`): gilt nur für diese Sitzung; die Seite entsteht je Seite neu. */
  const [verlauf, setVerlaufState] = useState<Verlauf>(LEERER_VERLAUF);
  const verlaufRef = useRef(verlauf);
  const setVerlauf = useCallback((v: Verlauf) => {
    verlaufRef.current = v;
    setVerlaufState(v);
  }, []);
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
      // Der gespeicherte Stand ersetzt die Arbeitskopie (jemand anderes hat gespeichert, neu geladen): Die Schritte davor
      // gehören zu einer Seite, die es so nicht mehr gibt.
      setVerlauf(LEERER_VERLAUF);
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

  /** Eine Änderung übernehmen **und** als Schritt merken (Rückgängig). `vorher` ist die Seite vor der Änderung. */
  const uebernehmenMitVerlauf = useCallback(
    (neu: Seite, vorher: Seite): string[] => {
      const p = uebernehmen(neu);
      if (p.length === 0) setVerlauf(verlaufMerken(verlaufRef.current, vorher, neu));
      return p;
    },
    [uebernehmen, setVerlauf],
  );

  // ── Aktionen aus der Vorschau ──────────────────────────────────────────────────────────────────────────────

  const schliessen = () => {
    setDialog(null);
    setMeldungen([]);
  };

  /**
   * **Ein Schritt zurück oder vor** (Knöpfe, Strg/Cmd+Z, Nachricht der Vorschau). Wie jede Änderung: erst die Sperre, dann durch
   * Schema und Schlange. Passt die Seite nicht mehr zum Schritt, wird **nichts** überschrieben – der Verlauf ist dann weg.
   * Scheitert nur das Sperre-Nehmen (kein Netz), bleibt der Verlauf erhalten: vorübergehend ist nicht ungültig.
   */
  const gehe = async (zurueck: boolean) => {
    if (dialog) return;
    const v = verlaufRef.current;
    if ((zurueck ? v.zurueck : v.vor).length === 0) return;
    setHinweis(null);
    if (!(await sicherstellen())) return;
    const g = (zurueck ? verlaufZurueck : verlaufVor)(verlaufRef.current, arbeitRef.current);
    if (g.art === 'leer') return;
    if (g.art === 'fremd') {
      setVerlauf(g.verlauf);
      return setHinweis(
        'Die Seite hat sich inzwischen geändert – Rückgängig geht hier nicht mehr, damit nichts Fremdes überschrieben wird.',
      );
    }
    const p = uebernehmen(g.seite);
    if (p.length > 0) return setHinweis(`Das geht so nicht: ${p.join(' ')}`);
    setVerlauf(g.verlauf);
  };
  const geheRef = useRef(gehe);
  geheRef.current = gehe;

  // Strg/Cmd+Z und Umschalt+Strg/Cmd+Z (auch Strg+Y), wenn kein Textfeld offen ist – im offenen Feld gilt dessen eigener Verlauf.
  // Was im iframe gedrückt wird, meldet die Ebene selbst (`rueckgaengig`/`wiederholen`): Tasten dort kommen hier nicht an.
  useEffect(() => {
    const an = (e: KeyboardEvent) => {
      if ((!e.metaKey && !e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const wieder = (k === 'z' && e.shiftKey) || (k === 'y' && !e.metaKey);
      if (k !== 'z' && !wieder) return;
      const ziel = e.target;
      if (
        ziel instanceof HTMLElement &&
        (ziel.isContentEditable ||
          ziel.closest('input, textarea, select, [contenteditable="true"]'))
      )
        return;
      e.preventDefault();
      void geheRef.current(!wieder);
    };
    window.addEventListener('keydown', an);
    return () => window.removeEventListener('keydown', an);
  }, []);

  const aktion = async (a: EditorAktion) => {
    if (a.was === 'rueckgaengig' || a.was === 'wiederholen') return gehe(a.was === 'rueckgaengig');
    setHinweis(null);
    if (!(await sicherstellen())) {
      // Der getippte Text wurde nicht übernommen: Die Vorschau zeigt wieder den gespeicherten Stand.
      if (a.was === 'text' || a.was === 'aufteilung' || a.was === 'abstand')
        setZeichneNeu((n) => n + 1);
      return;
    }
    const s = arbeitRef.current;
    const leistenAktion = (neu: Seite) => {
      const p = uebernehmenMitVerlauf(neu, s);
      if (p.length > 0) setHinweis(`Das geht so nicht: ${p.join(' ')}`);
    };
    switch (a.was) {
      case 'einfuegen':
        return setDialog({ art: 'einfuegen', i: a.i });
      case 'gestalten':
        return setDialog({ art: 'gestalten', i: a.i, sicherung: s.abschnitte[a.i] });
      case 'verschieben': {
        // Ziehen und Pfeiltasten: beide Stellen sind schon gegen die Seite geprüft (`nachricht.ts`) – hier noch einmal, denn
        // die Seite kann sich während des Wartens auf die Sperre geändert haben. „Bleibt, wo er ist“: nichts speichern.
        if (a.art === 'abschnitt') {
          const neu = abschnittVerschiebenNach(s, a.von, a.nach);
          return neu === s ? undefined : leistenAktion(neu);
        }
        if (!bausteinDa(s, a.von.i, a.von.j, a.von.k)) return;
        // „Eigenes HTML“ ändert nur die Leitung – auch das Verschieben (die Ebene zeigt dafür keinen Griff; das hier gilt auch
        // gegen eine gefälschte Nachricht).
        if (s.abschnitte[a.von.i].spalten[a.von.j].bausteine[a.von.k].typ === 'html' && !darfHtml)
          return setHinweis('Eigenes HTML kann nur die Leitung verschieben.');
        const neu = bausteinVerschieben(s, a.von, a.nach);
        return neu === s ? undefined : leistenAktion(neu);
      }
      case 'aufteilung': {
        // Spaltenbreite ziehen (W3c-3): nur eine Aufteilung mit derselben Spaltenzahl – dann geht kein Baustein verloren. Die
        // Seite kann sich beim Warten auf die Sperre geändert haben, darum hier noch einmal (`aufteilungZiehen` prüft es).
        const neu = aufteilungZiehen(s, a.i, a.aufteilung, neueId);
        setZeichneNeu((n) => n + 1); // die Vorschau zeigt sonst die gezogene Breite, auch wenn nichts übernommen wird
        if (!neu)
          return setHinweis('Die Spaltenzahl lässt sich nur im Fenster „Gestalten“ ändern.');
        return s.abschnitte[a.i].aufteilung === a.aufteilung ? undefined : leistenAktion(neu);
      }
      case 'abstand': {
        // Abstand ziehen (W3c-3): ein Wert für oben und unten, wie im Fenster „Gestalten“ (`gestaltungAendern`).
        if (!abschnittDa(s, a.i)) return;
        setZeichneNeu((n) => n + 1);
        if (s.abschnitte[a.i].gestaltung.abstand === a.abstand) return;
        return leistenAktion(
          abschnittErsetzen(s, a.i, gestaltungAendern(s.abschnitte[a.i], { abstand: a.abstand })),
        );
      }
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
      case 'text': {
        // Direkt in der Vorschau getippt: erst die Änderung bauen (nur tippbare Felder, Gegenprobe des Markdowns), dann wie
        // jede Änderung durch Schema und Schlange. Die Vorschau wird danach immer neu gezeichnet: Was dort steht, ist sonst
        // nur das Getippte, nicht das, was gespeichert wird.
        const r = textUebernehmen(s, a);
        setZeichneNeu((n) => n + 1);
        if (!r.ok) return setHinweis(r.meldung);
        const p = uebernehmenMitVerlauf(r.seite, s);
        if (p.length > 0) setHinweis(`Das geht so nicht: ${p.join(' ')}`);
        return;
      }
    }
  };
  const darfHtml = rechte.html;
  const aktionRef = useRef(aktion);
  aktionRef.current = aktion;
  const beiAktion = useCallback((a: EditorAktion) => void aktionRef.current(a), []);
  // Wer anfängt zu tippen, nimmt die Sperre schon jetzt – nicht erst beim Übernehmen (dann wäre der Text verloren, wenn sie fehlt).
  const sicherstellenRef = useRef(sicherstellen);
  sicherstellenRef.current = sicherstellen;
  const beiTippen = useCallback(() => void sicherstellenRef.current(), []);
  const bearbeiten = useMemo(
    () => ({ onAktion: beiAktion, onTippen: beiTippen, darfHtml }),
    [beiAktion, beiTippen, darfHtml],
  );

  const einstellen = async () => {
    setHinweis(null);
    if (await sicherstellen()) setDialog({ art: 'einstellen' });
  };

  // ── Fenster ────────────────────────────────────────────────────────────────────────────────────────────────

  /** „Fertig“ im Fenster: speichern, und als Schritt merken – `vorher` ist die Seite vor dem Öffnen (die Sicherung). */
  const fensterFertig = (vorher: Seite) => {
    const p = uebernehmenMitVerlauf(arbeitRef.current, vorher);
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
              const p = uebernehmenMitVerlauf(
                abschnittEinfuegen(arbeitRef.current, dialog.i, v.erzeugen(neueId)),
                arbeitRef.current,
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
            onFertig={() =>
              fensterFertig(abschnittErsetzen(arbeitRef.current, dialog.i, dialog.sicherung))
            }
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
            onFertig={() =>
              fensterFertig(
                bausteinErsetzen(arbeitRef.current, dialog.i, dialog.j, dialog.k, dialog.sicherung),
              )
            }
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
              const vorher = bausteinErsetzen(
                arbeitRef.current,
                dialog.i,
                dialog.j,
                dialog.k,
                dialog.sicherung,
              );
              const p = uebernehmenMitVerlauf(
                bausteinEntfernen(vorher, dialog.i, dialog.j, dialog.k),
                vorher,
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
              const p = uebernehmenMitVerlauf(naechste, arbeitRef.current);
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
              const p = uebernehmenMitVerlauf(
                abschnittLoeschen(arbeitRef.current, dialog.i),
                arbeitRef.current,
              );
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
            bereichWahl={bereichWahl}
            onClose={schliessen}
            onFertig={(neu, menue) => {
              const p = uebernehmen(neu, menue);
              if (p.length > 0) return setMeldungen(p);
              // Titel, Adresse und Menü lassen sich hier nicht zurücknehmen – die Schritte davor passen danach nicht mehr.
              setVerlauf(LEERER_VERLAUF);
              schliessen();
            }}
            loeschen={loeschen}
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
        {freigabeLeiste}
        <SpeicherZustand stand={sperre.speicher} />
        {ansicht === 'computer' && (
          <div className={styles.verlauf} role="group" aria-label="Rückgängig und Wiederholen">
            <KopfKnopf
              still
              nurSymbol
              label="Rückgängig"
              title="Letzte Änderung rückgängig machen (Strg+Z)"
              symbol={<Icon name="undo" size={16} />}
              disabled={fremd !== null || verlauf.zurueck.length === 0}
              onClick={() => void gehe(true)}
            />
            <KopfKnopf
              still
              nurSymbol
              label="Wiederholen"
              title="Rückgängig gemachte Änderung wiederholen (Umschalt+Strg+Z)"
              symbol={<Icon name="redo" size={16} />}
              disabled={fremd !== null || verlauf.vor.length === 0}
              onClick={() => void gehe(false)}
            />
          </div>
        )}
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

      {freigabeBand}
      <SperrBaender a={sperre} ich={ich} texte={SEITEN_TEXTE} />

      <Vorschau
        seite={arbeit}
        stand={vorschauStand}
        gemeinde={gemeinde}
        ansicht={ansicht}
        bearbeiten={fremd ? undefined : bearbeiten}
        version={zeichneNeu}
      />
      {fenster}
    </section>
  );
}
