import { useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { gemeindeZeitzone, tagAusIso } from '@shared/ct/zeit';
import { datumText, tagKurz } from '@shared/ct/datum';
import { initialenAus, type Person } from '@shared/organigramm/mitglieder';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Nachziehen } from '@shared/protokolle/nachziehen';
import type { Sperre } from '@shared/protokolle/speicher';
import {
  bearbeiten,
  nameFuer,
  statusText,
  darfTeilSetzen,
  ohneZustaendige,
  teilFertig,
  toDoRechte,
  weitereZustaendige,
  type Aufgabe,
  type AufgabenStatus,
  type ToDoAenderung,
  type VerlaufEintrag,
} from '@shared/protokolle/aufgaben';
import { warumVon } from '@shared/protokolle/todoVorschlag';
import { ohneHerkunft, type ToDoEintrag } from '@shared/protokolle/uebersicht';
import { Einladeliste } from './Planungsfelder';
import { erledigtSatz } from './todoText';
import { imEntwurfNachziehen } from './nachziehen';
import { toDoAendern, toDoAnlegen, toDoLoeschen, toDoVerschieben } from './todoSchreiben';
import {
  todoVorschlagAendern,
  todoVorschlagUebernehmen,
  vorschlagAnlegen,
} from './todoVorschlagSchreiben';
import felder from './Fensterfelder.module.scss';
import styles from './ToDoFenster.module.scss';

const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const ZEICHEN = { offen: 'kreis', arbeit: 'kreis-halb', erledigt: 'kreis-haken' } as const;
const STATUS: AufgabenStatus[] = ['offen', 'arbeit', 'erledigt'];

/** Woher das To-Do stammt – `entwurf`: das Protokoll ist noch ein Entwurf (dort führt das Protokoll Text und Dasein). */
export interface Herkunft {
  titel: string;
  schluessel: string;
  entwurf: boolean;
}

function verlaufText(v: VerlaufEintrag, name: (p: number) => string): string {
  if (v.art === 'angelegt') return 'angelegt';
  if (v.art === 'status') return `Status: ${statusText(v.status ?? 'offen')}`;
  if (v.art === 'notiz') return `Notiz: ${v.text ?? ''}`;
  if (v.art === 'geloescht') return 'gelöscht';
  if (v.art === 'wiederhergestellt') return 'wiederhergestellt';
  if (v.art === 'teil')
    return `${v.person !== undefined ? name(v.person) : 'jemand'}: ${v.fertig ? 'Teil erledigt' : 'Teil wieder offen'}`;
  if (v.art === 'modus')
    return v.jeder ? 'So wird es erledigt: jeder für sich' : 'So wird es erledigt: gemeinsam';
  // Vorschläge (W9b).
  if (v.art === 'vorgeschlagen') return 'hat das vorgeschlagen';
  if (v.art === 'vorschlagGeaendert') return 'hat den Vorschlag geändert';
  if (v.art === 'uebernommen') return 'hat den Vorschlag übernommen';
  if (v.art === 'abgelehnt')
    return v.text ? `hat den Vorschlag abgelehnt: ${v.text}` : 'hat den Vorschlag abgelehnt';
  if (v.art === 'zurueckgezogen') return 'hat den Vorschlag zurückgezogen';
  if (v.art === 'zustaendig') {
    const wer = (l: readonly number[] | undefined) =>
      l?.length ? l.map(name).join(', ') : 'niemand';
    return `Zuständig: ${wer(v.vorher)} → ${wer(v.nachher)}`;
  }
  // Eine neuere Fassung kennt vielleicht Einträge, die diese noch nicht kennt.
  return 'geändert';
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

/** Was man nicht ändern darf, steht als normaler Text – Beschriftung und Wert, kein ausgegrautes Feld (W9a). */
function Lesen({
  titel,
  gross = false,
  children,
}: {
  titel: string;
  gross?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={felder.feld}>
      <span>{titel}</span>
      <p className={gross ? `${styles.wert} ${styles.wertGross}` : styles.wert}>{children}</p>
    </div>
  );
}

/**
 * **Fenster „To-Do“ / „Neues To-Do“** (Bauplan S7-2a, Entwurf `s7-todos-v2.html`): Text, Gruppe, Bis, Status, Zuständige
 * (auch niemand, auch jemand außerhalb der Gruppe), Notiz, Verlauf, Löschen (nur vermerkt) – und je Abschnitt „Auf Karte
 * anzeigen“ (für alle gespeichert). Steht das To-Do noch in einem **Protokoll-Entwurf**, führt dort das Protokoll: Text,
 * Gruppe und Löschen werden im Entwurf **nachgezogen** (S7-2b, `imEntwurfNachziehen`) – schreibt dort gerade jemand,
 * wird nichts gespeichert. Wer als Mitglied sich selbst nicht einträgt, sieht das To-Do danach nicht mehr – das Fenster
 * sagt es vorher (Alwin, Frage 3).
 */
export function ToDoFenster({
  ich,
  modul,
  gruppen,
  mitglieder,
  eintrag,
  vorlage,
  modus,
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
  /** Neues To-Do aus einer Board-Spalte (S7-3): Status bzw. Zuständige vorbelegt. */
  vorlage?: { status?: AufgabenStatus; wer?: number[] };
  /** Bei einem Vorschlag (W9b): die Leitung übernimmt ihn, oder wer vorschlug ändert ihn. */
  modus?: 'uebernehmen' | 'aendern';
  herkunft: Herkunft | null;
  leitungIn: (g: ProtokollGruppe) => boolean;
  onSitzung: (gruppe: number, schluessel: string) => void;
  /** Gespeichert – die Übersicht lädt neu; `hinweis`, wenn etwas nur halb ging. */
  onFertig: (hinweis: string | null) => void;
  onClose: () => void;
}) {
  const a = eintrag?.aufgabe ?? null;
  const [neueId] = useState(() => crypto.randomUUID());
  // Eigene Fenster-Kennung für die Schreibsperre des Protokolls (S7-2b) – wie ein Editor-Fenster.
  const [schreiber] = useState(() => ({ ...ich, fenster: crypto.randomUUID() }));
  const [text, setText] = useState(a?.text ?? '');
  const [gruppeId, setGruppeId] = useState(eintrag?.gruppe.id ?? gruppen[0]?.id ?? 0);
  const [bis, setBis] = useState(a?.bis ?? '');
  const [status, setStatus] = useState<AufgabenStatus>(a?.status ?? vorlage?.status ?? 'offen');
  // „Jeder für sich“ (W8a): gewählter Modus und welche Teile ich im Fenster umgeschaltet habe (gegenüber dem Stand,
  // den der Modus ergäbe – `vorschau`).
  const [jederWahl, setJederWahl] = useState(a?.jeder === true);
  const [umgeschaltet, setUmgeschaltet] = useState<ReadonlySet<number>>(new Set());
  const [werWahl, setWer] = useState<ReadonlySet<number>>(
    () => new Set(a ? a.wer : (vorlage?.wer ?? [])),
  );
  const [externWahl, setExtern] = useState(a?.extern ?? '');
  // Abgeben (W9a, eigenes To-Do eines Mitglieds): an wen – `null` = nicht abgeben.
  const [abgebenAn, setAbgebenAn] = useState<number | null>(null);
  const [notiz, setNotiz] = useState('');
  const [karteNotiz, setKarteNotiz] = useState(!!a?.karte?.notiz);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  // Neues To-Do als Mitarbeiter (W9b): für mich oder als Vorschlag an die Gruppe. „Warum?“ ist beim Vorschlag die erste Notiz.
  const [ziel, setZiel] = useState<'mich' | 'gruppe'>('mich');
  const [warum, setWarum] = useState(a?.vorschlag ? warumVon(a) : '');

  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0];
  const imEntwurf = !!herkunft?.entwurf;
  // **Was ich hier darf** (W9a) – `toDoRechte`, die eine Regel (dieselbe prüft der Schreibweg). Ein bestehendes To-Do richtet
  // sich nach seiner Gruppe, ein neues nach der gewählten. Ein Mitglied legt nur To-Dos für sich selbst an.
  const urspruenglich = eintrag ? gruppen.find((g) => g.id === eintrag.gruppe.id) : gruppe;
  const leitungOrig = !!urspruenglich && leitungIn(urspruenglich);
  // Ein Vorschlag (W9b): Wer vorschlug, ändert ihn (eigenes Fenster-Formular); die Leitung übernimmt – dann gilt er wie ein
  // gewöhnliches To-Do, an dem sie alles wählt (`toDoRechte` ohne Kennzeichen), bis „Übernehmen“ das Kennzeichen entfernt.
  const rVorschlag = a?.vorschlag ? toDoRechte(a, { ich: ich.person, leitung: leitungOrig }) : null;
  const uebernehmen = modus === 'uebernehmen' && !!rVorschlag?.uebernehmen;
  const vorschlagAendernRecht = modus === 'aendern' && !!rVorschlag?.vorschlagAendern;
  const r = a
    ? toDoRechte(uebernehmen ? { ...a, vorschlag: undefined } : a, {
        ich: ich.person,
        leitung: leitungOrig,
        imEntwurf,
      })
    : null;
  const neuMitglied = !a && !leitungOrig;
  const vorschlagNeu = neuMitglied && ziel === 'gruppe';
  const vorschlagForm = vorschlagNeu || vorschlagAendernRecht;
  const wer: ReadonlySet<number> = neuMitglied ? new Set([ich.person]) : werWahl;
  const extern = neuMitglied ? '' : externWahl;
  const darf = {
    text: r ? r.text : true,
    frist: r ? r.frist : true,
    gruppe: r ? r.gruppe && !uebernehmen : true,
    zustaendig: r ? r.zustaendig : leitungOrig,
    notiz: r ? r.notiz : true,
    status: r ? r.status : true,
    karte: r ? r.karte : true,
    modus: r ? r.modus : leitungOrig,
  };
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
    darf.zustaendig &&
    !!gruppe &&
    !leitungIn(gruppe) &&
    !wer.has(ich.person) &&
    (wer.size > 0 || !!extern.trim());

  const gleicheMenge = (x: ReadonlySet<number>, y: readonly number[]) =>
    x.size === y.length && y.every((p) => x.has(p));
  // „Jeder für sich“ gibt es nur ab zwei Zuständigen (Mitglieder; Externe zählen nicht).
  const jederAn = jederWahl && wer.size >= 2;
  // So stünde das To-Do nach dem Speichern, **ohne** meine Umschalter – daraus kommt, wer als fertig angezeigt wird.
  const vorschau: Aufgabe | null = a
    ? bearbeiten(a, { wer: [...wer], jeder: jederAn }, 0, '1970-01-01T00:00:00.000Z')
    : null;
  const teilJetzt = (p: number): boolean =>
    (vorschau ? teilFertig(vorschau, p) : false) !== umgeschaltet.has(p);
  const teile = (): { person: number; fertig: boolean }[] =>
    jederAn
      ? [...umgeschaltet]
          .filter((p) => wer.has(p))
          .map((p) => ({ person: p, fertig: !(vorschau ? teilFertig(vorschau, p) : false) }))
      : [];
  const aenderung = (): ToDoAenderung => {
    if (!a) return {};
    const x: ToDoAenderung = {};
    if (text.trim() !== a.text) x.text = text;
    if (!gleicheMenge(wer, a.wer)) x.wer = [...wer];
    if (abgebenAn !== null && r?.abgeben) x.wer = [abgebenAn];
    if (extern.trim() !== a.extern) x.extern = extern;
    if ((bis || null) !== a.bis) x.bis = bis || null;
    if (jederAn !== (a.jeder === true && a.wer.length >= 2) && (jederAn || a.jeder === true))
      x.jeder = jederAn;
    if (teile().length) x.teile = teile();
    if (!jederAn && status !== a.status) x.status = status;
    if (notiz.trim()) x.notiz = notiz;
    if (karteNotiz !== !!a.karte?.notiz) x.karte = { notiz: karteNotiz };
    return x;
  };
  const geaendert = !a || verschoben || uebernehmen || Object.keys(aenderung()).length > 0;
  const vorschlagGeaendert =
    vorschlagNeu ||
    (!!a &&
      (text.trim() !== a.text || (bis || null) !== a.bis || warum.trim() !== warumVon(a).trim()));
  const bereit =
    !!gruppe &&
    gruppe.mitarbeit !== null &&
    !!text.trim() &&
    (vorschlagForm ? vorschlagGeaendert : geaendert) &&
    !laeuft;

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

  /**
   * **Im Protokoll-Entwurf nachziehen** (S7-2b), dann `danach` – oder, steht es nicht (mehr) im Entwurf, nur `sonst`
   * (der Weg aus S7-2a). Schreibt jemand am Protokoll, wird nichts gespeichert: Meldung mit Namen.
   */
  const mitEntwurf = (
    n: Nachziehen,
    sonst: () => Promise<string | null>,
    q: { zuvor?: () => Promise<string | null>; danach?: () => Promise<string | null> } = {},
  ): Promise<string | null> => {
    const her = gruppen.find((g) => g.id === eintrag?.gruppe.id);
    if (
      !imEntwurf ||
      !a ||
      a.sitzung === null ||
      !her ||
      her.protokolle === null ||
      her.mitarbeit === null
    )
      return sonst();
    return imEntwurfNachziehen({
      ort: { modul, kategorie: her.protokolle, sitzung: a.sitzung },
      mitarbeit: { modul, kategorie: her.mitarbeit },
      gruppe: her.id,
      aufgabe: a.id,
      n,
      ich: schreiber,
      zuvor: q.zuvor,
    }).then(async (r) => {
      if (r.art === 'kein-entwurf') return sonst();
      if (r.art === 'gesperrt') throw new ApiError(409, gesperrtText(r.sperre));
      const nachher = q.danach ? await q.danach() : null;
      return r.hinweis ?? nachher;
    });
  };
  const gesperrtText = (s: Sperre) =>
    `${s.von === ich.person ? 'Du schreibst in einem anderen Fenster' : `${s.name} schreibt gerade`} am Protokoll „${herkunft?.titel ?? ''}“ – Text, Gruppe und Löschen gehen danach. Gespeichert wurde nichts.`;

  const speichern = () => {
    if (!bereit || !gruppe || gruppe.mitarbeit === null) return;
    const ort = { modul, kategorie: gruppe.mitarbeit };
    // Vorschlagen oder den eigenen Vorschlag ändern (W9b).
    if (vorschlagForm)
      return ausfuehren(() =>
        (a
          ? todoVorschlagAendern(ort, a.id, { text, bis: bis || null, warum }, ich, leitungOrig)
          : vorschlagAnlegen(
              ort,
              { neueId, gruppe: gruppe.id, text, bis: bis || null, warum },
              ich,
              leitungIn(gruppe),
            )
        ).then(() => null),
      );
    // Übernehmen (W9b, die Leitung): aus demselben Datensatz wird ein To-Do; danach wird nachgelesen.
    if (a && uebernehmen)
      return ausfuehren(() =>
        todoVorschlagUebernehmen(ort, a.id, aenderung(), ich, leitungOrig).then(() => null),
      );
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
            jeder: jederAn || undefined,
            teile: teile(),
            notiz,
            karte: { notiz: karteNotiz },
          },
          ich,
          leitungIn(gruppe),
        ).then(() => null),
      );
    const alt = gruppen.find((g) => g.id === eintrag?.gruppe.id);
    if (verschoben && alt && alt.mitarbeit !== null) {
      const { wer: _wer, ...x } = aenderung();
      const verschieben = () =>
        toDoVerschieben({
          von: { ort: { modul, kategorie: alt.mitarbeit! }, name: alt.name },
          nach: { ort, gruppe: gruppe.id, name: gruppe.name },
          id: a.id,
          neueId,
          x,
          wer: [...wer],
          ich,
          // Aus der Gruppe, in der das To-Do jetzt liegt: Wer dort Mitarbeiter ist, verschiebt nichts (`toDoRechte.gruppe`).
          leitung: leitungOrig,
        }).then((res) => res.hinweis);
      // Im Entwurf: erst in der neuen Gruppe anlegen (unter der Sperre), dann wird die Aufgabe ein Absatz mit Hinweis.
      return ausfuehren(() =>
        mitEntwurf({ art: 'abgegeben', text, gruppe: gruppe.name }, verschieben, {
          zuvor: verschieben,
        }),
      );
    }
    const x = aenderung();
    const aendern = () => toDoAendern(ort, a.id, x, ich, leitungOrig, imEntwurf).then(() => null);
    // Text im Entwurf: erst das Protokoll (der Abgleich zieht den Text ins To-Do), dann der Rest – falls es einen gibt.
    if (x.text !== undefined) {
      const { text: _text, ...rest } = x;
      const danach = Object.keys(rest).length
        ? () => toDoAendern(ort, a.id, rest, ich, leitungOrig, imEntwurf).then(() => null)
        : undefined;
      return ausfuehren(() => mitEntwurf({ art: 'text', text }, aendern, { danach }));
    }
    ausfuehren(aendern);
  };

  const loeschen = () => {
    if (!a || !gruppe || gruppe.mitarbeit === null) return;
    const ort = { modul, kategorie: gruppe.mitarbeit };
    setLoeschenFragen(false);
    const nurToDo = () => toDoLoeschen(ort, a.id, ich, leitungOrig, imEntwurf).then(() => null);
    ausfuehren(() => mitEntwurf({ art: 'raus' }, nurToDo));
  };

  /** „Das mache ich“ (W9a): mich als Zuständigen eintragen – danach ist es mein eigenes To-Do. */
  const mache = () => {
    if (!a || !gruppe || gruppe.mitarbeit === null) return;
    const ort = { modul, kategorie: gruppe.mitarbeit };
    ausfuehren(() =>
      toDoAendern(ort, a.id, { wer: [ich.person] }, ich, leitungOrig, imEntwurf).then(() => null),
    );
  };

  // Die Zuständigen als Text (Mitglied ohne Zuständigen-Recht): Namen aus der Liste oder dem Verlauf, sonst gezählt.
  const unbekannteIds: number[] = [];
  const zustaendigNamen =
    a?.wer.flatMap((p) => {
      const n = p === ich.person ? `${ich.name} (du)` : nameFuer(a, p, listeNamen);
      if (n === null) unbekannteIds.push(p);
      return n ?? [];
    }) ?? [];
  const zustaendigText = a
    ? [
        ...zustaendigNamen,
        ...(unbekannteIds.length ? weitereZustaendige(a, unbekannteIds) : []),
        ...(a.extern.trim() ? [`${a.extern.trim()} (extern)`] : []),
      ].join(', ')
    : '';
  // Abgeben geht nur an ein anderes Mitglied, das das Fenster kennt (Mitgliederliste sichtbar).
  const abgebenKandidaten = bekannt.filter((m) => m.id !== ich.person);
  // Ein Satz, wer den Rest ändert – die Leitung hat nichts zu erklären. Namen der Leitung stehen hier nicht zur Hand.
  const satz =
    !a || !r || r.fall === 'leitung'
      ? null
      : r.fall === 'eigen' && imEntwurf
        ? `Steht noch im Protokoll-Entwurf „${herkunft?.titel ?? ''}“ – Text ändern und Löschen macht die Leitung dort.`
        : r.fall === 'geteilt'
          ? 'Hier hängen auch andere dran – Text, Frist und Zuständige ändert die Leitung.'
          : r.fall === 'ohne'
            ? 'Mit „Das mache ich“ wirst du zuständig und kannst es danach bearbeiten.'
            : null;

  /** „Wofür?“ – nur beim neuen To-Do eines Mitarbeiters (W9b): für mich anlegen oder der Gruppe vorschlagen. */
  const wofuer = neuMitglied && (
    <div className={felder.feld}>
      <span>Wofür?</span>
      <Segment
        value={ziel}
        options={[
          { value: 'mich', name: 'Für mich', label: 'Für mich' },
          {
            value: 'gruppe',
            name: 'Vorschlag an die Gruppe',
            label: (
              <span className={styles.modus}>
                Vorschlag an die Gruppe<small>die Leitung entscheidet</small>
              </span>
            ),
          },
        ]}
        onChange={setZiel}
        ariaLabel="Wofür?"
        verbunden
      />
    </div>
  );

  if (vorschlagForm)
    return (
      <Sheet
        title={vorschlagNeu ? 'To-Do vorschlagen' : 'Vorschlag ändern'}
        onClose={onClose}
        beschaeftigt={laeuft}
        knoepfe={
          <FensterKnopf disabled={!bereit} onClick={speichern}>
            {laeuft ? 'Wird gespeichert …' : vorschlagNeu ? 'Vorschlagen' : 'Speichern'}
          </FensterKnopf>
        }
      >
        {wofuer}
        <label className={felder.feld}>
          <span>Was ist zu tun?</span>
          <textarea
            className={`${felder.eingabe} ${styles.text}`}
            value={text}
            rows={2}
            disabled={laeuft}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className={felder.zeile}>
          {a ? (
            <Lesen titel="Gruppe">{eintrag?.gruppe.name}</Lesen>
          ) : (
            <label className={felder.feld}>
              <span>Gruppe</span>
              <select
                className={felder.eingabe}
                value={gruppeId}
                disabled={laeuft || gruppen.length < 2}
                onChange={(e) => setGruppeId(Number(e.target.value))}
              >
                {gruppen.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={felder.feld}>
            <span>Bis (Vorschlag)</span>
            <input
              type="date"
              className={felder.eingabe}
              value={bis}
              disabled={laeuft}
              onChange={(e) => setBis(e.target.value)}
            />
          </label>
        </div>
        <p className={felder.leise}>
          Wer es macht, legt die Leitung fest, wenn sie den Vorschlag übernimmt.
        </p>
        <label className={felder.feld}>
          <span>Warum? (optional)</span>
          <textarea
            className={`${felder.eingabe} ${styles.text}`}
            value={warum}
            rows={2}
            disabled={laeuft}
            placeholder="Kurz, damit die Leitung entscheiden kann"
            onChange={(e) => setWarum(e.target.value)}
          />
        </label>
        {fehler && (
          <p className={felder.fehler} role="alert">
            {fehler.text}
          </p>
        )}
      </Sheet>
    );

  if (loeschenFragen)
    return (
      <ConfirmDialog
        title="To-Do löschen?"
        message={
          imEntwurf
            ? `„${a?.text ?? ''}“ verschwindet aus der Übersicht und aus dem Protokoll-Entwurf „${herkunft?.titel ?? ''}“. Im Verlauf bleibt vermerkt, wer es gelöscht hat.`
            : `„${a?.text ?? ''}“ verschwindet aus der Übersicht. Im Verlauf bleibt vermerkt, wer es gelöscht hat.`
        }
        confirmLabel="Löschen"
        onConfirm={loeschen}
        onCancel={() => setLoeschenFragen(false)}
        beschaeftigt={laeuft}
      />
    );

  return (
    <Sheet
      title={uebernehmen ? 'Vorschlag übernehmen' : a ? 'To-Do' : 'Neues To-Do'}
      onClose={onClose}
      beschaeftigt={laeuft}
      cancelLabel={r?.mache ? 'Schließen' : undefined}
      links={
        a && r?.loeschen && !uebernehmen ? (
          <FensterKnopf art="loeschen" disabled={laeuft} onClick={() => setLoeschenFragen(true)}>
            Löschen
          </FensterKnopf>
        ) : undefined
      }
      knoepfe={
        r?.mache ? (
          <FensterKnopf disabled={laeuft} onClick={mache}>
            {laeuft ? 'Wird gespeichert …' : 'Das mache ich'}
          </FensterKnopf>
        ) : (
          <FensterKnopf disabled={!bereit} onClick={speichern}>
            {laeuft
              ? 'Wird gespeichert …'
              : uebernehmen
                ? 'Übernehmen'
                : a
                  ? 'Speichern'
                  : 'Anlegen'}
          </FensterKnopf>
        )
      }
    >
      {wofuer}
      {uebernehmen && a?.vorschlag && (
        <p className={`${felder.hinweis} ${styles.vorFeld}`} role="note">
          Vorschlag von {a.vorschlag.name}. Wähle die Zuständigen – danach ist es ein To-Do der
          Gruppe und der Vorschlag verschwindet.
        </p>
      )}
      {imEntwurf && herkunft && r?.fall === 'leitung' && (
        <p className={`${felder.hinweis} ${styles.vorFeld}`}>
          Steht im Protokoll-Entwurf „{herkunft.titel}“ – Text, Gruppe und Löschen werden dort mit
          geändert.
        </p>
      )}
      {darf.text ? (
        <label className={felder.feld}>
          <span>Was ist zu tun?</span>
          <textarea
            className={`${felder.eingabe} ${styles.text}`}
            value={text}
            rows={2}
            disabled={laeuft}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      ) : (
        <Lesen titel="Was ist zu tun?" gross>
          {a?.text}
        </Lesen>
      )}
      <div className={felder.zeile}>
        {a && !darf.gruppe ? (
          <Lesen titel="Gruppe">{eintrag?.gruppe.name}</Lesen>
        ) : (
          <label className={felder.feld}>
            <span>Gruppe</span>
            <select
              className={felder.eingabe}
              value={gruppeId}
              disabled={laeuft || gruppen.length < 2}
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
        )}
        {darf.frist ? (
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
        ) : (
          <Lesen titel="Bis">{a?.bis ? datumText(a.bis) : 'ohne Frist'}</Lesen>
        )}
      </div>
      {verschoben && (
        <p className={felder.leise}>
          Das To-Do zieht nach „{gruppe?.name}“ um – die Verbindung zur Sitzung entfällt, der
          Verlauf zieht mit.
        </p>
      )}
      {darf.zustaendig ? (
        <div className={felder.feld}>
          <span>Zuständig</span>
          <Einladeliste
            liste={bekannt}
            gewaehlt={wer}
            onChange={setWer}
            gesperrt={laeuft}
            ich={ich.person}
            mitAlle
            zusatz={(id) => (id === ich.person ? 'du' : null)}
          />
          {weitere.length > 0 && (
            <p className={felder.leise}>
              Außerdem zuständig: {weitereZustaendige(a ?? { verlauf: [] }, weitere).join(', ')} –
              das bleibt so.
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
          <p className={felder.leise}>
            Niemand angehakt = To-Do der Gruppe, noch ohne Zuständigen.
          </p>
        </div>
      ) : (
        <Lesen titel="Zuständig">
          {neuMitglied || r?.fall === 'eigen' ? (
            `${ich.name} (du)`
          ) : a && !ohneZustaendige(a) ? (
            zustaendigText
          ) : (
            <span className={styles.leiseText}>noch niemand</span>
          )}
        </Lesen>
      )}
      {r?.abgeben && abgebenKandidaten.length > 0 && (
        <label className={felder.feld}>
          <span>Abgeben an</span>
          <select
            className={felder.eingabe}
            value={abgebenAn ?? ''}
            disabled={laeuft}
            onChange={(e) => setAbgebenAn(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Nicht abgeben</option>
            {abgebenKandidaten.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {abgebenAn !== null && (
            <small className={felder.leise}>
              Nach dem Speichern ist {listeNamen.get(abgebenAn)?.split(' ')[0]} zuständig und du
              siehst es nicht mehr.
            </small>
          )}
        </label>
      )}
      {ohneMich && (
        <p className={felder.hinweis} role="note">
          Du bist nicht dabei – nach dem Speichern siehst du dieses To-Do nicht mehr (Mitglieder
          sehen nur ihre eigenen).
        </p>
      )}
      {darf.modus && wer.size >= 2 && (
        <div className={felder.feld}>
          <span>So wird es erledigt</span>
          <Segment
            value={jederWahl ? 'jeder' : 'gemeinsam'}
            options={[
              {
                value: 'gemeinsam',
                name: 'Gemeinsam',
                label: (
                  <span className={styles.modus}>
                    Gemeinsam<small>einer erledigt es für alle</small>
                  </span>
                ),
              },
              {
                value: 'jeder',
                name: 'Jeder für sich',
                label: (
                  <span className={styles.modus}>
                    Jeder für sich<small>jeder hakt selbst ab</small>
                  </span>
                ),
              },
            ]}
            onChange={(m) => setJederWahl(m === 'jeder')}
            ariaLabel="So wird es erledigt"
            verbunden
          />
        </div>
      )}
      {jederAn ? (
        <div className={felder.feld}>
          <span>Wer ist fertig?</span>
          <ul className={styles.fertigListe}>
            {[...wer].map((p) => {
              const darfTeil = r ? r.haken && darfTeilSetzen(p, ich.person, leitungOrig) : true;
              const fertig = teilJetzt(p);
              const am = vorschau?.fertig?.[String(p)];
              return (
                <li key={p}>
                  <label className={styles.fertigZeile} aria-disabled={!darfTeil || laeuft}>
                    <input
                      type="checkbox"
                      checked={fertig}
                      disabled={!darfTeil || laeuft}
                      onChange={() =>
                        setUmgeschaltet((u) => {
                          const n = new Set(u);
                          if (n.has(p)) n.delete(p);
                          else n.add(p);
                          return n;
                        })
                      }
                    />
                    {p === ich.person ? `${ich.name} (du)` : name(p)}
                    <span className={`${styles.fertigRechts} ${fertig ? styles.fertigOk : ''}`}>
                      {fertig
                        ? am && !umgeschaltet.has(p)
                          ? `✓ am ${tagKurz(tagAusIso(am, gemeindeZeitzone()))}`
                          : '✓'
                        : 'offen'}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className={felder.leise}>
            {leitungOrig
              ? 'Als Leitung kannst du auch für andere abhaken (z. B. wenn jemand Bescheid sagt).'
              : 'Du hakst nur deinen eigenen Teil ab.'}{' '}
            Fertig ist das To-Do, wenn alle fertig sind.
          </p>
        </div>
      ) : !darf.status ? (
        <Lesen titel="Status">{a ? statusText(a.status) : 'offen'}</Lesen>
      ) : (
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
          {/* Gemeinsam und erledigt: wer es war – wie auf der Karte (`erledigtSatz`). */}
          {a?.status === 'erledigt' && status === 'erledigt' && (
            <p className={felder.leise}>
              {erledigtSatz(a, ich.person, (p) => (p === ich.person ? ich.name : name(p)))}
            </p>
          )}
        </div>
      )}
      {darf.notiz && (
        <div className={felder.feld}>
          <span className={styles.kopf}>
            Notizen
            {darf.karte && (
              <SchalterKnopf an={karteNotiz} onClick={() => setKarteNotiz(!karteNotiz)}>
                Auf Karte anzeigen
              </SchalterKnopf>
            )}
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
      )}
      {satz && (
        <div className={styles.leitungSatz} role="note">
          <Icon name="lock" size={16} />
          <span>{satz}</span>
        </div>
      )}
      {a && (
        <div className={felder.feld}>
          <span className={styles.kopf}>Aus welcher Sitzung</span>
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
                <time>{tagKurz(tagAusIso(v.am, gemeindeZeitzone()))}</time>
                <span>
                  <b>{v.von === ich.person ? ich.name : name(v.von)}</b>{' '}
                  {verlaufText(v, (p) => (p === ich.person ? ich.name : name(p)))}
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
