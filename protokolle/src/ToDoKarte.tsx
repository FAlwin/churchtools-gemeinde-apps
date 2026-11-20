import { Haken } from './Haken';
import { Etikett } from '@ui/bedienung/Etikett';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { FristKaestchen } from './FristKaestchen';
import { ErledigtVon, FertigListe, Gesichter, Symbole } from './ToDoBausteine';
import type { Herkunft } from './ToDoFenster';
import type { Person } from '@shared/organigramm/mitglieder';
import {
  istJeder,
  letzteNotiz,
  nameFuer,
  teilStand,
  teilText,
  type Aufgabe,
  type HakenSchritt,
  type ToDoRechte,
} from '@shared/protokolle/aufgaben';
import { eintragSchluessel, type Spalte, type ToDoEintrag } from '@shared/protokolle/uebersicht';
import styles from './ToDoKarte.module.scss';

/**
 * **Karte und Tabellenzeile eines To-Dos** (W8b, Entwurf `todos-vorschlaege-v2`) – Liste am Handy, Board überall: die Karte
 * (Haken · Gruppe · Titel · Fußzeile); Liste am PC: die Tabellenzeile (feste Spalten). Beide zeigen dasselbe, eine Regel für
 * Frist (`fristAnzeige`), Haken (`hakenSchritt`) und „erledigt von“ (`erledigtVon`) steckt in `@shared/protokolle`.
 */

/** Was für alle Karten einer Übersicht gleich ist. */
export interface KartenKontext {
  ich: { person: number; name: string };
  heute: string;
  personen: ReadonlyMap<number, Person>;
  namen: ReadonlyMap<number, string>;
  /** Die Gruppe steht nur dabei, wenn mehrere Gruppen im Spiel sind. */
  mehrereGruppen: boolean;
  /** Schlüssel (`eintragSchluessel`) der Karten, bei denen „Wer ist fertig?“ aufgeklappt ist. */
  fertigOffen: ReadonlySet<string>;
  onFertig: (schluessel: string) => void;
  onOeffnen: (e: ToDoEintrag) => void;
  onHaken: (e: ToDoEintrag, s: HakenSchritt) => void;
  /** „Das mache ich“ (W9a): mich als Zuständigen eintragen – bei einem To-Do ohne Zuständigen. */
  onMache: (e: ToDoEintrag) => void;
  onRueckgaengig: (e: ToDoEintrag) => void;
  onSitzung: (gruppe: number, schluessel: string) => void;
}

/** Ein To-Do, wie es gerade gezeigt wird. */
export interface KartenEintrag {
  e: ToDoEintrag;
  /** Der Stand, der angezeigt wird (nach dem Abhaken schon der neue, die Karte bleibt aber 5 s am Platz). */
  a: Aufgabe;
  herkunft: Herkunft | null;
  /** Was ich hier darf (`toDoRechte`) – die einzige Quelle für Haken und „Das mache ich“. */
  rechte: ToDoRechte;
  /** Eben abgehakt: „Rückgängig“ steht an der Karte. */
  gehalten: boolean;
  /** Darf ich hier abhaken (Gruppe mit Mitarbeit, nicht gehalten)? */
  darfHaken: boolean;
  beschaeftigt: boolean;
  /** Wie viele Mitglieder die Gruppe hat (für „Alle (5)“); unbekannt, wenn die Liste verborgen ist. */
  gruppeGroesse?: number;
}

/** „Das mache ich“ – statt der Gesichter bei einem To-Do ohne Zuständigen (W9a, nur für Mitglieder, `rechte.mache`). */
function MacheKnopf({ k, kx }: { k: KartenEintrag; kx: KartenKontext }) {
  return (
    // Die 40 px Treffläche des `TextKnopf` macht die Karte nicht höher (wie beim Haken).
    <span className={styles.mache}>
      <TextKnopf disabled={k.beschaeftigt} onClick={() => kx.onMache(k.e)}>
        Das mache ich
      </TextKnopf>
    </span>
  );
}

function HakenKnopf({ k, kx }: { k: KartenEintrag; kx: KartenKontext }) {
  // Ohne Zuständigen kein Haken – nur Platz, damit der Titel bündig bleibt.
  if (k.rechte.mache) return <span className={styles.hakenPlatz} aria-hidden="true" />;
  return (
    <Haken
      a={k.a}
      ich={kx.ich.person}
      art="karte"
      beschaeftigt={k.beschaeftigt}
      onSchritt={k.darfHaken ? (s) => kx.onHaken(k.e, s) : undefined}
    />
  );
}

function Rueckgaengig({ k, kx }: { k: KartenEintrag; kx: KartenKontext }) {
  const t = teilText(k.a);
  return (
    <span className={styles.rueck} role="status">
      {istJeder(k.a) ? `Dein Teil ist erledigt · ${t ?? ''}` : 'Erledigt'}
      <button type="button" className={styles.link} onClick={() => kx.onRueckgaengig(k.e)}>
        Rückgängig
      </button>
    </span>
  );
}

/** Die Karte. `spalteArt`: im Board die Spalte – in „In Arbeit“ braucht es das Schild „in Arbeit“ nicht. */
export function ToDoKarte({
  k,
  kx,
  imBoard = false,
  spalteArt,
}: {
  k: KartenEintrag;
  kx: KartenKontext;
  imBoard?: boolean;
  spalteArt?: Spalte['art'];
}) {
  const { e, a } = k;
  const schluessel = eintragSchluessel(e);
  const erledigt = a.status === 'erledigt';
  const notiz = a.karte?.notiz && !erledigt && !k.gehalten ? letzteNotiz(a) : null;
  const fertigOffen = kx.fertigOffen.has(schluessel) && !k.gehalten && teilStand(a) !== null;
  const schild = a.status === 'arbeit' && !istJeder(a) && !(imBoard && spalteArt === 'arbeit');

  const fuss = k.gehalten ? (
    <div className={styles.fuss}>
      <Rueckgaengig k={k} kx={kx} />
    </div>
  ) : erledigt ? (
    <div className={styles.fuss}>
      <ErledigtVon a={a} ich={kx.ich.person} personen={kx.personen} namen={kx.namen} />
    </div>
  ) : (
    <div className={styles.fuss}>
      <FristKaestchen a={a} heute={kx.heute} />
      {schild && <Etikett ton="blau">in Arbeit</Etikett>}
      <Symbole
        a={a}
        herkunft={k.herkunft}
        fertigOffen={fertigOffen}
        onFertig={() => kx.onFertig(schluessel)}
        onSitzung={() => k.herkunft && kx.onSitzung(e.gruppe.id, k.herkunft.schluessel)}
      />
      <span className={styles.rechts}>
        {k.rechte.mache ? <MacheKnopf k={k} kx={kx} /> : <Gesichter a={a} personen={kx.personen} />}
      </span>
    </div>
  );

  return (
    <div className={`${styles.todo}${imBoard ? ' ' + styles.imBoard : ''}`}>
      <HakenKnopf k={k} kx={kx} />
      <div className={styles.koerper}>
        {kx.mehrereGruppen && <span className={styles.gruppe}>{e.gruppe.name}</span>}
        <button
          type="button"
          className={`${styles.titel}${erledigt || (k.gehalten && !istJeder(a)) ? ' ' + styles.durch : ''}`}
          title="To-Do öffnen"
          onClick={() => kx.onOeffnen(e)}
        >
          {a.text}
        </button>
        {notiz && (
          <span className={styles.notizzeile}>
            „{notiz.text}“ –{' '}
            {notiz.von === kx.ich.person
              ? kx.ich.name
              : (nameFuer(a, notiz.von, kx.namen) ?? 'jemand')}
          </span>
        )}
        {fertigOffen && (
          <FertigListe a={a} ich={kx.ich.person} personen={kx.personen} namen={kx.namen} />
        )}
        {!imBoard && fuss}
      </div>
      {imBoard && fuss}
    </div>
  );
}

/** Die Kopfzeile der Tabelle (Spaltenüberschriften). */
export function TabellenKopf({ mitGruppe }: { mitGruppe: boolean }) {
  return (
    <div
      className={`${styles.tabKopf} ${mitGruppe ? styles.mitGruppe : styles.ohneGruppe}`}
      aria-hidden="true"
    >
      <span>Aufgabe</span>
      {mitGruppe && <span>Gruppe</span>}
      <span>Fällig</span>
      <span>Zuständig</span>
      <span>Stand</span>
      <span>Überblick</span>
    </div>
  );
}

/** „Stand“ in Worten: offen grau, „in Arbeit“ blau, „2 von 5 fertig“, erledigt mit Gesicht und Datum. */
function Stand({ k, kx }: { k: KartenEintrag; kx: KartenKontext }) {
  const { a } = k;
  const t = teilText(a);
  if (t) return <Etikett ton={a.status === 'erledigt' ? 'gruen' : 'neutral'}>{t}</Etikett>;
  if (a.status === 'erledigt')
    return <ErledigtVon a={a} ich={kx.ich.person} personen={kx.personen} namen={kx.namen} kurz />;
  if (a.status === 'arbeit') return <Etikett ton="blau">in Arbeit</Etikett>;
  return <span className={styles.leise}>offen</span>;
}

/** Eine Tabellenzeile (Liste am PC). */
export function ToDoZeile({
  k,
  kx,
  mitGruppe,
}: {
  k: KartenEintrag;
  kx: KartenKontext;
  mitGruppe: boolean;
}) {
  const { e, a } = k;
  const schluessel = eintragSchluessel(e);
  const erledigt = a.status === 'erledigt';
  const fertigOffen = kx.fertigOffen.has(schluessel) && !k.gehalten && teilStand(a) !== null;
  return (
    <>
      <div className={`${styles.zeile} ${mitGruppe ? styles.mitGruppe : styles.ohneGruppe}`}>
        <HakenKnopf k={k} kx={kx} />
        {k.gehalten ? (
          <div className={styles.zeileRueck}>
            <button
              type="button"
              className={`${styles.titel}${erledigt || !istJeder(a) ? ' ' + styles.durch : ''}`}
              title="To-Do öffnen"
              onClick={() => kx.onOeffnen(e)}
            >
              {a.text}
            </button>
            <Rueckgaengig k={k} kx={kx} />
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.titel} ${styles.einzeilig}${erledigt ? ' ' + styles.durch : ''}`}
              title={a.text}
              onClick={() => kx.onOeffnen(e)}
            >
              {a.text}
            </button>
            {mitGruppe && (
              <span className={`${styles.zelle} ${styles.gruppe}`}>{e.gruppe.name}</span>
            )}
            <span className={styles.zelle}>
              <FristKaestchen a={a} heute={kx.heute} />
              {!a.bis && <span className={styles.leise}>–</span>}
            </span>
            <span className={styles.zelle}>
              {k.rechte.mache ? (
                <MacheKnopf k={k} kx={kx} />
              ) : (
                <Gesichter a={a} personen={kx.personen} mitName gruppeGroesse={k.gruppeGroesse} />
              )}
            </span>
            <span className={styles.zelle}>
              <Stand k={k} kx={kx} />
            </span>
            <span className={`${styles.zelle} ${styles.ueber}`}>
              <Symbole
                a={a}
                herkunft={k.herkunft}
                fertigOffen={fertigOffen}
                onFertig={() => kx.onFertig(schluessel)}
                onSitzung={() => k.herkunft && kx.onSitzung(e.gruppe.id, k.herkunft.schluessel)}
              />
            </span>
          </>
        )}
      </div>
      {fertigOffen && (
        <div className={styles.zeileAuf}>
          <FertigListe a={a} ich={kx.ich.person} personen={kx.personen} namen={kx.namen} />
        </div>
      )}
    </>
  );
}
