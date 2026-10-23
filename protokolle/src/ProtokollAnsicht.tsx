import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { ableiten, BLOCK, textAus, type Block } from '@shared/protokolle/dokument';
import { statusText, type Aufgabe } from '@shared/protokolle/aufgaben';
import styles from './ProtokollAnsicht.module.scss';

/**
 * **Ein Protokoll lesen** (Bauplan S3-2) – eine eigene, schlanke Darstellung der Blöcke, wie der Editor (BlockNote)
 * sie speichert (Alwin, 23.10.2026: nicht den gesperrten Editor). Nichts geht verloren: Unbekannte Blöcke erscheinen
 * mit ihrem Text als Absatz. Tagesordnungspunkte (Überschrift 1) tragen ihre Nummer aus der EINEN Ableitung
 * (`ableiten`), damit Liste, Bereiche und PDF dieselbe Zählung haben.
 */

interface TextStueck {
  type: 'text';
  text: string;
  styles?: Record<string, unknown>;
}
interface LinkStueck {
  type: 'link';
  href: string;
  content: TextStueck[];
}

/** Nur Web- und Mail-Adressen werden zu Links – nie `javascript:` oder Ähnliches aus einem gespeicherten Dokument. */
function sichereAdresse(href: unknown): string | null {
  return typeof href === 'string' && /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

function textStueck(t: TextStueck, key: number): ReactNode {
  const s = t.styles ?? {};
  let el: ReactNode = t.text;
  if (s.code) el = <code>{el}</code>;
  if (s.strike) el = <s>{el}</s>;
  if (s.underline) el = <u>{el}</u>;
  if (s.italic) el = <em>{el}</em>;
  if (s.bold) el = <strong>{el}</strong>;
  return <span key={key}>{el}</span>;
}

/** Der Inhalt eines Blocks: Text mit Formatierung und Links. */
export function Inhalt({ content }: { content: unknown }) {
  if (!Array.isArray(content)) return null;
  return (
    <>
      {(content as (TextStueck | LinkStueck)[]).map((c, i) => {
        if (c?.type === 'text') return textStueck(c, i);
        if (c?.type === 'link') {
          const href = sichereAdresse(c.href);
          const innen = (c.content ?? []).map((t, j) => textStueck(t, j));
          return href ? (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer">
              {innen}
            </a>
          ) : (
            <span key={i}>{innen}</span>
          );
        }
        return null;
      })}
    </>
  );
}

const VERWEIS_TEXT: Record<string, string> = {
  'offene-aufgaben': 'Hier stehen die offenen To-Dos der Gruppe.',
  'letztes-protokoll': 'Hier steht das Protokoll der letzten Sitzung.',
};

interface Kontext {
  nummern: Map<string, number>;
  /** Der Punkt, zu dem die Suche gesprungen ist – kurz hervorgehoben. */
  markiert: string | null;
  aufgaben: ReadonlyMap<string, Aufgabe>;
}

const istListe = (b: Block): boolean =>
  b.type === 'bulletListItem' || b.type === 'numberedListItem' || b.type === 'checkListItem';

/** Aufeinanderfolgende Listenpunkte derselben Art zu einer Liste bündeln. */
function Bloecke({ bloecke, k }: { bloecke: readonly Block[]; k: Kontext }) {
  const teile: ReactNode[] = [];
  for (let i = 0; i < bloecke.length; i++) {
    const b = bloecke[i];
    if (istListe(b)) {
      const art = b.type;
      const gruppe: Block[] = [];
      while (i < bloecke.length && bloecke[i].type === art) gruppe.push(bloecke[i++]);
      i--;
      const punkte = gruppe.map((x) => (
        <li key={x.id} className={art === 'checkListItem' ? styles.haken : undefined}>
          {art === 'checkListItem' && (
            <span className={styles.kasten} aria-hidden>
              {x.props?.checked ? '☑' : '☐'}
            </span>
          )}
          <Inhalt content={x.content} />
          {!!x.children?.length && <Bloecke bloecke={x.children} k={k} />}
        </li>
      ));
      teile.push(
        art === 'numberedListItem' ? (
          <ol key={b.id}>{punkte}</ol>
        ) : (
          <ul key={b.id} className={art === 'checkListItem' ? styles.ohnePunkt : undefined}>
            {punkte}
          </ul>
        ),
      );
      continue;
    }
    teile.push(<EinBlock key={b.id} b={b} k={k} />);
  }
  return <>{teile}</>;
}

function EinBlock({ b, k }: { b: Block; k: Kontext }) {
  const kinder = b.children?.length ? (
    <div className={styles.eingerueckt}>
      <Bloecke bloecke={b.children} k={k} />
    </div>
  ) : null;
  switch (b.type) {
    case 'heading': {
      const stufe = Number(b.props?.level ?? 1);
      const nr = k.nummern.get(b.id);
      const inhalt = (
        <>
          {nr !== undefined && <span className={styles.nr}>{nr}.</span>}
          <Inhalt content={b.content} />
        </>
      );
      return (
        <>
          {stufe <= 1 ? (
            <h3
              className={`${styles.punkt}${k.markiert === b.id ? ` ${styles.markiert}` : ''}`}
              id={`punkt-${b.id}`}
            >
              {inhalt}
            </h3>
          ) : stufe === 2 ? (
            <h4>{inhalt}</h4>
          ) : (
            <h5>{inhalt}</h5>
          )}
          {kinder}
        </>
      );
    }
    case 'quote':
      return (
        <blockquote>
          <Inhalt content={b.content} />
          {kinder}
        </blockquote>
      );
    case BLOCK.aufgabe: {
      const a = typeof b.props?.aufgabe === 'string' ? k.aufgaben.get(b.props.aufgabe) : undefined;
      return (
        <div className={`${styles.marke} ${styles.aufgabe}`}>
          <Icon name={a?.status === 'erledigt' ? 'check' : 'clock'} size={16} />
          <span className={styles.markeText}>
            <Inhalt content={b.content} />
            {a && (
              <small>
                {statusText(a.status)}
                {a.bis ? ` · bis ${tagPunkt(a.bis)}` : ''}
              </small>
            )}
          </span>
          {kinder}
        </div>
      );
    }
    case BLOCK.beschluss:
      return (
        <div className={`${styles.marke} ${styles.beschluss}`}>
          <b>Beschluss</b>
          <span className={styles.markeText}>
            <Inhalt content={b.content} />
          </span>
          {kinder}
        </div>
      );
    case BLOCK.termin:
      return (
        <div className={`${styles.marke} ${styles.termin}`}>
          <Icon name="calendar" size={16} />
          <span className={styles.markeText}>
            {typeof b.props?.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.props.datum) && (
              <b>{tagPunkt(b.props.datum)} </b>
            )}
            <Inhalt content={b.content} />
          </span>
          {kinder}
        </div>
      );
    case BLOCK.verweis:
      return (
        <p className={styles.verweis}>{VERWEIS_TEXT[String(b.props?.art)] ?? 'Fester Punkt'}</p>
      );
    default: {
      // Absatz – und jeder unbekannte Block: sein Text bleibt sichtbar. Leere Absätze sind nur Abstand.
      if (!textAus(b.content) && !kinder) return null;
      return (
        <>
          {textAus(b.content) && (
            <p>
              <Inhalt content={b.content} />
            </p>
          )}
          {kinder}
        </>
      );
    }
  }
}

export function ProtokollAnsicht({
  dokument,
  aufgaben = [],
  markiert = null,
}: {
  dokument: readonly Block[];
  aufgaben?: readonly Aufgabe[];
  markiert?: string | null;
}) {
  const a = ableiten(dokument);
  const k: Kontext = {
    nummern: new Map(a.punkte.map((p) => [p.blockId, p.nummer])),
    aufgaben: new Map(aufgaben.map((x) => [x.id, x])),
    markiert,
  };
  if (!dokument.length) return <p className={styles.leer}>Das Protokoll ist noch leer.</p>;
  return (
    <article className={styles.blatt}>
      <Bloecke bloecke={dokument} k={k} />
    </article>
  );
}
