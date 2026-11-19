import { Icon } from '@ui/icons/icons';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { initialenAus, type Person } from '@shared/organigramm/mitglieder';
import {
  erledigtVon,
  nameFuer,
  nameImVerlauf,
  teilStand,
  weitereZustaendige,
  zustaendigKurz,
  type Aufgabe,
} from '@shared/protokolle/aufgaben';
import { ohneHerkunft } from '@shared/protokolle/uebersicht';
import type { Herkunft } from './ToDoFenster';
import { erledigtSatz, kurzDatum } from './todoText';
import styles from './ToDoBausteine.module.scss';

/**
 * Die Bausteine der To-Do-Karte und der Tabellenzeile (W8b, Entwurf `todos-vorschlaege-v2`): Gesichter, Symbole, die
 * Liste „Wer ist fertig?“, „Erledigt von …“. Sie zeichnen nur – was „fertig“, „erledigt von“ oder „zuständig“ heißt, sagen
 * die Funktionen in `@shared/protokolle/aufgaben`.
 */

/** Eine Person, die die Liste nicht kennt, aber mit Namen im Verlauf steht, bekommt ein Gesicht mit Initialen. */
function bekannt(
  a: Pick<Aufgabe, 'verlauf'>,
  p: number,
  personen: ReadonlyMap<number, Person>,
): Person | null {
  const x = personen.get(p);
  if (x) return x;
  const n = nameImVerlauf(a, p);
  return n ? { id: p, name: n, bild: null, initialen: initialenAus(n) } : null;
}

/**
 * **Die Zuständigen als Gesichter** (höchstens 3, bei mehr 2 und „+N“); der Tooltip nennt alle Namen, Externe stehen als
 * Text daneben, ohne jemanden „niemand“. `mitName`: bei genau einer Person (oder allen der Gruppe, `gruppeGroesse`) auch der
 * Name – in der Tabelle.
 */
export function Gesichter({
  a,
  personen,
  mitName = false,
  gruppeGroesse,
}: {
  a: Pick<Aufgabe, 'wer' | 'extern' | 'verlauf'>;
  personen: ReadonlyMap<number, Person>;
  mitName?: boolean;
  gruppeGroesse?: number;
}) {
  const extern = a.extern.trim();
  if (!a.wer.length)
    return extern ? (
      <span className={styles.extern}>{extern}</span>
    ) : (
      <span className={styles.niemand}>niemand</span>
    );
  const gesichter = a.wer.flatMap((p) => bekannt(a, p, personen) ?? []);
  const max = a.wer.length > 3 ? 2 : 3;
  const zeig = gesichter.slice(0, max);
  const rest = a.wer.length - zeig.length;
  const namen = [
    ...a.wer.flatMap((p) => {
      const x = personen.get(p);
      return x ? [x.name.split(' ')[0]] : [];
    }),
    ...weitereZustaendige(
      a,
      a.wer.filter((p) => !personen.has(p)),
    ),
  ];
  const voll = zustaendigKurz(namen).voll;
  const name =
    !mitName || a.wer.length === 0
      ? null
      : a.wer.length === 1
        ? (namen[0] ?? null)
        : gruppeGroesse === a.wer.length
          ? `Alle (${a.wer.length})`
          : null;
  return (
    <span className={styles.zustaendig}>
      <span className={styles.stapel} role="img" aria-label={`Zuständig: ${voll}`} title={voll}>
        {zeig.map((p) => (
          <span key={p.id} className={styles.gesicht}>
            <PersonBild name={p.name} bild={p.bild} initialen={p.initialen} groesse={22} />
          </span>
        ))}
        {rest > 0 && <span className={`${styles.gesicht} ${styles.mehr}`}>+{rest}</span>}
      </span>
      {name && <span className={styles.name}>{name}</span>}
      {extern && <span className={styles.extern}>{extern}</span>}
    </span>
  );
}

/**
 * **Die Symbole „mehr dahinter“**: bei „Jeder für sich“ ☑ 2/5 als Knopf (klappt auf, wer fertig ist), Notizen mit Anzahl, aus
 * einer Sitzung (führt ins Protokoll). Gilt in Liste, Tabelle und Board.
 */
export function Symbole({
  a,
  herkunft,
  fertigOffen,
  onFertig,
  onSitzung,
}: {
  a: Aufgabe;
  herkunft: Herkunft | null;
  fertigOffen: boolean;
  onFertig: () => void;
  onSitzung: () => void;
}) {
  const stand = teilStand(a);
  const notizen = a.verlauf.filter((v) => v.art === 'notiz').length;
  return (
    <>
      {stand && (
        <button
          type="button"
          className={`${styles.symbol} ${stand.fertig === stand.gesamt ? styles.voll : ''}`}
          aria-expanded={fertigOffen}
          aria-label={`Wer ist fertig? ${stand.fertig} von ${stand.gesamt}`}
          title="Jeder für sich – wer ist fertig?"
          onClick={onFertig}
        >
          <Icon name="aufgabe" size={14} />
          {stand.fertig}/{stand.gesamt}
        </button>
      )}
      {notizen > 0 && (
        <span className={styles.symbol} title={`${notizen} ${notizen === 1 ? 'Notiz' : 'Notizen'}`}>
          <Icon name="sprechblase" size={14} />
          {notizen}
        </span>
      )}
      {a.sitzung !== null &&
        (herkunft ? (
          <button
            type="button"
            className={styles.symbol}
            title={`Aus ${herkunft.titel} – im Protokoll zeigen`}
            aria-label={`Aus ${herkunft.titel} – im Protokoll zeigen`}
            onClick={onSitzung}
          >
            <Icon name="dokument" size={14} />
          </button>
        ) : (
          <span className={styles.symbol} title={ohneHerkunft(a)}>
            <Icon name="dokument" size={14} />
          </span>
        ))}
    </>
  );
}

/** **Wer ist fertig?** – bei „Jeder für sich“ unter dem Titel bzw. unter der Tabellenzeile: Name und „✓ 12.11.“ oder „offen“. */
export function FertigListe({
  a,
  ich,
  personen,
  namen,
}: {
  a: Aufgabe;
  ich: number;
  personen: ReadonlyMap<number, Person>;
  namen: ReadonlyMap<number, string>;
}) {
  return (
    <ul className={styles.fertigListe} aria-label="Wer ist fertig?">
      {a.wer.map((p) => {
        const am = a.fertig?.[String(p)];
        const x = bekannt(a, p, personen);
        const name = p === ich ? 'du' : (nameFuer(a, p, namen) ?? 'jemand');
        return (
          <li key={p}>
            {x && <PersonBild name={x.name} bild={x.bild} initialen={x.initialen} groesse={20} />}
            <span className={styles.fertigName}>{name}</span>
            {am ? (
              <span className={styles.ok}>✓ {kurzDatum(am)}</span>
            ) : (
              <span className={styles.offen}>offen</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Der Satz aus `erledigtSatz` mit dem Gesicht davor (Fußzeile erledigter Karten); `kurz`: nur Gesicht und Datum (Tabelle). */
export function ErledigtVon({
  a,
  ich,
  personen,
  namen,
  kurz = false,
}: {
  a: Aufgabe;
  ich: number;
  personen: ReadonlyMap<number, Person>;
  namen: ReadonlyMap<number, string>;
  /** Nur Gesicht und Datum (Spalte „Stand“ der Tabelle); der Satz steht im Tooltip. */
  kurz?: boolean;
}) {
  const e = erledigtVon(a);
  const satz = erledigtSatz(a, ich, (p) => nameFuer(a, p, namen));
  const von = e && teilStand(a) === null ? e.von[0] : undefined;
  const x = von === undefined ? null : bekannt(a, von, personen);
  return (
    <span className={styles.erledigtVon} title={kurz ? satz : undefined}>
      {x && <PersonBild name={x.name} bild={x.bild} initialen={x.initialen} groesse={22} />}
      {kurz && e ? kurzDatum(e.am) : satz}
    </span>
  );
}
