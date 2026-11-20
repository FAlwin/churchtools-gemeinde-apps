import { useRef } from 'react';
import { ctDaten } from '@ui/ct/verbindung';
import { useLaden } from '@ui/ct/useLaden';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { kalenderAus } from '@shared/ct/ablaufAnlegen';
import type { CtKalender } from '@shared/ct/typen';
import { istErlaubteAdresse, type Baustein, type Seite } from '@shared/website/modell';
import { PLATZHALTER_BILD, PLATZHALTER_LINK } from '@shared/website/vorlagen';
import { Feld, Gruppe, Haken, ZahlenListe, ZahlFeld } from './Felder';
import { markdownAnwenden, type MarkdownArt } from './markdownLeiste';
import { ohneFeld, zielWert } from './regeln';
import { PLATZHALTER_ADRESSE } from './vorschauHtml';
import styles from './Fenster.module.scss';

/**
 * **Die Felder eines Bausteins** (W3a-2) – für alle 15 Typen aus `modell.ts`. Ein `switch` über den Typ mit einer
 * Prüfung auf Vollständigkeit: Kommt ein Typ dazu, scheitert hier die Typprüfung. Jede Änderung geht als **ganzer neuer
 * Baustein** an den Editor (`onAendern`), der ihn sofort in der Vorschau zeigt; geprüft wird erst beim „Fertig“ mit dem
 * Schema (`seitePruefen`) – so darf man beim Tippen kurz etwas Unfertiges stehen haben.
 */
export interface FelderKontext {
  /** Alle Seiten (Ziele für Knöpfe) und die Seite, auf der der Baustein steht (deren Sprungmarken). */
  seiten: readonly Seite[];
  seite: Seite;
  /** Darf diese Person „Eigenes HTML“ ändern? */
  htmlErlaubt: boolean;
}

type Aendern<T extends Baustein> = (b: T) => void;

export function BausteinFelder({
  baustein,
  kontext,
  onAendern,
}: {
  baustein: Baustein;
  kontext: FelderKontext;
  onAendern: (b: Baustein) => void;
}) {
  const b = baustein;
  switch (b.typ) {
    case 'ueberschrift':
      return <UeberschriftFelder b={b} onAendern={onAendern} />;
    case 'akzentzeile':
      return (
        <Feld label="Text" hilfe="Erscheint in der Handschrift-Schrift der Website.">
          {(id) => (
            <input
              id={id}
              className={styles.eingabe}
              value={b.text}
              maxLength={100}
              onChange={(e) => onAendern({ ...b, text: e.target.value })}
            />
          )}
        </Feld>
      );
    case 'text':
      return (
        <MarkdownFeld
          label="Text"
          wert={b.markdown}
          onChange={(markdown) => onAendern({ ...b, markdown })}
        />
      );
    case 'bild':
      return (
        <>
          <BildPlatz />
          <Feld label="Beschreibung für Blinde und Suchmaschinen">
            {(id) => (
              <input
                id={id}
                className={styles.eingabe}
                value={b.alt}
                maxLength={300}
                onChange={(e) => onAendern({ ...b, alt: e.target.value })}
              />
            )}
          </Feld>
          <Feld label="Bildunterschrift (optional)">
            {(id) => (
              <input
                id={id}
                className={styles.eingabe}
                value={b.unterschrift ?? ''}
                maxLength={300}
                onChange={(e) => {
                  const rest = ohneFeld(b, 'unterschrift');
                  onAendern(
                    e.target.value === '' ? rest : { ...rest, unterschrift: e.target.value },
                  );
                }}
              />
            )}
          </Feld>
          <Haken an={b.fuellen === true} onChange={(an) => onAendern({ ...b, fuellen: an })}>
            Bild füllt die ganze Spalte
          </Haken>
        </>
      );
    case 'bildText':
      return (
        <>
          <BildPlatz />
          <Feld label="Beschreibung für Blinde und Suchmaschinen">
            {(id) => (
              <input
                id={id}
                className={styles.eingabe}
                value={b.alt}
                maxLength={300}
                onChange={(e) => onAendern({ ...b, alt: e.target.value })}
              />
            )}
          </Feld>
          <Gruppe label="Bild steht">
            <Segment
              verbunden
              ariaLabel="Bild steht"
              value={b.bildSeite}
              onChange={(v) => onAendern({ ...b, bildSeite: v })}
              options={[
                { value: 'links', label: 'Links' },
                { value: 'rechts', label: 'Rechts' },
              ]}
            />
          </Gruppe>
          <MarkdownFeld
            label="Text"
            wert={b.markdown}
            onChange={(markdown) => onAendern({ ...b, markdown })}
          />
        </>
      );
    case 'galerie':
      return <GalerieFelder b={b} onAendern={onAendern} />;
    case 'knoepfe':
      return <KnopfFelder b={b} kontext={kontext} onAendern={onAendern} />;
    case 'beitraege':
      return (
        <>
          <ZahlFeld
            label="Wie viele Beiträge?"
            wert={b.anzahl}
            min={1}
            max={20}
            onChange={(anzahl) => onAendern({ ...b, anzahl })}
            hilfe="Beiträge schreibt ihr wie gewohnt in ChurchTools – sie erscheinen ohne eigene Freigabe."
          />
          <ZahlenListe
            label="Gruppen (Nummern aus ChurchTools, leer = alle)"
            wert={b.gruppen ?? []}
            onChange={(z) => {
              const rest = ohneFeld(b, 'gruppen');
              onAendern(z.length === 0 ? rest : { ...rest, gruppen: z });
            }}
          />
        </>
      );
    case 'termine':
      return (
        <>
          <KalenderWahl wert={b.kalender} onChange={(kalender) => onAendern({ ...b, kalender })} />
          <ZahlFeld
            label="Wie viele Termine?"
            wert={b.anzahl}
            min={1}
            max={50}
            onChange={(anzahl) => onAendern({ ...b, anzahl })}
          />
        </>
      );
    case 'slider':
      return (
        <ZahlFeld
          label="Wechsel nach (Sekunden)"
          wert={b.intervallSekunden}
          min={2}
          max={60}
          onChange={(intervallSekunden) => onAendern({ ...b, intervallSekunden })}
          hilfe="Die Bilder kommen aus „Aktuelle Designs“ – hier legst du nur das Tempo fest."
        />
      );
    case 'livestream':
      return (
        <>
          <Gruppe label="Was zeigen?">
            <Segment
              verbunden
              ariaLabel="Was zeigen?"
              value={b.zeigen}
              onChange={(v) => onAendern({ ...b, zeigen: v })}
              options={[
                { value: 'stream', label: 'Livestream' },
                { value: 'archiv', label: 'Archiv' },
                { value: 'beides', label: 'Beides' },
              ]}
            />
          </Gruppe>
          <ZahlFeld
            label="Wie viele Videos im Archiv?"
            wert={b.archivAnzahl}
            min={0}
            max={20}
            onChange={(archivAnzahl) => onAendern({ ...b, archivAnzahl })}
          />
        </>
      );
    case 'kontaktformular':
      return (
        <Feld label="Einleitung (optional)">
          {(id) => (
            <textarea
              id={id}
              className={styles.textfeld}
              rows={4}
              maxLength={2000}
              value={b.einleitung ?? ''}
              onChange={(e) => {
                const rest = ohneFeld(b, 'einleitung');
                onAendern(e.target.value === '' ? rest : { ...rest, einleitung: e.target.value });
              }}
            />
          )}
        </Feld>
      );
    case 'gruppenliste':
      return (
        <ZahlenListe
          label="Gruppentypen (Nummern aus ChurchTools, leer = alle)"
          wert={b.gruppentypen ?? []}
          onChange={(z) => {
            const rest = ohneFeld(b, 'gruppentypen');
            onAendern(z.length === 0 ? rest : { ...rest, gruppentypen: z });
          }}
        />
      );
    case 'trenner':
      return (
        <Gruppe label="Art">
          <Segment
            verbunden
            ariaLabel="Art des Trenners"
            value={b.art}
            onChange={(v) => onAendern({ ...b, art: v })}
            options={[
              { value: 'linie', label: 'Linie' },
              { value: 'abstand', label: 'Nur Abstand' },
            ]}
          />
        </Gruppe>
      );
    case 'html':
      if (!kontext.htmlErlaubt)
        return (
          <p className={styles.sperrhinweis}>
            <Icon name="lock" size={16} />
            Eigenes HTML darf nur die Leitung der Gruppe „Website“ ändern.
          </p>
        );
      return (
        <Feld
          label="HTML-Code"
          hilfe="Wird unverändert auf die Website übernommen. Die Vorschau zeigt es abgeschottet – Skripte darin laufen dort in ChurchTools nicht (Sicherheitsregel von ChurchTools), auf der Website schon."
        >
          {(id) => (
            <textarea
              id={id}
              className={`${styles.textfeld} ${styles.code}`}
              rows={10}
              maxLength={20000}
              spellCheck={false}
              value={b.html}
              onChange={(e) => onAendern({ ...b, html: e.target.value })}
            />
          )}
        </Feld>
      );
    default:
      return unbekannt(b);
  }
}

/** Wird der `switch` oben um einen Typ ergänzt vergessen, scheitert die Typprüfung hier. */
function unbekannt(_b: never): null {
  return null;
}

// ── Überschrift ──────────────────────────────────────────────────────────────────────────────────────────────

function UeberschriftFelder({
  b,
  onAendern,
}: {
  b: Extract<Baustein, { typ: 'ueberschrift' }>;
  onAendern: Aendern<Extract<Baustein, { typ: 'ueberschrift' }>>;
}) {
  return (
    <>
      <Feld label="Text">
        {(id) => (
          <input
            id={id}
            className={styles.eingabe}
            value={b.text}
            maxLength={200}
            onChange={(e) => onAendern({ ...b, text: e.target.value })}
          />
        )}
      </Feld>
      <Gruppe label="Größe">
        <Segment
          verbunden
          ariaLabel="Größe"
          value={b.groesse}
          onChange={(groesse) => onAendern({ ...b, groesse })}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'gross', label: 'Groß' },
            { value: 'riesig', label: 'Riesig' },
          ]}
        />
      </Gruppe>
      <Gruppe label="Rang (für Suchmaschinen und Vorlese-Programme)">
        <Segment
          verbunden
          ariaLabel="Rang"
          value={String(b.ebene) as '1' | '2' | '3'}
          onChange={(v) => onAendern({ ...b, ebene: Number(v) as 1 | 2 | 3 })}
          options={[
            { value: '1', label: 'Seitentitel' },
            { value: '2', label: 'Abschnitt' },
            { value: '3', label: 'Unterpunkt' },
          ]}
        />
      </Gruppe>
      <Haken an={b.punkt === true} onChange={(punkt) => onAendern({ ...b, punkt })}>
        Punkt in der Akzentfarbe am Ende
      </Haken>
    </>
  );
}

// ── Text mit Knöpfen ─────────────────────────────────────────────────────────────────────────────────────────

const MD_KNOEPFE: { art: MarkdownArt; label: string; titel: string }[] = [
  { art: 'fett', label: 'Fett', titel: 'Fett' },
  { art: 'kursiv', label: 'Kursiv', titel: 'Kursiv' },
  { art: 'link', label: 'Link', titel: 'Link einfügen' },
  { art: 'liste', label: 'Liste', titel: 'Liste' },
  { art: 'zwischen', label: 'Zwischenüberschrift', titel: 'Zwischenüberschrift' },
];

function MarkdownFeld({
  label,
  wert,
  onChange,
}: {
  label: string;
  wert: string;
  onChange: (text: string) => void;
}) {
  const feld = useRef<HTMLTextAreaElement>(null);
  const anwenden = (art: MarkdownArt) => {
    const ta = feld.current;
    const r = markdownAnwenden(
      { text: wert, von: ta?.selectionStart ?? wert.length, bis: ta?.selectionEnd ?? wert.length },
      art,
    );
    onChange(r.text);
    // Nach dem Zeichnen die Auswahl setzen, damit man gleich weitertippen kann.
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(r.von, r.bis);
    });
  };
  return (
    <Feld
      label={label}
      hilfe="Ein Absatz beginnt nach einer leeren Zeile. Die Knöpfe setzen die Zeichen für dich."
    >
      {(id) => (
        <>
          <div className={styles.leiste}>
            {MD_KNOEPFE.map((k) => (
              <button
                key={k.art}
                type="button"
                className={styles.leistenKnopf}
                title={k.titel}
                onClick={() => anwenden(k.art)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <textarea
            id={id}
            ref={feld}
            className={styles.textfeld}
            rows={9}
            maxLength={8000}
            value={wert}
            onChange={(e) => onChange(e.target.value)}
          />
        </>
      )}
    </Feld>
  );
}

// ── Bilder (vorerst Platzhalter) ─────────────────────────────────────────────────────────────────────────────

/** Die Bildwahl kommt mit W4 (Bilder-Ablage) – bis dahin steht überall das Platzhalter-Bild. */
function BildPlatz() {
  return (
    <div className={styles.fotoPlatz}>
      <img src={PLATZHALTER_ADRESSE} alt="" />
      <p>
        Hier steht vorerst ein Platzhalter-Bild. Eigene Bilder hochladen und auswählen kommt in
        einem der nächsten Schritte.
      </p>
    </div>
  );
}

function GalerieFelder({
  b,
  onAendern,
}: {
  b: Extract<Baustein, { typ: 'galerie' }>;
  onAendern: Aendern<Extract<Baustein, { typ: 'galerie' }>>;
}) {
  const setze = (n: number, teil: Partial<(typeof b.bilder)[number]>) =>
    onAendern({ ...b, bilder: b.bilder.map((x, i) => (i === n ? { ...x, ...teil } : x)) });
  return (
    <>
      <BildPlatz />
      {b.bilder.map((x, n) => (
        <div key={n} className={styles.knopfBlock}>
          <input
            className={styles.eingabe}
            aria-label={`Beschreibung von Bild ${n + 1}`}
            placeholder={`Beschreibung von Bild ${n + 1}`}
            value={x.alt}
            maxLength={300}
            onChange={(e) => setze(n, { alt: e.target.value })}
          />
          <input
            className={styles.eingabe}
            aria-label={`Unterschrift von Bild ${n + 1}`}
            placeholder="Unterschrift (optional)"
            value={x.unterschrift ?? ''}
            maxLength={300}
            onChange={(e) => setze(n, { unterschrift: e.target.value || undefined })}
          />
          <button
            type="button"
            className={styles.sehrKlein}
            title={`Bild ${n + 1} entfernen`}
            aria-label={`Bild ${n + 1} entfernen`}
            disabled={b.bilder.length <= 1}
            onClick={() => onAendern({ ...b, bilder: b.bilder.filter((_, i) => i !== n) })}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
      <FensterKnopf
        art="zweit"
        disabled={b.bilder.length >= 50}
        onClick={() =>
          onAendern({
            ...b,
            bilder: [...b.bilder, { bild: PLATZHALTER_BILD, alt: 'Bildbeschreibung' }],
          })
        }
      >
        <Icon name="plus" size={16} />
        Bild
      </FensterKnopf>
    </>
  );
}

// ── Knöpfe ───────────────────────────────────────────────────────────────────────────────────────────────────

function KnopfFelder({
  b,
  kontext,
  onAendern,
}: {
  b: Extract<Baustein, { typ: 'knoepfe' }>;
  kontext: FelderKontext;
  onAendern: Aendern<Extract<Baustein, { typ: 'knoepfe' }>>;
}) {
  const setze = (n: number, teil: Partial<(typeof b.knoepfe)[number]>) =>
    onAendern({ ...b, knoepfe: b.knoepfe.map((k, i) => (i === n ? { ...k, ...teil } : k)) });
  const anker = kontext.seite.abschnitte.flatMap((a) => a.gestaltung.anker ?? []);
  return (
    <>
      {b.knoepfe.map((k, n) => {
        const wert = zielWert(k.ziel);
        const bekannt =
          k.ziel.art === 'extern' ||
          (k.ziel.art === 'seite' &&
            kontext.seiten.some((s) => s.id === (k.ziel as { seiteId: string }).seiteId)) ||
          (k.ziel.art === 'anker' && anker.includes(k.ziel.anker));
        return (
          <div key={n} className={styles.knopfBlock}>
            <input
              className={styles.eingabe}
              aria-label={`Beschriftung von Knopf ${n + 1}`}
              placeholder="Beschriftung"
              value={k.text}
              maxLength={100}
              onChange={(e) => setze(n, { text: e.target.value })}
            />
            <select
              className={styles.eingabe}
              aria-label={`Ziel von Knopf ${n + 1}`}
              value={wert}
              onChange={(e) => {
                const [art, ...rest] = e.target.value.split(':');
                const v = rest.join(':');
                setze(n, {
                  ziel:
                    art === 'seite'
                      ? { art: 'seite', seiteId: v }
                      : art === 'anker'
                        ? { art: 'anker', anker: v }
                        : k.ziel.art === 'extern'
                          ? k.ziel
                          : { art: 'extern', url: PLATZHALTER_LINK.url },
                });
              }}
            >
              {!bekannt && <option value={wert}>(Ziel gibt es nicht mehr)</option>}
              {kontext.seiten.map((s) => (
                <option key={s.id} value={`seite:${s.id}`}>
                  Seite: {s.titel}
                </option>
              ))}
              {anker.map((a) => (
                <option key={a} value={`anker:${a}`}>
                  Sprung zu „{a}“
                </option>
              ))}
              <option value="extern">Andere Adresse …</option>
            </select>
            <select
              className={styles.eingabe}
              aria-label={`Art von Knopf ${n + 1}`}
              value={k.art}
              onChange={(e) => setze(n, { art: e.target.value === 'haupt' ? 'haupt' : 'neben' })}
            >
              <option value="haupt">Hauptknopf</option>
              <option value="neben">Nebenknopf</option>
            </select>
            <button
              type="button"
              className={styles.sehrKlein}
              title={`Knopf ${n + 1} entfernen`}
              aria-label={`Knopf ${n + 1} entfernen`}
              disabled={b.knoepfe.length <= 1}
              onClick={() => onAendern({ ...b, knoepfe: b.knoepfe.filter((_, i) => i !== n) })}
            >
              <Icon name="x" size={16} />
            </button>
            {k.ziel.art === 'extern' && (
              <div className={styles.volleBreite}>
                <input
                  className={styles.eingabe}
                  aria-label={`Adresse von Knopf ${n + 1}`}
                  placeholder="https://…"
                  value={k.ziel.url}
                  onChange={(e) => setze(n, { ziel: { art: 'extern', url: e.target.value } })}
                />
                {!istErlaubteAdresse(k.ziel.url) && (
                  <p role="alert" className={styles.fehler}>
                    Erlaubt sind nur Adressen mit https:, http:, mailto: oder tel: (ohne
                    Leerzeichen).
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
      <FensterKnopf
        art="zweit"
        disabled={b.knoepfe.length >= 4}
        onClick={() =>
          onAendern({
            ...b,
            knoepfe: [...b.knoepfe, { text: 'Knopf', ziel: PLATZHALTER_LINK, art: 'neben' }],
          })
        }
      >
        <Icon name="plus" size={16} />
        Knopf
      </FensterKnopf>
    </>
  );
}

// ── Kalender ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Kalender zur Auswahl: aus ChurchTools (`GET /calendars`, `kalenderAus` – dieselbe Liste wie bei den Ablaufvorlagen).
 * Geht das nicht (kein Recht, Netz), bleibt die Eingabe der Nummern – nichts geht verloren. Kalender, die schon im
 * Baustein stehen, ChurchTools aber nicht (mehr) nennt, bleiben mit ihrer Nummer erhalten.
 */
function KalenderWahl({
  wert,
  onChange,
}: {
  wert: readonly number[];
  onChange: (kalender: number[]) => void;
}) {
  const geladen = useLaden(() => ctDaten<CtKalender[]>('/calendars'), []);
  if (geladen.stand.art !== 'fertig')
    return geladen.stand.art === 'fehler' ? (
      <>
        <p className={styles.unterText}>
          Die Kalender lassen sich gerade nicht laden. Du kannst die Nummern auch von Hand
          eintragen.
        </p>
        <ZahlenListe label="Kalender (Nummern aus ChurchTools)" wert={wert} onChange={onChange} />
      </>
    ) : (
      <p className={styles.unterText}>Die Kalender werden geladen …</p>
    );
  const kalender = kalenderAus(geladen.stand.daten);
  const fremd = wert.filter((id) => !kalender.some((k) => k.id === id));
  const schalte = (id: number, an: boolean) =>
    onChange(an ? [...wert, id] : wert.filter((x) => x !== id));
  return (
    <Gruppe
      label="Kalender"
      hilfe="Auf der Website erscheinen nur Termine aus öffentlichen Kalendern. Mindestens ein Kalender muss gewählt sein."
    >
      {kalender.map((k) => (
        <Haken key={k.id} an={wert.includes(k.id)} onChange={(an) => schalte(k.id, an)}>
          {k.name}
        </Haken>
      ))}
      {fremd.map((id) => (
        <Haken key={id} an onChange={(an) => schalte(id, an)}>
          Kalender {id} (ChurchTools nennt ihn nicht)
        </Haken>
      ))}
    </Gruppe>
  );
}
