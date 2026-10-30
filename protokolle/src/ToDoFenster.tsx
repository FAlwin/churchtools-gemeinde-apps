import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { tagAusIso } from '@shared/ct/zeit';
import { tagKurz } from '@shared/ct/datum';
import { initialenAus, type Person } from '@shared/organigramm/mitglieder';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import {
  nameFuer,
  statusText,
  weitereZustaendige,
  type AufgabenStatus,
  type ToDoAenderung,
  type VerlaufEintrag,
} from '@shared/protokolle/aufgaben';
import { ohneHerkunft, type ToDoEintrag } from '@shared/protokolle/uebersicht';
import { Einladeliste } from './Planungsfelder';
import { toDoAendern, toDoAnlegen, toDoLoeschen, toDoVerschieben } from './todoSchreiben';
import felder from './Fensterfelder.module.scss';
import styles from './ToDoFenster.module.scss';

const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const ZEICHEN = { offen: 'kreis', arbeit: 'kreis-halb', erledigt: 'kreis-haken' } as const;
const STATUS: AufgabenStatus[] = ['offen', 'arbeit', 'erledigt'];

/** Woher das To-Do stammt – `entwurf`: das Protokoll ist noch ein Entwurf (dort führt das Protokoll Text und Dasein). */
export interface Herkunft {
  titel: string;
  schluessel: string;
  entwurf: boolean;
}

function verlaufText(v: VerlaufEintrag): string {
  if (v.art === 'angelegt') return 'angelegt';
  if (v.art === 'status') return `Status: ${statusText(v.status ?? 'offen')}`;
  if (v.art === 'notiz') return `Notiz: ${v.text ?? ''}`;
  if (v.art === 'geloescht') return 'gelöscht';
  return 'wiederhergestellt';
}

/** Ein Knopf mit Schalter – der Schalter ist nur Anzeige (`ui` Schalter), bedient wird der Knopf. */
function SchalterKnopf({
  an,
  onClick,
  children,
}: {
  an: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" className={styles.schalterKnopf} aria-pressed={an} onClick={onClick}>
      <Schalter an={an} />
      {children}
    </button>
  );
}

/**
 * **Fenster „To-Do“ / „Neues To-Do“** (Bauplan S7-2a, Entwurf `s7-todos-v2.html`): Text, Gruppe, Bis, Status, Zuständige
 * (auch niemand, auch jemand außerhalb der Gruppe), Notiz, Verlauf, Löschen (nur vermerkt) – und je Abschnitt „Auf Karte
 * anzeigen“ (für alle gespeichert). Steht das To-Do noch in einem **Protokoll-Entwurf**, führt dort das Protokoll: Text,
 * Gruppe und Löschen sind dann hier gesperrt (Nachziehen im Protokoll kommt mit S7-2b). Wer als Mitglied sich selbst
 * nicht einträgt, sieht das To-Do danach nicht mehr – das Fenster sagt es vorher (Alwin, Frage 3).
 */
export function ToDoFenster({
  ich,
  modul,
  gruppen,
  mitglieder,
  eintrag,
  herkunft,
  leitungIn,
  onSitzung,
  onFertig,
  onClose,
}: {
  ich: { person: number; name: string };
  modul: number;
  /** Gruppen mit „Mitarbeit“ – dort liegen die To-Dos. */
  gruppen: readonly ProtokollGruppe[];
  /** Mitglieder je Gruppe (`verborgen`: die Liste ist für mich nicht sichtbar). */
  mitglieder: ReadonlyMap<number, Person[] | 'verborgen'>;
  /** `null` = neues To-Do. */
  eintrag: ToDoEintrag | null;
  herkunft: Herkunft | null;
  leitungIn: (g: ProtokollGruppe) => boolean;
  onSitzung: (gruppe: number, schluessel: string) => void;
  /** Gespeichert – die Übersicht lädt neu; `hinweis`, wenn etwas nur halb ging. */
  onFertig: (hinweis: string | null) => void;
  onClose: () => void;
}) {
  const a = eintrag?.aufgabe ?? null;
  const [neueId] = useState(() => crypto.randomUUID());
  const [text, setText] = useState(a?.text ?? '');
  const [gruppeId, setGruppeId] = useState(eintrag?.gruppe.id ?? gruppen[0]?.id ?? 0);
  const [bis, setBis] = useState(a?.bis ?? '');
  const [status, setStatus] = useState<AufgabenStatus>(a?.status ?? 'offen');
  const [wer, setWer] = useState<ReadonlySet<number>>(() => new Set(a ? a.wer : []));
  const [extern, setExtern] = useState(a?.extern ?? '');
  const [notiz, setNotiz] = useState('');
  const [karteNotiz, setKarteNotiz] = useState(!!a?.karte?.notiz);
  const [karteSitzung, setKarteSitzung] = useState(!!a?.karte?.sitzung);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);

  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0];
  const imEntwurf = !!herkunft?.entwurf;
  const liste = mitglieder.get(gruppeId);
  const bekannt: Person[] =
    Array.isArray(liste) && liste.length
      ? liste
      : [{ id: ich.person, name: ich.name, bild: null, initialen: initialenAus(ich.name) }];
  const kennt = new Set(bekannt.map((p) => p.id));
  // Zuständige, die das Fenster nicht als Mitglied kennt (Liste verborgen), bleiben zuständig.
  const weitere = [...wer].filter((p) => !kennt.has(p));
  const listeNamen = new Map(bekannt.map((p) => [p.id, p.name]));
  const name = (p: number) => nameFuer(a ?? { verlauf: [] }, p, listeNamen) ?? 'jemand';
  const verschoben = !!a && gruppeId !== eintrag?.gruppe.id;

  // Frage 3: Mitglieder sehen nur eigene und solche ohne Zuständigen.
  const ohneMich =
    !!gruppe && !leitungIn(gruppe) && !wer.has(ich.person) && (wer.size > 0 || !!extern.trim());

  const gleicheMenge = (x: ReadonlySet<number>, y: readonly number[]) =>
    x.size === y.length && y.every((p) => x.has(p));
  const aenderung = (): ToDoAenderung => {
    if (!a) return {};
    const x: ToDoAenderung = {};
    if (!imEntwurf && text.trim() !== a.text) x.text = text;
    if (!gleicheMenge(wer, a.wer)) x.wer = [...wer];
    if (extern.trim() !== a.extern) x.extern = extern;
    if ((bis || null) !== a.bis) x.bis = bis || null;
    if (status !== a.status) x.status = status;
    if (notiz.trim()) x.notiz = notiz;
    if (karteNotiz !== !!a.karte?.notiz || karteSitzung !== !!a.karte?.sitzung)
      x.karte = { notiz: karteNotiz, sitzung: karteSitzung };
    return x;
  };
  const geaendert = !a || verschoben || Object.keys(aenderung()).length > 0;
  const bereit = !!gruppe && gruppe.mitarbeit !== null && !!text.trim() && geaendert && !laeuft;

  const ausfuehren = (arbeit: () => Promise<string | null>) => {
    setLaeuft(true);
    setFehler(null);
    arbeit().then(
      (hinweis) => {
        setLaeuft(false);
        onFertig(hinweis);
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  const speichern = () => {
    if (!bereit || !gruppe || gruppe.mitarbeit === null) return;
    const ort = { modul, kategorie: gruppe.mitarbeit };
    if (!a)
      return ausfuehren(() =>
        toDoAnlegen(
          ort,
          {
            neueId,
            gruppe: gruppe.id,
            text,
            wer: [...wer],
            extern,
            bis: bis || null,
            status,
            notiz,
            karte: { notiz: karteNotiz, sitzung: karteSitzung },
          },
          ich,
        ).then(() => null),
      );
    const alt = gruppen.find((g) => g.id === eintrag?.gruppe.id);
    if (verschoben && alt && alt.mitarbeit !== null) {
      const { wer: _wer, ...x } = aenderung();
      return ausfuehren(() =>
        toDoVerschieben({
          von: { ort: { modul, kategorie: alt.mitarbeit! }, name: alt.name },
          nach: { ort, gruppe: gruppe.id, name: gruppe.name },
          id: a.id,
          neueId,
          x,
          wer: [...wer],
          ich,
        }).then((r) => r.hinweis),
      );
    }
    ausfuehren(() => toDoAendern(ort, a.id, aenderung(), ich).then(() => null));
  };

  const loeschen = () => {
    if (!a || !gruppe || gruppe.mitarbeit === null) return;
    const ort = { modul, kategorie: gruppe.mitarbeit };
    setLoeschenFragen(false);
    ausfuehren(() => toDoLoeschen(ort, a.id, ich).then(() => null));
  };

  if (loeschenFragen)
    return (
      <ConfirmDialog
        title="To-Do löschen?"
        message={`„${a?.text ?? ''}“ verschwindet aus der Übersicht. Im Verlauf bleibt vermerkt, wer es gelöscht hat.`}
        confirmLabel="Löschen"
        onConfirm={loeschen}
        onCancel={() => setLoeschenFragen(false)}
        beschaeftigt={laeuft}
      />
    );

  return (
    <Sheet
      title={a ? 'To-Do' : 'Neues To-Do'}
      onClose={onClose}
      beschaeftigt={laeuft}
      links={
        a && !imEntwurf ? (
          <FensterKnopf art="loeschen" disabled={laeuft} onClick={() => setLoeschenFragen(true)}>
            Löschen
          </FensterKnopf>
        ) : undefined
      }
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={speichern}>
          {laeuft ? 'Wird gespeichert …' : a ? 'Speichern' : 'Anlegen'}
        </FensterKnopf>
      }
    >
      {imEntwurf && herkunft && (
        <p className={felder.hinweis}>
          Steht im Protokoll-Entwurf „{herkunft.titel}“ – Text und Löschen ändern sich dort, die
          Gruppe bleibt.
        </p>
      )}
      <label className={felder.feld}>
        <span>Was ist zu tun?</span>
        <textarea
          className={`${felder.eingabe} ${styles.text}`}
          value={text}
          rows={2}
          disabled={laeuft || imEntwurf}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className={felder.zeile}>
        <label className={felder.feld}>
          <span>Gruppe</span>
          <select
            className={felder.eingabe}
            value={gruppeId}
            disabled={laeuft || imEntwurf || gruppen.length < 2}
            onChange={(e) => {
              const g = Number(e.target.value);
              setGruppeId(g);
              // Zuständig sein können nur Mitglieder der Gruppe – wer dort nicht ist, fällt weg.
              const neu = mitglieder.get(g);
              if (Array.isArray(neu))
                setWer(new Set([...wer].filter((p) => neu.some((x) => x.id === p))));
            }}
          >
            {gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className={felder.feld}>
          <span>Bis</span>
          <input
            type="date"
            className={felder.eingabe}
            value={bis}
            disabled={laeuft}
            onChange={(e) => setBis(e.target.value)}
          />
        </label>
      </div>
      {verschoben && (
        <p className={felder.leise}>
          Das To-Do zieht nach „{gruppe?.name}“ um – die Verbindung zur Sitzung entfällt, der
          Verlauf zieht mit.
        </p>
      )}
      <div className={felder.feld}>
        <span>Status</span>
        <Segment
          value={status}
          options={STATUS.map((s) => ({
            value: s,
            name: gross(statusText(s)),
            label: (
              <span className={styles.status}>
                <Icon name={ZEICHEN[s]} size={16} />
                {gross(statusText(s))}
              </span>
            ),
          }))}
          onChange={setStatus}
          ariaLabel="Status"
          verbunden
        />
      </div>
      <div className={felder.feld}>
        <span>Zuständig</span>
        <Einladeliste
          liste={bekannt}
          gewaehlt={wer}
          onChange={setWer}
          gesperrt={laeuft}
          ich={ich.person}
          zusatz={(id) => (id === ich.person ? 'du' : null)}
        />
        {weitere.length > 0 && (
          <p className={felder.leise}>
            Außerdem zuständig: {weitereZustaendige(a ?? { verlauf: [] }, weitere).join(', ')} – das
            bleibt so.
          </p>
        )}
        <input
          className={felder.eingabe}
          value={extern}
          disabled={laeuft}
          placeholder="Außerhalb der Gruppe (nur Name)"
          aria-label="Außerhalb der Gruppe (nur Name)"
          onChange={(e) => setExtern(e.target.value)}
        />
        <p className={felder.leise}>Niemand angehakt = To-Do der Gruppe, noch ohne Zuständigen.</p>
      </div>
      {ohneMich && (
        <p className={felder.hinweis} role="note">
          Du bist nicht dabei – nach dem Speichern siehst du dieses To-Do nicht mehr (Mitglieder
          sehen nur ihre eigenen).
        </p>
      )}
      <div className={felder.feld}>
        <span className={styles.kopf}>
          Notizen
          <SchalterKnopf an={karteNotiz} onClick={() => setKarteNotiz(!karteNotiz)}>
            Auf Karte anzeigen
          </SchalterKnopf>
        </span>
        <textarea
          className={`${felder.eingabe} ${styles.text}`}
          value={notiz}
          rows={2}
          disabled={laeuft}
          placeholder="Neue Notiz – was ist der Stand? (kommt in den Verlauf)"
          aria-label="Neue Notiz"
          onChange={(e) => setNotiz(e.target.value)}
        />
      </div>
      {a && (
        <div className={felder.feld}>
          <span className={styles.kopf}>
            Aus welcher Sitzung
            {/* Ohne Sitzung zeigte die Karte nichts – der Schalter wäre wirkungslos (Test-Instanz 30.10.2026). */}
            {a.sitzung !== null && (
              <SchalterKnopf an={karteSitzung} onClick={() => setKarteSitzung(!karteSitzung)}>
                Auf Karte anzeigen
              </SchalterKnopf>
            )}
          </span>
          {herkunft ? (
            <button
              type="button"
              className={styles.link}
              onClick={() => eintrag && onSitzung(eintrag.gruppe.id, herkunft.schluessel)}
            >
              {herkunft.titel} – im Protokoll zeigen
            </button>
          ) : (
            <p className={felder.leise}>{ohneHerkunft(a)}</p>
          )}
        </div>
      )}
      {a && (
        <div className={felder.feld}>
          <span>Verlauf</span>
          <ul className={styles.verlauf}>
            {[...a.verlauf].reverse().map((v, i) => (
              <li key={i}>
                <time>{tagKurz(tagAusIso(v.am, zeitzone))}</time>
                <span>
                  <b>{v.von === ich.person ? ich.name : name(v.von)}</b> {verlaufText(v)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler.text}
        </p>
      )}
    </Sheet>
  );
}
