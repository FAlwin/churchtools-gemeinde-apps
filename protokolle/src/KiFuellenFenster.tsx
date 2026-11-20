import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { useKopieren } from '@ui/bedienung/useKopieren';
import type { Person as Mitglied } from '@shared/organigramm/mitglieder';
import type { Block } from '@shared/protokolle/dokument';
import { docxText } from '@shared/protokolle/docxText';
import {
  antwortLesen,
  auftragBauen,
  offenePlatzhalter,
  tagesordnung,
  uebernahmePlanen,
  uebernehmbar,
  type Eintrag,
  type TodoTeil,
} from '@shared/protokolle/ki';
import {
  namenFinden,
  PLATZHALTER_MUSTER,
  platzhalterAnwenden,
  unzugeordnet,
  zuordnungErgaenzen,
  type Fund,
  type Person,
} from '@shared/protokolle/platzhalter';
import { ladePersonen } from './kiPersonen';
import styles from './KiFuellen.module.scss';

/** Was nach „Ausgewählte übernehmen“ zu melden ist. */
export interface KiUebernommen {
  /** Wie viele Einträge ins Protokoll kamen. */
  anzahl: number;
  /** Wie viele angehakte Einträge keinen Platz mehr fanden (Punkt seit dem Lesen verschwunden). */
  uebersprungen: number;
}

export interface KiFuellenProps {
  /** Name der Gruppe – steht im Auftrag (und wird dort wie das Transkript auf Namen geprüft). */
  gruppe: string;
  /** Tag der Sitzung, `JJJJ-MM-TT` – damit die KI „bis nächsten Freitag“ rechnen kann. */
  datum: string;
  /** Das Protokoll, wie es gerade im Editor steht – wird bei jedem Schritt frisch gelesen. */
  dokument: () => Block[];
  /** Die Gruppenmitglieder (Editor): nur deren Vornamen werden allein gesucht und sie werden Zuständige. */
  mitglieder: readonly Mitglied[] | 'verborgen' | null;
  /** `EditorGriff.einfuegen` – zählt als Änderung, das Protokoll speichert dann von selbst. */
  einfuegen: (bloecke: readonly Block[], vor: string | null) => void;
  onUebernommen: (r: KiUebernommen) => void;
  onClose: () => void;
  /** Austauschbar für Tests. */
  personenLaden?: () => Promise<Person[]>;
  neueId?: () => string;
}

type Schritt = 1 | 2 | 3;
type Personenstand = { art: 'laedt' } | { art: 'fertig'; liste: Person[] } | { art: 'fehler' };

const ART: Record<Fund['art'], string> = {
  person: 'Person',
  vorname: 'Vorname',
  muster: 'Muster',
  eigen: 'eigener Begriff',
};

const KEINE_LISTE =
  'Die Personenliste ließ sich nicht laden – Namen bitte selbst unter „Weiteres verbergen“ eintragen.';

/** `2026-12-06` → `06.12.2026`. */
const datumText = (iso: string): string => iso.split('-').reverse().join('.');

const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Text mit hervorgehobenen Namen: die wieder eingesetzten Namen grün, ein Platzhalter, der keinen Namen bekam, blau.
 * Gesucht wird an Wortgrenzen (Umlaute zählen zum Wort), längste Namen zuerst – wie `platzhalter.ts`.
 */
function NamenText({ text, namen }: { text: string; namen: readonly string[] }) {
  const teile = useMemo(() => {
    const liste = [...new Set(namen.filter((n) => n.trim()))].sort((a, b) => b.length - a.length);
    const platzhalter = PLATZHALTER_MUSTER.source;
    const name = liste.length
      ? String.raw`|((?<![\p{L}\p{N}_])(?:${liste.map(reEsc).join('|')})(?![\p{L}\p{N}_]))`
      : '';
    const re = new RegExp(`(${platzhalter})${name}`, 'gu');
    const aus: { text: string; art: 'text' | 'name' | 'platzhalter' }[] = [];
    let ab = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > ab) aus.push({ text: text.slice(ab, m.index), art: 'text' });
      aus.push({ text: m[0], art: m[1] ? 'platzhalter' : 'name' });
      ab = m.index + m[0].length;
    }
    if (ab < text.length) aus.push({ text: text.slice(ab), art: 'text' });
    return aus;
  }, [text, namen]);
  return (
    <>
      {teile.map((t, i) =>
        t.art === 'text' ? (
          t.text
        ) : (
          <span
            key={i}
            className={t.art === 'name' ? styles.name : styles.platzhalter}
            data-name={t.art === 'name' ? '' : undefined}
          >
            {t.text}
          </span>
        ),
      )}
    </>
  );
}

/** Die Bytes einer gewählten Datei (`FileReader` statt `Blob.arrayBuffer`: läuft überall, auch in den Tests). */
function bytesLesen(f: File): Promise<Uint8Array> {
  return new Promise((ok, fehl) => {
    const l = new FileReader();
    l.onload = () => ok(new Uint8Array(l.result as ArrayBuffer));
    l.onerror = () => fehl(l.error ?? new Error('Datei nicht lesbar'));
    l.readAsArrayBuffer(f);
  });
}

/** Wohin ein Eintrag kommt – oder warum nicht. */
function wohin(e: Eintrag): { ok: boolean; text: string } {
  if (e.art === 'neuerPunkt')
    return { ok: true, text: 'als neuer Punkt ans Ende der Tagesordnung' };
  const z = e.ziel;
  if (z.art === 'punkt') return { ok: true, text: `→ ${z.nummer} ${z.titel}` };
  if (z.art === 'fest') return { ok: false, text: `fester Punkt: ${z.nummer} ${z.titel}` };
  return {
    ok: false,
    text: z.nr ? `Punkt ${z.nr} gibt es nicht` : 'Punkt ohne Nummer gibt es nicht',
  };
}

/**
 * **„Mit KI füllen“** (Bauplan S8-2, Entwurf `s8-ki-v1`, abgenommen 16.11.2026) – drei Schritte in einem Fenster:
 * 1. **Auftrag:** Transkript (einfügen, `.txt` oder `.docx`), die gefundenen Namen mit Häkchen „ersetzen“, eigene
 *    Begriffe, der fertige Auftrag, „Auftrag kopieren“.
 * 2. **Antwort:** die Antwort der KI einfügen; kaputt → Meldung im Fenster, der Text bleibt. Wer die Antwort schon hat,
 *    geht aus Schritt 1 direkt hierher („Antwort schon da? Direkt einfügen“, 17.11.2026) – ohne Transkript gibt es hier
 *    keinen Auftrag zu kopieren. Kommen in der Antwort Platzhalter vor, die diese Sitzung nicht kennt (Antwort aus einem
 *    früheren Lauf), ordnet man sie hier von Hand einem Namen zu (Vorschläge: die Gruppenmitglieder); leer = bleibt
 *    stehen. Ohne Transkript kennt das Fenster gar keine Zuordnung: Die Nummern der Antwort stammen dann aus einem
 *    anderen Lauf, ein „[Person 1]“ aus den Titeln der Tagesordnung wäre eine falsche Spur.
 * 3. **Vorschau:** je Eintrag ein Häkchen und das Ziel; „Ausgewählte übernehmen“ fügt über `einfuegen` ein. Bleiben
 *    Platzhalter ohne Namen stehen, sagt ein Hinweis oben, dass man sie nach dem Übernehmen selbst ersetzt.
 *
 * Die Regeln stehen in `shared/protokolle/ki.ts`, `platzhalter.ts` und `docxText.ts` – hier wird nur verbunden und
 * gezeigt. **Nichts davon wird gespeichert:** Transkript, Funde und Zuordnung leben nur in diesem Fenster (kein
 * Browser-Speicher, nichts an ChurchTools); Schließen heißt weg. Der Auftrag kann erst kopiert werden, wenn Personenliste
 * und Gruppenmitglieder da sind – sonst gingen Namen unersetzt hinaus.
 */
export function KiFuellenFenster({
  gruppe,
  datum,
  dokument,
  mitglieder,
  einfuegen,
  onUebernommen,
  onClose,
  personenLaden = ladePersonen,
  neueId = () => crypto.randomUUID(),
}: KiFuellenProps) {
  const [schritt, setSchritt] = useState<Schritt>(1);
  const [tx, setTx] = useState('');
  const [datei, setDatei] = useState('');
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [eigene, setEigene] = useState<string[]>([]);
  const [neuerBegriff, setNeuerBegriff] = useState('');
  const [aus, setAus] = useState<ReadonlySet<string>>(new Set());
  const [kopiert, setKopiert] = useState<boolean | null>(null);
  const [ausweg, setAusweg] = useState(false);
  const [antwort, setAntwort] = useState('');
  const [antwortFehler, setAntwortFehler] = useState<string | null>(null);
  const [eintraege, setEintraege] = useState<readonly Eintrag[]>([]);
  const [abgewaehlt, setAbgewaehlt] = useState<ReadonlySet<string>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  const [personen, setPersonen] = useState<Personenstand>({ art: 'laedt' });
  const dateiFeld = useRef<HTMLInputElement>(null);
  const auftragFeld = useRef<HTMLTextAreaElement>(null);

  // Alle sichtbaren Personen – einmal beim Öffnen. Ein Fehler lässt das Fenster nutzbar (mit Hinweis); in den Log
  // kommt nur der Grund, keine Namen.
  useEffect(() => {
    let weg = false;
    personenLaden().then(
      (liste) => {
        if (!weg) setPersonen({ art: 'fertig', liste });
      },
      (e: unknown) => {
        console.warn('[mit ki füllen] Personenliste nicht geladen:', e);
        if (!weg) setPersonen({ art: 'fehler' });
      },
    );
    return () => {
      weg = true;
    };
  }, [personenLaden]);

  const alle = useMemo<Person[]>(
    () => (personen.art === 'fertig' ? personen.liste : []),
    [personen],
  );
  // Die Personen der Gruppe: die aus der Liste, die Mitglied sind. Ohne Mitgliederliste (verborgen) gibt es keine.
  const gruppePersonen = useMemo<Person[]>(() => {
    if (!Array.isArray(mitglieder)) return [];
    const ids = new Set((mitglieder as readonly Mitglied[]).map((m) => m.id));
    return alle.filter((p) => ids.has(p.id));
  }, [mitglieder, alle]);
  // Vorher nichts kopieren: Es fehlten Namen im Auftrag.
  const bereit = personen.art !== 'laedt' && mitglieder !== null;

  // Gesucht wird im Transkript UND in den Titeln der Tagesordnung und im Gruppennamen – auch dort steht manchmal ein
  // Name („Andacht Peter“); `auftragBauen` ersetzt sie mit denselben Funden.
  const funde = useMemo<Fund[]>(() => {
    const titel = tagesordnung(dokument()).map((p) => p.titel);
    const text = [tx, ...titel, gruppe].join('\n');
    return namenFinden(text, { alle, gruppe: gruppePersonen }, eigene).map((f) => ({
      ...f,
      ersetzen: !aus.has(f.text),
    }));
  }, [tx, gruppe, alle, gruppePersonen, eigene, aus, dokument]);

  const ersetzt = useMemo(() => platzhalterAnwenden(tx, funde), [tx, funde]);
  const auftrag = useMemo(
    () =>
      tx.trim()
        ? auftragBauen({ gruppe, datum, dokument: dokument(), transkript: ersetzt.text, funde })
        : '',
    [tx, gruppe, datum, dokument, ersetzt, funde],
  );
  const { kopieren: inZwischenablage } = useKopieren(auftrag, auftragFeld);

  // Ohne Transkript kennt dieses Fenster keine Platzhalter-Nummern (siehe Kopf) – dann ist alles Handarbeit.
  const direkt = !tx.trim();
  const basisZuordnung = useMemo<Record<string, string>>(
    () => (direkt ? {} : ersetzt.zuordnung),
    [direkt, ersetzt],
  );
  const antwortFunde = useMemo<Fund[]>(() => (direkt ? [] : funde), [direkt, funde]);
  // Schritt 2: Platzhalter der eingefügten Antwort, die die Zuordnung nicht kennt – dazu die von Hand gewählten Namen.
  const [manuell, setManuell] = useState<Record<string, string>>({});
  const offeneNamen = useMemo(
    () => unzugeordnet(antwort, basisZuordnung),
    [antwort, basisZuordnung],
  );
  const antwortZuordnung = useMemo(
    () => zuordnungErgaenzen(basisZuordnung, manuell),
    [basisZuordnung, manuell],
  );
  const zurueckNamen = useMemo(() => Object.values(antwortZuordnung), [antwortZuordnung]);

  const eingabeGeaendert = () => {
    setKopiert(null);
    setFehler(null);
  };

  const dateiLesen = async (f: File) => {
    setDateiFehler(null);
    const name = f.name.toLowerCase();
    let bytes: Uint8Array;
    try {
      bytes = await bytesLesen(f);
    } catch {
      setDateiFehler('Die Datei ließ sich nicht lesen. Bitte den Text einfach einfügen.');
      return;
    }
    let text: string;
    if (name.endsWith('.docx')) {
      const r = docxText(bytes);
      if (!r.ok) {
        setDateiFehler(r.meldung);
        return;
      }
      text = r.text;
    } else if (name.endsWith('.txt')) {
      text = new TextDecoder('utf-8').decode(bytes);
      if (!text.trim()) {
        setDateiFehler('In dieser Datei steht kein Text.');
        return;
      }
    } else {
      setDateiFehler('Bitte eine Datei mit der Endung .txt oder .docx wählen.');
      return;
    }
    setTx(text);
    setDatei(f.name);
    eingabeGeaendert();
  };

  const begriffHinzu = () => {
    const b = neuerBegriff.trim();
    if (!b) return;
    if (!eigene.includes(b)) setEigene([...eigene, b]);
    setNeuerBegriff('');
    eingabeGeaendert();
  };

  // Kopieren über den gemeinsamen Baustein (`useKopieren`, auch Anmeldelink und Organigramm) – hier mit Ergebnis, weil es
  // bei „geht nicht“ gleich zum Ausweg geht.
  const kopieren = async () => {
    const ok = await inZwischenablage();
    setKopiert(ok);
    setAusweg(!ok);
    // Gescheitert → gleich zum Ausweg: „Auftrag anzeigen“ zum Markieren.
    if (!ok) setSchritt(2);
  };

  const weiter = () => {
    setAusweg(kopiert !== true);
    setSchritt(2);
  };

  // „Antwort schon da?“ – ohne Auftrag zur Antwort; ein Ausweg zum Kopieren gibt es hier nicht.
  const direktZurAntwort = () => {
    setAusweg(false);
    setSchritt(2);
  };

  const vorschau = () => {
    const r = antwortLesen(antwort, {
      dokument: dokument(),
      zuordnung: antwortZuordnung,
      funde: antwortFunde,
      gruppe: gruppePersonen,
    });
    if (!r.ok) {
      setAntwortFehler(r.meldung);
      return;
    }
    setAntwortFehler(null);
    setEintraege(r.eintraege);
    setAbgewaehlt(new Set());
    setSchritt(3);
  };

  const gewaehlt = eintraege.filter((e) => uebernehmbar(e) && !abgewaehlt.has(e.id));

  const uebernehmen = () => {
    setFehler(null);
    try {
      // Frisch gelesen: Der Plan rechnet mit dem Dokument von jetzt, nicht mit dem beim Lesen der Antwort.
      const plan = uebernahmePlanen(gewaehlt, dokument(), neueId);
      for (const f of plan.einfuegungen) einfuegen(f.bloecke, f.vor);
      onUebernommen({
        anzahl: gewaehlt.length - plan.uebersprungen.length,
        uebersprungen: plan.uebersprungen.length,
      });
    } catch (e) {
      console.warn('[mit ki füllen] Übernehmen gescheitert:', e);
      setFehler(
        'Das Übernehmen hat nicht geklappt. Bitte das Protokoll prüfen – einiges kann schon eingefügt sein.',
      );
    }
  };

  const wahl = (e: Eintrag, haupt: ReactNode, unten: ReactNode) => {
    const w = wohin(e);
    const an = w.ok && !abgewaehlt.has(e.id);
    return (
      <label key={e.id} className={`${styles.wahl}${w.ok ? '' : ` ${styles.aus}`}`}>
        <input
          type="checkbox"
          checked={an}
          disabled={!w.ok}
          onChange={(ev) => {
            const neu = new Set(abgewaehlt);
            if (ev.target.checked) neu.delete(e.id);
            else neu.add(e.id);
            setAbgewaehlt(neu);
          }}
        />
        <span>
          {haupt}
          <small>{unten}</small>
        </span>
      </label>
    );
  };
  const txt = (t: string) => <NamenText text={t} namen={zurueckNamen} />;
  /** Zuständige und Datum eines To-Dos – im einzelnen To-Do und im neuen Punkt gleich. */
  const todoZusatz = (d: TodoTeil): ReactNode => (
    <>
      {d.wer.length
        ? d.wer.map((w, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {txt(w.name)}
              {w.personId === null && ' (extern)'}
            </span>
          ))
        : 'niemand zuständig'}
      {' · '}
      {d.bis ? `bis ${datumText(d.bis)}` : 'ohne Datum'}
    </>
  );
  const bereich = (titel: string, zeilen: ReactNode[]) =>
    zeilen.length ? (
      <section className={styles.abschnitt} key={titel}>
        <h3 className={styles.titel}>
          {titel} <small>({zeilen.length})</small>
        </h3>
        <div className={styles.liste}>{zeilen}</div>
      </section>
    ) : null;
  const von = (art: Eintrag['art']) => eintraege.filter((e) => e.art === art);

  const hatInhalt = !!tx.trim() || !!antwort.trim();
  const SCHRITTE = ['Auftrag', 'Antwort', 'Vorschau'];
  const offeneInVorschau = offenePlatzhalter(eintraege);

  let knoepfe: ReactNode;
  if (schritt === 1)
    knoepfe = (
      <>
        <FensterKnopf art="hell" disabled={!auftrag || !bereit} onClick={weiter}>
          Weiter: Antwort einfügen
        </FensterKnopf>
        <FensterKnopf disabled={!auftrag || !bereit} onClick={() => void kopieren()}>
          <Icon name="kopieren" size={18} /> {kopiert === true ? 'Kopiert ✓' : 'Auftrag kopieren'}
        </FensterKnopf>
      </>
    );
  else if (schritt === 2)
    knoepfe = (
      <FensterKnopf disabled={!antwort.trim()} onClick={vorschau}>
        Vorschau ansehen
      </FensterKnopf>
    );
  else
    knoepfe = (
      <FensterKnopf disabled={gewaehlt.length === 0} onClick={uebernehmen}>
        Ausgewählte übernehmen{gewaehlt.length ? ` (${gewaehlt.length})` : ''}
      </FensterKnopf>
    );

  const sichtbareFunde = funde;
  const fehlend = eigene.filter((e) => !funde.some((f) => f.text === e.trim()));

  return (
    <Sheet
      title="Mit KI füllen"
      onClose={onClose}
      breit
      knoepfe={knoepfe}
      // Ein Tipp daneben wirft ein eingegebenes Transkript nicht weg – dafür gibt es X und „Abbrechen“.
      onHintergrund={hatInhalt ? () => undefined : onClose}
      zurueck={schritt > 1 ? () => setSchritt((schritt - 1) as Schritt) : undefined}
    >
      <ol className={styles.schritte} aria-label="Schritte">
        {SCHRITTE.map((s, i) => (
          <li key={s} aria-current={schritt === i + 1 ? 'step' : undefined}>
            {i + 1} {s}
          </li>
        ))}
      </ol>

      {schritt === 1 && (
        <>
          <p className={styles.unter}>
            Transkript rein, Protokoll raus – du prüfst alles, bevor es übernommen wird.{' '}
            <button type="button" className={styles.textknopf} onClick={direktZurAntwort}>
              Antwort schon da? Direkt einfügen
            </button>
          </p>
          <div className={styles.abschnitt}>
            <label className={styles.titel} htmlFor="ki-transkript">
              Transkript
            </label>
            <textarea
              id="ki-transkript"
              className={styles.feld}
              rows={5}
              placeholder="Text aus der Sprachaufnahme hier einfügen …"
              value={tx}
              onChange={(e) => {
                setTx(e.target.value);
                setDatei('');
                setDateiFehler(null);
                eingabeGeaendert();
              }}
            />
            <div className={styles.zeile}>
              <FensterKnopf art="zweit" onClick={() => dateiFeld.current?.click()}>
                Datei wählen (.txt, .docx)
              </FensterKnopf>
              <input
                ref={dateiFeld}
                type="file"
                accept=".txt,.docx"
                className={styles.verstecktes}
                aria-label="Datei"
                data-testid="ki-datei"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void dateiLesen(f);
                }}
              />
              {datei && <span className={styles.leise}>aus {datei} übernommen</span>}
            </div>
            {dateiFehler && (
              <p className={styles.klein} role="alert">
                {dateiFehler}
              </p>
            )}
          </div>

          <div className={styles.abschnitt}>
            <h3 className={styles.titel}>Was die KI nicht sehen soll</h3>
            <p className={styles.klein}>
              Gefunden in deinem Text. Häkchen weg = bleibt für die KI sichtbar.
            </p>
            {personen.art === 'fehler' && (
              <p className={styles.info} role="alert">
                {KEINE_LISTE}
              </p>
            )}
            {personen.art === 'laedt' && (
              <p className={styles.klein} role="status">
                Die Personenliste wird geladen …
              </p>
            )}
            <div className={styles.funde} aria-label="Gefundene Namen">
              {!tx.trim() ? (
                <div className={styles.leer}>
                  Sobald ein Transkript da ist, zeigt die Erweiterung hier die gefundenen Namen.
                </div>
              ) : (
                <>
                  {sichtbareFunde.map((f) => (
                    <label key={f.text} className={styles.fund}>
                      <input
                        type="checkbox"
                        aria-label={`${f.text} ersetzen`}
                        checked={f.ersetzen}
                        onChange={(e) => {
                          const neu = new Set(aus);
                          if (e.target.checked) neu.delete(f.text);
                          else neu.add(f.text);
                          setAus(neu);
                          eingabeGeaendert();
                        }}
                      />
                      <span className={styles.fundText}>
                        <b>{f.text}</b> · {f.anzahl}×
                      </span>
                      <Etikett>{ART[f.art]}</Etikett>
                      <span className={styles.platzhalter}>{f.platzhalter}</span>
                      {f.art === 'eigen' && (
                        <button
                          type="button"
                          className={styles.entfernen}
                          aria-label={`${f.text} nicht mehr verbergen`}
                          onClick={(e) => {
                            e.preventDefault();
                            setEigene(eigene.filter((x) => x !== f.text));
                            eingabeGeaendert();
                          }}
                        >
                          ×
                        </button>
                      )}
                    </label>
                  ))}
                  {fehlend.map((e) => (
                    <div key={e} className={`${styles.fund} ${styles.leer}`}>
                      „{e}“ – nicht im Text gefunden
                      <button
                        type="button"
                        className={styles.entfernen}
                        aria-label={`${e} nicht mehr verbergen`}
                        onClick={() => {
                          setEigene(eigene.filter((x) => x !== e));
                          eingabeGeaendert();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {sichtbareFunde.length === 0 && fehlend.length === 0 && (
                    <div className={styles.leer}>Keine Namen gefunden.</div>
                  )}
                </>
              )}
            </div>
            <p className={styles.klein}>
              Namen werden automatisch ersetzt. Heikles (z. B. Krankheiten) hier selbst eintragen
              oder vorher aus dem Text nehmen.
            </p>
            <div className={styles.zeile}>
              <input
                aria-label="Weiteres verbergen"
                placeholder="Weiteres verbergen, z. B. ein Krankheitsname"
                value={neuerBegriff}
                onChange={(e) => setNeuerBegriff(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    begriffHinzu();
                  }
                }}
              />
              <FensterKnopf art="hell" onClick={begriffHinzu}>
                Hinzufügen
              </FensterKnopf>
            </div>
            <p className={styles.klein}>
              Die Zuordnung bleibt in diesem Fenster, das Transkript wird nicht gespeichert. Beim
              Zurückholen setzt die Erweiterung die echten Namen wieder ein.
            </p>
          </div>

          <details className={styles.abschnitt}>
            <summary className={styles.titel}>So geht es an die KI</summary>
            {auftrag ? (
              <pre className={styles.auftrag} aria-label="Fertiger Auftrag">
                {auftrag}
              </pre>
            ) : (
              <span className={styles.leise}>
                Hier erscheint der Auftrag, so wie die KI ihn bekommt.
              </span>
            )}
          </details>
          {kopiert === true && (
            <p className={styles.info} role="status">
              <b>Auftrag ist kopiert</b>
            </p>
          )}
        </>
      )}

      {schritt === 2 && (
        <>
          {direkt ? (
            <p className={styles.info}>
              Füge hier die ganze Antwort der KI ein. Platzhalter wie [Person 1] kannst du danach
              Namen zuordnen.
            </p>
          ) : kopiert === true ? (
            <p className={styles.info} role="status">
              <b>Auftrag ist kopiert</b>
              in deine KI einfügen und die Antwort hier einfügen.
            </p>
          ) : (
            <ul className={styles.hinweis} role="status">
              <li>
                <span className={styles.zeichen}>!</span>
                <span>
                  {kopiert === false
                    ? 'Kopieren war nicht möglich.'
                    : 'Der Auftrag ist noch nicht kopiert.'}
                  <small>
                    Öffne „Auftrag anzeigen“, markiere den Text und kopiere ihn von Hand. Dann in
                    deine KI einfügen und die ganze Antwort kopieren.
                  </small>
                </span>
              </li>
            </ul>
          )}
          {!direkt && (
            <details
              className={styles.ausweg}
              open={ausweg}
              onToggle={(e) => setAusweg(e.currentTarget.open)}
            >
              <summary>Auftrag anzeigen</summary>
              <textarea ref={auftragFeld} rows={8} readOnly aria-label="Auftrag" value={auftrag} />
              <FensterKnopf
                art="zweit"
                onClick={() => {
                  auftragFeld.current?.focus();
                  auftragFeld.current?.select();
                }}
              >
                Alles markieren
              </FensterKnopf>
            </details>
          )}
          {antwortFehler && (
            <ul className={styles.hinweis} role="alert">
              <li>
                <span className={styles.zeichen}>!</span>
                <span>
                  {antwortFehler}
                  <small>Deine Eingabe bleibt hier stehen, es geht nichts verloren.</small>
                </span>
              </li>
            </ul>
          )}
          <div className={styles.abschnitt}>
            <label className={styles.titel} htmlFor="ki-antwort">
              Antwort der KI
            </label>
            <textarea
              id="ki-antwort"
              className={styles.feld}
              rows={7}
              placeholder="Antwort hier einfügen …"
              value={antwort}
              onChange={(e) => {
                setAntwort(e.target.value);
                setAntwortFehler(null);
              }}
            />
          </div>
          {offeneNamen.length > 0 && (
            <div className={styles.abschnitt}>
              <h3 className={styles.titel}>Platzhalter zuordnen</h3>
              <p className={styles.klein}>
                Diese Platzhalter kennt das Fenster nicht. Schreib einen Namen dazu – leer lassen =
                bleibt stehen.
              </p>
              <datalist id="ki-gruppenmitglieder">
                {gruppePersonen.map((p) => (
                  <option key={p.id} value={`${p.vorname.trim()} ${p.nachname.trim()}`.trim()} />
                ))}
              </datalist>
              <div className={styles.zuordnen}>
                {offeneNamen.map((p) => (
                  <label key={p} className={styles.zuordnenZeile}>
                    <span className={styles.platzhalter}>{p}</span>
                    <input
                      list="ki-gruppenmitglieder"
                      aria-label={`Name für ${p}`}
                      placeholder="Name"
                      value={manuell[p] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManuell((m) => ({ ...m, [p]: v }));
                        setAntwortFehler(null);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {schritt === 3 && (
        <>
          <p className={styles.unter}>
            Grün = wieder eingesetzte Namen. Nimm das Häkchen weg bei allem, was nicht übernommen
            werden soll.
          </p>
          {offeneInVorschau.length > 0 && (
            <ul className={styles.hinweis} role="status">
              <li>
                <span className={styles.zeichen}>!</span>
                <span>
                  {offeneInVorschau.join(', ')}{' '}
                  {offeneInVorschau.length === 1 ? 'ist keinem' : 'sind keinem'} Namen zugeordnet –
                  nach dem Übernehmen selbst ersetzen.
                </span>
              </li>
            </ul>
          )}
          {fehler && (
            <ul className={styles.hinweis} role="alert">
              <li>
                <span className={styles.zeichen}>!</span>
                <span>{fehler}</span>
              </li>
            </ul>
          )}
          {bereich(
            'Stichpunkte',
            von('stichpunkt').map(
              (e) => e.art === 'stichpunkt' && wahl(e, txt(e.text), wohin(e).text),
            ),
          )}
          {bereich(
            'Beschlüsse',
            von('beschluss').map(
              (e) => e.art === 'beschluss' && wahl(e, txt(e.text), wohin(e).text),
            ),
          )}
          {bereich(
            'To-Dos',
            von('todo').map(
              (e) =>
                e.art === 'todo' &&
                wahl(
                  e,
                  txt(e.text),
                  <>
                    {todoZusatz(e)}
                    {' · '}
                    {wohin(e).text}
                  </>,
                ),
            ),
          )}
          {bereich(
            'Termine',
            von('termin').map(
              (e) =>
                e.art === 'termin' &&
                wahl(
                  e,
                  <>
                    <b>{e.datum ? datumText(e.datum) : 'ohne Datum'}</b> – {txt(e.text)}
                  </>,
                  <>
                    {e.datum ? '' : 'Datum fehlt – bitte nach dem Übernehmen setzen · '}
                    {wohin(e).text}
                  </>,
                ),
            ),
          )}
          {bereich(
            'Neue Punkte',
            von('neuerPunkt').map(
              (e) =>
                e.art === 'neuerPunkt' &&
                wahl(
                  e,
                  <>
                    <b>{txt(e.titel)}</b>
                    {e.stichpunkte.length > 0 && (
                      <ul className={styles.punkte}>
                        {e.stichpunkte.map((s, i) => (
                          <li key={i}>{txt(s)}</li>
                        ))}
                      </ul>
                    )}
                    {e.beschluesse.length > 0 && (
                      <>
                        <span className={styles.teilTitel}>Beschlüsse</span>
                        <ul className={styles.punkte}>
                          {e.beschluesse.map((b, i) => (
                            <li key={i}>{txt(b.text)}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {e.todos.length > 0 && (
                      <>
                        <span className={styles.teilTitel}>To-Dos</span>
                        <ul className={styles.punkte}>
                          {e.todos.map((d, i) => (
                            <li key={i}>
                              {txt(d.text)}
                              <small>{todoZusatz(d)}</small>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {e.termine.length > 0 && (
                      <>
                        <span className={styles.teilTitel}>Termine</span>
                        <ul className={styles.punkte}>
                          {e.termine.map((t, i) => (
                            <li key={i}>
                              <b>{t.datum ? datumText(t.datum) : 'ohne Datum'}</b> – {txt(t.text)}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>,
                  wohin(e).text,
                ),
            ),
          )}
        </>
      )}
    </Sheet>
  );
}
