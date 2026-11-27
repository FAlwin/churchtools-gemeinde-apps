import { Fragment, useState, type ReactNode } from 'react';
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
import {
  anzahlInfo,
  ausgeblendet,
  dokumentHatInfo,
  INFO_LEGENDE,
  ohneKennzeichen,
  zeilenArten,
  type ZeilenArt,
} from '@shared/protokolle/tabellenZeile';
import type { Thema } from '@ui/design/thema';
import { useThema } from '@ui/design/useThema';
import { farbWert } from './farben';
import { FesterPunkt } from './FesterPunkt';
import { ReiheKarte } from './ReiheKarte';
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
  // Umschalt+Enter (und die Aufzählung in Tabellenzellen, W11) speichert den Zeilenumbruch als `\n` im Text.
  const zeilen = t.text.split('\n');
  let el: ReactNode =
    zeilen.length > 1
      ? zeilen.map((z, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {z}
          </Fragment>
        ))
      : t.text;
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
  /** „Nur Themen dieses Treffens“ (W13): Info-Zeilen der Tabellen ausblenden – nur Anzeige, nichts wird gespeichert. */
  nurThemen: boolean;
}

const istListe = (b: Block): boolean =>
  b.type === 'bulletListItem' || b.type === 'numberedListItem' || b.type === 'checkListItem';

/**
 * Aufeinanderfolgende Listenpunkte derselben Art zu einer Liste bündeln. `ebene`: wie viele Aufzählungen übereinander
 * stecken – wie im Editor zählen nur Aufzählungen; unter einem Absatz oder einer Nummerierung fängt es oben wieder an.
 * Das Zeichen je Ebene steht in `ProtokollAnsicht.module.scss` (`aufzaehlung.ts` ist die Quelle, ein Test vergleicht).
 */
function Bloecke({
  bloecke,
  k,
  ebene = 0,
}: {
  bloecke: readonly Block[];
  k: Kontext;
  ebene?: number;
}) {
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
          {!!x.children?.length && (
            <Bloecke bloecke={x.children} k={k} ebene={art === 'bulletListItem' ? ebene + 1 : 0} />
          )}
        </li>
      ));
      teile.push(
        art === 'numberedListItem' ? (
          <ol key={b.id}>{punkte}</ol>
        ) : (
          <ul
            key={b.id}
            className={
              art === 'checkListItem'
                ? styles.ohnePunkt
                : styles[`aufzaehlung${Math.min(ebene, 2)}`]
            }
          >
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
        <div
          className={`${styles.marke} ${styles.aufgabe} ${a?.status === 'arbeit' ? styles.arbeit : a?.status === 'erledigt' ? styles.erledigtKreis : ''}`}
        >
          {/* Der Kreis wie der Haken im Editor (`Haken.tsx`): offen leer, in Arbeit halb, erledigt mit Haken. */}
          <span className={styles.kreis}>
            <Icon
              name={
                a?.status === 'erledigt'
                  ? 'kreis-haken'
                  : a?.status === 'arbeit'
                    ? 'kreis-halb'
                    : 'kreis'
              }
              size={18}
            />
          </span>
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
          <span className={styles.markeText}>
            {terminDatum(b.props) && <b>{tagPunkt(terminDatum(b.props)!)} </b>}
            <Inhalt content={b.content} />
          </span>
          {kinder}
        </div>
      );
    case BLOCK.themenreihe:
      // Baustein „Reihe“: dieselbe Karte wie im Editor, samt Knöpfen für alle, die im Protokoll schreiben dürfen – auch bei
      // einem freigegebenen Protokoll (die Reihe liegt in „Mitarbeit“, nicht im Protokoll).
      return <ReiheKarte reiheId={typeof b.props?.reihe === 'string' ? b.props.reihe : ''} />;
    case 'table':
      return <Tabelle content={b.content} nurThemen={k.nurThemen} />;
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
          ohne={b.props?.ohne}
          schnappschuss={b.props?.schnappschuss}
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

/** Der kleine Kreis mit „i“ (W13) – „nur zur Info“; als Symbol gezeichnet, nicht als Buchstabe (die Schrift hat „ⓘ“ nicht überall). */
function InfoKreis() {
  return (
    <span className={styles.info} role="img" aria-label="nur zur Info">
      i
    </span>
  );
}

/**
 * Eine Tabelle (K3a) – Kopfzeilen als `th`, verbundene Zellen und Zellfarben wie im Editor. Seit W13 trägt die erste Zelle
 * einer Zeile ggf. „↳ “ (Unterzeile: eingerückt, gestrichelte Linie) und „ⓘ “ (nur zur Info: Kreis-Symbol, Legende
 * darunter); `nurThemen` blendet die Info-Zeilen samt ihren Unterzeilen aus (`ausgeblendet`).
 */
function Tabelle({ content, nurThemen }: { content: unknown; nurThemen: boolean }) {
  const thema = useThema();
  const zeilen = tabellenZeilen(content);
  if (!zeilen?.length) return null;
  const arten: ZeilenArt[] = zeilenArten(zeilen);
  const info = anzahlInfo(arten);
  const weglassen = nurThemen ? ausgeblendet(arten) : arten.map(() => false);
  const weg = weglassen.filter(Boolean).length;
  const spalten = Math.max(1, ...zeilen.map((z) => z.length));
  return (
    <div className={styles.tabelle}>
      <table>
        <tbody>
          {zeilen.map((zellen, z) => {
            if (weglassen[z]) return null;
            return (
              <tr key={z} className={arten[z].unter ? styles.unterzeile : undefined}>
                {zellen.map((c, s) => {
                  const Zelle = c.kopf ? 'th' : 'td';
                  const erste = s === 0 ? ohneKennzeichen(c.inhalt) : null;
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
                      {erste?.art.unter && (
                        <span className={styles.unterZeichen} aria-label="Unterzeile">
                          ↳
                        </span>
                      )}
                      {erste?.art.info && <InfoKreis />}
                      <Inhalt content={erste ? erste.inhalt : c.inhalt} />
                    </Zelle>
                  );
                })}
              </tr>
            );
          })}
          {weg > 0 && (
            <tr className={styles.ausgeblendet}>
              <td colSpan={spalten}>
                {weg === 1 ? '1 Info-Zeile ausgeblendet' : `${weg} Info-Zeilen ausgeblendet`}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {info > 0 && !nurThemen && (
        <p className={styles.legende}>
          <InfoKreis /> {INFO_LEGENDE}
        </p>
      )}
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
  const [nurThemen, setNurThemen] = useState(false);
  const hatInfo = dokumentHatInfo(dokument);
  const k: Kontext = {
    nurThemen: hatInfo && nurThemen,
    punkte: new Map(a.punkte.map((p) => [p.blockId, p])),
    aufgaben: new Map(aufgaben.map((x) => [x.id, x])),
    markiert,
  };
  if (!dokument.length) return <p className={styles.leer}>Das Protokoll ist noch leer.</p>;
  return (
    <article className={styles.blatt}>
      {hatInfo && (
        <label className={styles.nurThemen}>
          <input
            type="checkbox"
            checked={nurThemen}
            onChange={(e) => setNurThemen(e.target.checked)}
          />
          Nur Themen dieses Treffens
        </label>
      )}
      <Bloecke bloecke={dokument} k={k} />
    </article>
  );
}
