import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { textAus } from '@shared/protokolle/dokument';
import {
  istUeberfaellig,
  nameAusListe,
  nameImVerlauf,
  neueAufgabe,
  statusSetzen,
  vorabAnwenden,
  vorabLesen,
  zustaendigSetzen,
} from '@shared/protokolle/aufgaben';
import { FesterPunkt } from './FesterPunkt';
import { AufgabenKontext } from './aufgabenKontext';
import { StatusKreis } from './StatusKreis';
// Dieselben Marken wie in der Lese-Ansicht – Aufgabe, Beschluss und Termin sehen beim Schreiben aus wie beim Lesen.
import ansicht from './ProtokollAnsicht.module.scss';
import styles from './EditorBloecke.module.scss';

/**
 * **Wie die eigenen Blöcke im Editor aussehen und bedient werden** (S4-1/S4-2, Entwurf 7) – die Darstellung zu den
 * Blockarten aus `editorSchema.ts`. `contentRef` ist die Stelle, an der BlockNote den bearbeitbaren Text einhängt.
 *
 * - **Aufgabe:** Status-Kreis vorne, rechts die Schildchen „Wer?“ (Mitglieder mit Häkchen + externer Name) und „Bis“.
 *   Geändert wird das To-Do in „Mitarbeit“ (über `AufgabenKontext`), nicht das Protokoll (Alwin 24.10.2026).
 * - **Termin:** Datum-Schildchen; das Datum steht im Block selbst (`props.datum`), nur im Protokoll.
 * - **Fester Punkt** (S4-3a): `FesterPunkt` – „Offene To-Dos“ bzw. „Letztes Protokoll“.
 */

interface Inhalt {
  contentRef: (el: HTMLElement | null) => void;
}

/** Heute als `JJJJ-MM-TT` in der Zeitzone des Geräts. */
function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ein Schildchen, das ein kleines Feld darunter aufklappt; schließt bei Klick daneben und mit Esc. */
function Schildchen({
  icon,
  text,
  titel,
  aus,
  warnung,
  children,
}: {
  icon: IconName;
  text: string;
  titel: string;
  aus: boolean;
  warnung?: boolean;
  children: (zu: () => void) => ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!offen) return;
    const weg = (e: MouseEvent) => {
      if (!rahmen.current?.contains(e.target as Node)) setOffen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', weg);
      document.removeEventListener('keydown', esc);
    };
  }, [offen]);
  return (
    <span className={styles.rahmen} ref={rahmen} contentEditable={false}>
      <button
        type="button"
        className={`${styles.schild}${warnung ? ` ${styles.warnung}` : ''}`}
        disabled={aus}
        aria-expanded={offen}
        aria-label={titel}
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
  editor: {
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
  useEffect(() => {
    if (a && block.props.vorab && editor.isEditable)
      editor.updateBlock(block.id, { props: { vorab: '' } });
  }, [a, block.props.vorab, block.id, editor]);
  const sicht = a ?? vorab;

  const mitglieder = k?.mitglieder;
  // `Array.isArray` macht aus einer schreibgeschützten Liste `any[]` – deshalb so.
  const liste = mitglieder && mitglieder !== 'verborgen' ? mitglieder : null;
  // Mitglieder sehen die Liste oft nicht – dann ich selbst bzw. der Name aus dem Verlauf (S7-2a), erst danach die Zahl.
  const ausListe = k ? nameAusListe(k.mitglieder, k.ich) : () => null;
  const nameVon = (p: number) => ausListe(p) ?? (a && nameImVerlauf(a, p)) ?? `Person ${p}`;
  const wer = [
    ...(sicht?.wer ?? []).map(nameVon),
    ...(sicht?.extern ? [`${sicht.extern} (extern)`] : []),
  ];
  const ueber = !!a && istUeberfaellig(a, heute());

  return (
    <div className={`${ansicht.marke} ${ansicht.aufgabe} ${styles.aufgabe}`}>
      <span contentEditable={false} className={styles.vorne}>
        <StatusKreis
          status={status}
          onWechsel={
            mitText && k.statusAenderbar
              ? (neu) =>
                  aendern((x) => statusSetzen(x, neu, k.ich.person, new Date().toISOString()))
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
          text={wer.length ? wer.join(', ') : 'Wer?'}
          titel="Wer kümmert sich?"
          aus={!bereit || !k.bearbeitbar}
        >
          {() => (
            <>
              <b className={styles.feldTitel}>Wer kümmert sich?</b>
              {mitglieder === null && <small>Mitglieder werden geladen …</small>}
              {mitglieder === 'verborgen' && (
                <small>ChurchTools zeigt dir die Mitglieder dieser Gruppe nicht.</small>
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
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(block.props.datum) ? block.props.datum : '';
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
 */
export function VerweisBlock({ block }: { block: { props: { art: string; fest: string } } }) {
  const kasten = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = kasten.current;
    if (!el) return;
    const halt = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('mousedown', halt);
    return () => el.removeEventListener('mousedown', halt);
  }, []);
  return (
    <div ref={kasten} className={styles.festerPunkt} contentEditable={false}>
      <FesterPunkt art={block.props.art} fest={block.props.fest} abhaken />
    </div>
  );
}
