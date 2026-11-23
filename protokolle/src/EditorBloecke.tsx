import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@ui/icons/icons';
import { useEscape } from '@ui/bedienung/useEscape';
import { tagPunkt } from '@shared/ct/datum';
import { terminDatum, textAus } from '@shared/protokolle/dokument';
import { ohneVerlauf, type VerlaufsfreierEditor } from './ohneVerlauf';
import {
  istUeberfaellig,
  nameAusListe,
  zustaendigeNamen,
  zustaendigKurz,
  alleGewaehlt,
  alleSetzen,
  hakenAnwenden,
  istJeder,
  modusSetzen,
  neueAufgabe,
  vorabAnwenden,
  vorabLesen,
  zustaendigSetzen,
} from '@shared/protokolle/aufgaben';
import { FesterPunkt } from './FesterPunkt';
import { FestePunkteKontext } from './festePunkteKontext';
import { fruehesAendern } from './fruehesProtokoll';
import { gaesteWert, ohneWert } from '@shared/protokolle/anwesenheit';
import type { ProtokollEditor } from './editorSchema';
import { AufgabenKontext } from './aufgabenKontext';
import { Haken } from './Haken';
/** Platzhalter, solange es das To-Do noch nicht gibt (ohne Text): der Haken zeigt „offen“, bedienbar ist er nicht. */
const LEERE_AUFGABE = neueAufgabe({ id: '', gruppe: 0, sitzung: null, text: '', von: 0, am: '' });

// Dieselben Marken wie in der Lese-Ansicht – Aufgabe, Beschluss und Termin sehen beim Schreiben aus wie beim Lesen.
import ansicht from './ProtokollAnsicht.module.scss';
import styles from './EditorBloecke.module.scss';
import { heuteImKalender } from '@shared/ct/zeit';

/**
 * **Wie die eigenen Blöcke im Editor aussehen und bedient werden** (S4-1/S4-2, Entwurf 7) – die Darstellung zu den
 * Blockarten aus `editorSchema.ts`. `contentRef` ist die Stelle, an der BlockNote den bearbeitbaren Text einhängt.
 *
 * - **Aufgabe:** Haken vorne, rechts die Schildchen „Wer?“ (Mitglieder mit Häkchen + externer Name) und „Bis“.
 *   Geändert wird das To-Do in „Mitarbeit“ (über `AufgabenKontext`), nicht das Protokoll (Alwin 24.10.2026).
 * - **Termin:** Datum-Schildchen; das Datum steht im Block selbst (`props.datum`), nur im Protokoll.
 * - **Fester Punkt** (S4-3a): `FesterPunkt` – „Offene To-Dos“ bzw. „Letztes Protokoll“.
 */

interface Inhalt {
  contentRef: (el: HTMLElement | null) => void;
}

/** Ein Schildchen, das ein kleines Feld darunter aufklappt; schließt bei Klick daneben und mit Esc. */
function Schildchen({
  icon,
  text,
  titel,
  aus,
  warnung,
  tooltip,
  children,
}: {
  icon: IconName;
  text: string;
  titel: string;
  aus: boolean;
  warnung?: boolean;
  /** Die volle Liste, wenn der Text gekürzt ist. */
  tooltip?: string;
  children: (zu: () => void) => ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!offen) return;
    const weg = (e: MouseEvent) => {
      if (!rahmen.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener('mousedown', weg);
    return () => document.removeEventListener('mousedown', weg);
  }, [offen]);
  useEscape(offen, () => setOffen(false));
  return (
    <span className={styles.rahmen} ref={rahmen} contentEditable={false}>
      <button
        type="button"
        className={`${styles.schild}${warnung ? ` ${styles.warnung}` : ''}`}
        disabled={aus}
        aria-expanded={offen}
        aria-label={titel}
        title={tooltip}
        onClick={() => setOffen((o) => !o)}
      >
        <Icon name={icon} size={14} />
        {text}
      </button>
      {offen && (
        <span className={styles.feld} role="dialog" aria-label={titel}>
          {children(() => setOffen(false))}
        </span>
      )}
    </span>
  );
}

export function AufgabeBlock({
  block,
  editor,
  contentRef,
}: Inhalt & {
  block: { id: string; props: { aufgabe: string; vorab: string }; content: unknown };
  editor: VerlaufsfreierEditor & {
    isEditable: boolean;
    updateBlock: (b: string, u: { props: { vorab: string } }) => unknown;
  };
}) {
  const k = useContext(AufgabenKontext);
  const id = block.props.aufgabe;
  const a = id ? k?.todos.get(id) : undefined;
  const text = textAus(block.content);
  const vorab = vorabLesen(block.props.vorab);
  const status = a?.status ?? 'offen';
  // Wer und Bis gehen, sobald der Block eine ID hat (K1). Ein To-Do gibt es erst mit Text; bis dahin merkt sich der Block
  // die Wahl (`vorab`), und das Anlegen übernimmt sie – beim Speichern wie hier beim ersten Tipp (`vorabAnwenden`).
  const bereit = !!k && !!id;
  const mitText = bereit && !!text.trim();
  const aendern = (f: Parameters<NonNullable<typeof k>['aendern']>[2]) => {
    if (!k || !bereit) return;
    if (a || mitText) {
      k.aendern(id, text, a ? f : (x) => f(vorabAnwenden(x, vorab)));
      return;
    }
    const leer = neueAufgabe({ id, gruppe: 0, sitzung: null, text: '', von: 0, am: '' });
    const neu = f(vorabAnwenden(leer, vorab));
    editor.updateBlock(block.id, {
      props: { vorab: JSON.stringify({ wer: neu.wer, extern: neu.extern, bis: neu.bis }) },
    });
  };
  // Gibt es das To-Do, ist die Wahl übernommen – aus dem Block nehmen, sonst übernähme eine Kopie sie noch einmal.
  // Ohne Rückgängig-Verlauf: sonst holte „Rückgängig“ die Wahl zurück, dieser Effekt nähme sie gleich wieder heraus, und
  // Rückgängig käme nie weiter (TF-PROT-29, 23.11.2026 – `ohneVerlauf`).
  useEffect(() => {
    if (a && block.props.vorab && editor.isEditable)
      ohneVerlauf(editor, () => editor.updateBlock(block.id, { props: { vorab: '' } }));
  }, [a, block.props.vorab, block.id, editor]);
  const sicht = a ?? vorab;

  const mitglieder = k?.mitglieder;
  // `Array.isArray` macht aus einer schreibgeschützten Liste `any[]` – deshalb so.
  const liste = mitglieder && mitglieder !== 'verborgen' ? mitglieder : null;
  // Mitglieder sehen die Liste oft nicht – dann ich selbst bzw. der Name aus dem Verlauf (S7-2a), erst danach die Zahl.
  const ausListe = k ? nameAusListe(k.mitglieder, k.ich) : () => null;
  const wer = sicht ? zustaendigeNamen(sicht, ausListe, (p) => `Person ${p}`) : [];
  // Bearbeiten: höchstens 3 Namen + „+N“ (W5); Lesen (freigegeben) zeigt alle – ein Protokoll soll vollständig sein.
  const kurz = zustaendigKurz(wer, k?.bearbeitbar ? 3 : Infinity);
  const alleIds = liste ? liste.map((m) => m.id) : [];
  const ueber = !!a && istUeberfaellig(a, heuteImKalender());

  return (
    <div className={`${ansicht.marke} ${ansicht.aufgabe} ${styles.aufgabe}`}>
      <span contentEditable={false} className={styles.vorne}>
        <Haken
          a={a ?? LEERE_AUFGABE}
          ich={k?.ich.person ?? 0}
          onSchritt={
            mitText && k.statusAenderbar
              ? (s) => aendern((x) => hakenAnwenden(x, s, k.ich.person, new Date().toISOString()))
              : undefined
          }
        />
      </span>
      <div
        className={`${ansicht.markeText} ${status === 'erledigt' ? styles.erledigt : ''}`}
        ref={contentRef}
      />
      <span className={styles.schilder} contentEditable={false}>
        <Schildchen
          icon="people"
          text={wer.length ? kurz.text : 'Wer?'}
          titel="Wer kümmert sich?"
          tooltip={kurz.gekuerzt ? kurz.voll : undefined}
          aus={!bereit || !k.bearbeitbar}
        >
          {() => (
            <>
              <b className={styles.feldTitel}>Wer kümmert sich?</b>
              {mitglieder === null && <small>Mitglieder werden geladen …</small>}
              {mitglieder === 'verborgen' && (
                <small>ChurchTools zeigt dir die Mitglieder dieser Gruppe nicht.</small>
              )}
              {liste && liste.length > 1 && (
                <label className={styles.person}>
                  <input
                    type="checkbox"
                    checked={alleGewaehlt(alleIds, sicht?.wer ?? [])}
                    onChange={(e) => {
                      // Vorab lesen: `aendern` ruft die Funktion erst später auf, dann steht der Haken wieder zurück.
                      const an = e.target.checked;
                      aendern((x) =>
                        zustaendigSetzen(
                          x,
                          alleSetzen(alleIds, x.wer, an),
                          k?.ich.person ?? 0,
                          new Date().toISOString(),
                        ),
                      );
                    }}
                  />
                  <b>Alle ({liste.length})</b>
                </label>
              )}
              {liste?.map((m) => {
                const an = !!sicht?.wer.includes(m.id);
                return (
                  <label key={m.id} className={styles.person}>
                    <input
                      type="checkbox"
                      checked={an}
                      onChange={() =>
                        aendern((x) =>
                          zustaendigSetzen(
                            x,
                            an ? x.wer.filter((p) => p !== m.id) : [...x.wer, m.id],
                            k?.ich.person ?? 0, // ohne Kontext schreibt `aendern` ohnehin nichts
                            new Date().toISOString(),
                          ),
                        )
                      }
                    />
                    {m.name}
                  </label>
                );
              })}
              {a && a.wer.length >= 2 && (
                <label className={styles.person}>
                  <input
                    type="checkbox"
                    checked={istJeder(a)}
                    onChange={(e) => {
                      // Vorab lesen (wie bei „Alle“): `aendern` ruft die Funktion erst später auf.
                      const jeder = e.target.checked;
                      aendern((x) =>
                        modusSetzen(x, jeder, k?.ich.person ?? 0, new Date().toISOString()),
                      );
                    }}
                  />
                  <b>Jeder hakt für sich ab</b>
                </label>
              )}
              <label className={styles.extern}>
                <small>Außerhalb der Gruppe (nur Name)</small>
                <input
                  type="text"
                  defaultValue={sicht?.extern ?? ''}
                  placeholder="z. B. Hausmeister Müller"
                  onBlur={(e) => {
                    const extern = e.currentTarget.value.trim();
                    if (extern !== (sicht?.extern ?? '')) aendern((x) => ({ ...x, extern }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
              </label>
            </>
          )}
        </Schildchen>
        <Schildchen
          icon="calendar"
          text={sicht?.bis ? `${ueber ? 'überfällig · ' : 'bis '}${tagPunkt(sicht.bis)}` : 'Bis'}
          titel="Bis wann?"
          aus={!bereit || !k.bearbeitbar}
          warnung={ueber}
        >
          {(zu) => (
            <>
              <b className={styles.feldTitel}>Bis wann?</b>
              <input
                type="date"
                defaultValue={sicht?.bis ?? ''}
                onChange={(e) => {
                  const bis = e.currentTarget.value || null;
                  aendern((x) => ({ ...x, bis }));
                }}
              />
              {sicht?.bis && (
                <button
                  type="button"
                  className={styles.leise}
                  onClick={() => {
                    aendern((x) => ({ ...x, bis: null }));
                    zu();
                  }}
                >
                  Ohne Datum
                </button>
              )}
            </>
          )}
        </Schildchen>
      </span>
    </div>
  );
}

export function BeschlussBlock({ contentRef }: Inhalt) {
  return (
    <div className={`${ansicht.marke} ${ansicht.beschluss}`}>
      <b contentEditable={false}>Beschluss</b>
      <div className={ansicht.markeText} ref={contentRef} />
    </div>
  );
}

export function TerminBlock({
  block,
  editor,
  contentRef,
}: Inhalt & {
  block: { id: string; props: { datum: string } };
  editor: {
    isEditable: boolean;
    updateBlock: (b: string, u: { props: { datum: string } }) => unknown;
  };
}) {
  const datum = terminDatum(block.props) ?? '';
  return (
    <div className={`${ansicht.marke} ${ansicht.termin}`}>
      <span className={`${styles.schilder} ${styles.vorneSchild}`} contentEditable={false}>
        <Schildchen
          icon="calendar"
          text={datum ? tagPunkt(datum) : 'Datum'}
          titel="Datum des Termins"
          aus={!editor.isEditable}
        >
          {() => (
            <>
              <b className={styles.feldTitel}>Datum</b>
              <input
                type="date"
                defaultValue={datum}
                onChange={(e) =>
                  editor.updateBlock(block.id, { props: { datum: e.currentTarget.value } })
                }
              />
            </>
          )}
        </Schildchen>
      </span>
      <div className={ansicht.markeText} ref={contentRef} />
    </div>
  );
}

/**
 * Fester Punkt (S4-3a) – derselbe Baustein wie in der Lese-Ansicht; abhaken darf man hier.
 *
 * Ein Klick in den Kasten **tut im Text nichts** (beim Durchklicken 26.10.2026 gefunden): Der Editor markierte sonst den
 * ganzen Block, und der nächste Tastendruck ersetzte den festen Punkt. Nur weiterreichen half nicht – dann setzte der
 * Browser den Cursor in den Kasten, und Tippen löschte ihn und zog zwei Tagesordnungspunkte zusammen. Deshalb weder
 * Cursor noch Markierung (`preventDefault`) und kein Editor (`stopPropagation`, am Element selbst: der Editor hört an
 * seiner Fläche, bevor React das Ereignis sieht). Die Knöpfe im Kasten reagieren auf `click` und bleiben bedienbar.
 * Ein **Eingabefeld** im Kasten (Gäste der Anwesenheit, S5-3) bekommt den Klick: dort nur `stopPropagation`, sonst
 * käme es nie zum Fokus.
 */
export function VerweisBlock({
  block,
  editor,
}: {
  block: { id: string; props: { art: string; fest: string; gaeste?: string; ohne?: string } };
  // Schmal wie bei den anderen Blöcken: Der volle `ProtokollEditor` entsteht erst aus dem Schema mit diesem Block –
  // in der Signatur wäre das ein Typ-Kreis. Zur Laufzeit ist es derselbe Editor.
  editor: {
    isEditable: boolean;
    updateBlock: (b: string, u: { props: { gaeste: string } | { ohne: string } }) => unknown;
  };
}) {
  const w = useContext(FestePunkteKontext);
  const kasten = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = kasten.current;
    if (!el) return;
    const halt = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('mousedown', halt);
    return () => el.removeEventListener('mousedown', halt);
  }, []);
  return (
    <div ref={kasten} className={styles.festerPunkt} contentEditable={false}>
      <FesterPunkt
        art={block.props.art}
        fest={block.props.fest}
        abhaken
        // „Ändern“ (K3b-2) nur, wo man schreibt – in einem gesperrten Editor nicht.
        aendern={
          w && editor.isEditable && block.props.art === 'letztes-protokoll'
            ? () => fruehesAendern(editor as unknown as ProtokollEditor, block.id, w)
            : undefined
        }
        gaeste={block.props.gaeste}
        // Anwesenheit (S5-3): beim Schreiben tippen und Gäste ändern; im gesperrten Editor nur lesen.
        gaesteSetzen={
          editor.isEditable && block.props.art === 'anwesenheit'
            ? (g) => editor.updateBlock(block.id, { props: { gaeste: gaesteWert(g) } })
            : undefined
        }
        ohne={block.props.ohne}
        // Eine Person aus diesem Protokoll nehmen (nur hier gespeichert, nie im Gruppentreffen).
        ohneSetzen={
          editor.isEditable && block.props.art === 'anwesenheit'
            ? (o) => editor.updateBlock(block.id, { props: { ohne: ohneWert(o) } })
            : undefined
        }
      />
    </div>
  );
}
