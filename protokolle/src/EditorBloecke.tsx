import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { textAus } from '@shared/protokolle/dokument';
import { istUeberfaellig, statusSetzen } from '@shared/protokolle/aufgaben';
import { VERWEIS_TEXT } from './anzeige';
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
  contentRef,
}: Inhalt & { block: { props: { aufgabe: string }; content: unknown } }) {
  const k = useContext(AufgabenKontext);
  const id = block.props.aufgabe;
  const a = id ? k?.todos.get(id) : undefined;
  const text = textAus(block.content);
  const status = a?.status ?? 'offen';
  // Erst wenn die Aufgabe Text und eine ID hat, gibt es ein To-Do dazu.
  const bereit = !!k && !!id && !!text.trim();
  const aendern = (f: Parameters<NonNullable<typeof k>['aendern']>[2]) => {
    if (k && bereit) k.aendern(id, text, f);
  };

  const mitglieder = k?.mitglieder;
  // `Array.isArray` macht aus einer schreibgeschützten Liste `any[]` – deshalb so.
  const liste = mitglieder && mitglieder !== 'verborgen' ? mitglieder : null;
  const nameVon = (p: number) => liste?.find((m) => m.id === p)?.name ?? `Person ${p}`;
  const wer = [...(a?.wer ?? []).map(nameVon), ...(a?.extern ? [`${a.extern} (extern)`] : [])];
  const ueber = !!a && istUeberfaellig(a, heute());

  return (
    <div className={`${ansicht.marke} ${ansicht.aufgabe} ${styles.aufgabe}`}>
      <span contentEditable={false} className={styles.vorne}>
        <StatusKreis
          status={status}
          onWechsel={
            bereit && k.statusAenderbar
              ? (neu) => aendern((x) => statusSetzen(x, neu, k.ich, new Date().toISOString()))
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
                const an = !!a?.wer.includes(m.id);
                return (
                  <label key={m.id} className={styles.person}>
                    <input
                      type="checkbox"
                      checked={an}
                      onChange={() =>
                        aendern((x) => ({
                          ...x,
                          wer: an ? x.wer.filter((p) => p !== m.id) : [...x.wer, m.id],
                        }))
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
                  defaultValue={a?.extern ?? ''}
                  placeholder="z. B. Hausmeister Müller"
                  onBlur={(e) => {
                    const extern = e.currentTarget.value.trim();
                    if (extern !== (a?.extern ?? '')) aendern((x) => ({ ...x, extern }));
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
          text={a?.bis ? `${ueber ? 'überfällig · ' : 'bis '}${tagPunkt(a.bis)}` : 'Bis'}
          titel="Bis wann?"
          aus={!bereit || !k.bearbeitbar}
          warnung={ueber}
        >
          {(zu) => (
            <>
              <b className={styles.feldTitel}>Bis wann?</b>
              <input
                type="date"
                defaultValue={a?.bis ?? ''}
                onChange={(e) => {
                  const bis = e.currentTarget.value || null;
                  aendern((x) => ({ ...x, bis }));
                }}
              />
              {a?.bis && (
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

export function VerweisBlock({ block }: { block: { props: { art: string } } }) {
  return <p className={ansicht.verweis}>{VERWEIS_TEXT[block.props.art] ?? 'Fester Punkt'}</p>;
}
