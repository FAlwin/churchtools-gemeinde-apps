import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import {
  ableiten,
  BLOCK,
  punktNummer,
  tabellenZeilen,
  terminDatum,
  textAus,
  type Block,
  type Punkt,
} from '@shared/protokolle/dokument';
import { statusText, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { Thema } from '@ui/design/thema';
import { useThema } from '@ui/design/useThema';
import { farbWert } from './farben';
import { FesterPunkt } from './FesterPunkt';
import styles from './ProtokollAnsicht.module.scss';
import { sichererLink } from '@shared/ct/sichereAdresse';

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

function textStueck(t: TextStueck, key: number, thema: Thema): ReactNode {
  const s = t.styles ?? {};
  let el: ReactNode = t.text;
  if (s.code) el = <code>{el}</code>;
  if (s.strike) el = <s>{el}</s>;
  if (s.underline) el = <u>{el}</u>;
  if (s.italic) el = <em>{el}</em>;
  if (s.bold) el = <strong>{el}</strong>;
  // Markieren (K3a): Hintergrund und Schrift in den Farben des Editors (`farben.ts`), hell wie dunkel.
  const hintergrund = farbWert(s.backgroundColor, 'hintergrund', thema);
  const schrift = farbWert(s.textColor, 'schrift', thema);
  return (
    <span
      key={key}
      className={hintergrund ? styles.markiertText : undefined}
      style={hintergrund || schrift ? { backgroundColor: hintergrund, color: schrift } : undefined}
    >
      {el}
    </span>
  );
}

/** Der Inhalt eines Blocks: Text mit Formatierung und Links. */
export function Inhalt({ content }: { content: unknown }) {
  const thema = useThema();
  if (!Array.isArray(content)) return null;
  return (
    <>
      {(content as (TextStueck | LinkStueck)[]).map((c, i) => {
        if (c?.type === 'text') return textStueck(c, i, thema);
        if (c?.type === 'link') {
          // Nur Web- und Mail-Adressen werden zu Links – nie `javascript:` aus einem gespeicherten Dokument (#849).
          const href = sichererLink(c.href, { mailto: true });
          const innen = (c.content ?? []).map((t, j) => textStueck(t, j, thema));
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

interface Kontext {
  /** Tagesordnungspunkte und Unterpunkte mit ihrer Nummer – aus der EINEN Ableitung. */
  punkte: Map<string, Punkt>;
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
      const p = k.punkte.get(b.id);
      const inhalt = (
        <>
          {p && <span className={styles.nr}>{punktNummer(p)}</span>}
          <Inhalt content={b.content} />
        </>
      );
      // Die Suche springt zu Tagesordnungspunkt oder Unterpunkt (K3b) – beide tragen deshalb die Sprungmarke.
      const ziel = (klasse: string) =>
        `${klasse}${k.markiert === b.id ? ` ${styles.markiert}` : ''}`;
      return (
        <>
          {stufe <= 1 ? (
            <h3 className={ziel(styles.punkt)} id={`punkt-${b.id}`}>
              {inhalt}
            </h3>
          ) : p ? (
            <h4 className={ziel(styles.unterpunkt)} id={`punkt-${b.id}`}>
              {inhalt}
            </h4>
          ) : stufe !== 3 ? (
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
            {terminDatum(b.props) && <b>{tagPunkt(terminDatum(b.props)!)} </b>}
            <Inhalt content={b.content} />
          </span>
          {kinder}
        </div>
      );
    case 'table':
      return <Tabelle content={b.content} />;
    case 'divider':
      // Trennlinie aus der Werkzeugleiste (S4-1) – ohne Text, bis dahin fiel sie hier still weg.
      return <hr className={styles.linie} />;
    case BLOCK.verweis:
      // Fester Punkt (S4-3a) – in der Lese-Ansicht nur Anzeige (Alwin 26.10.2026).
      return (
        <FesterPunkt
          art={b.props?.art}
          fest={b.props?.fest}
          gaeste={b.props?.gaeste}
          abhaken={false}
        />
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

/** Eine Tabelle (K3a) – Kopfzeilen als `th`, verbundene Zellen und Zellfarben wie im Editor. */
function Tabelle({ content }: { content: unknown }) {
  const thema = useThema();
  const zeilen = tabellenZeilen(content);
  if (!zeilen?.length) return null;
  return (
    <div className={styles.tabelle}>
      <table>
        <tbody>
          {zeilen.map((zellen, z) => (
            <tr key={z}>
              {zellen.map((c, s) => {
                const Zelle = c.kopf ? 'th' : 'td';
                return (
                  <Zelle
                    key={s}
                    colSpan={c.spalten > 1 ? c.spalten : undefined}
                    rowSpan={c.zeilen > 1 ? c.zeilen : undefined}
                    style={{
                      backgroundColor: farbWert(c.hintergrund, 'hintergrund', thema),
                      color: farbWert(c.schrift, 'schrift', thema),
                    }}
                  >
                    <Inhalt content={c.inhalt} />
                  </Zelle>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
    punkte: new Map(a.punkte.map((p) => [p.blockId, p])),
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
