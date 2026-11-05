import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { jsPDF } from 'jspdf';
import {
  gruppenSchluessel,
  terminBlatt,
  type BlattEinstellungen,
  type BlattQuelle,
} from '@shared/ct/terminBlatt';
import { Sheet } from '../fenster/Sheet';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Schalter } from '../bedienung/Schalter';
import { Segment } from '../bedienung/Segment';
import { Spinner } from '../bedienung/Spinner';
import { Icon } from '../icons/icons';
import { PdfSeitenVorschau } from './PdfSeitenVorschau';
import { downloadPdf, sharePdf } from './sharePdf';
import { terminBlattPdf } from './terminBlattPdf';
import { leseWahl, merkeWahl } from './terminBlattWahl';
import styles from './TerminTeilenFenster.module.scss';

const stempel = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type Seite = 'haupt' | 'dienste' | 'ablauf' | 'infos';
type Stand = { art: 'baut' } | { art: 'fertig'; doc: jsPDF } | { art: 'fehler' };

/**
 * **„Termin teilen“** (Bauplan E8-1, Entwurf `e8-teilen.html` Version 5) – das Termin-Blatt als PDF. Die Hauptseite
 * zeigt drei Zeilen (Dienste, Ablauf, Infos) mit dem, was gerade eingestellt ist, dazu Hoch/Quer, die fertigen Seiten
 * und „Herunterladen“/„Teilen“; meist tippt man nur „Teilen“. Ein Tipp auf eine Zeile öffnet ihre Unterseite im selben
 * Fenster (‹ zurück): dort schaltet man den Teil ein oder aus und wählt die Einzelheiten (Alwin, 05.11.2026: Mix aus
 * „wie die Ansicht“ und „alles wählbar“). Das Gerät merkt sich die Wahl.
 *
 * Die Infos-Gruppen kommen vorab aus „Spalten“ in der Ansicht (`ansichtInfos`); hier geändert gilt es nur fürs Teilen.
 */
export function TerminTeilenFenster({
  quelle,
  onClose,
  kopf,
  einblenden = true,
  diensteHinweis,
}: {
  quelle: Omit<BlattQuelle, 'stand'>;
  onClose: () => void;
  /** Oben auf der Hauptseite – in der Musik-App die Wahl „Liedblätter | Termin-Blatt“ (E8-1b). */
  kopf?: ReactNode;
  /** `false`, wenn das Fenster ein gleiches ersetzt (Umschalten in der Musik-App) – dann blendet es nicht neu ein. */
  einblenden?: boolean;
  /**
   * Die Dienste sind gerade nicht zu haben („werden geladen …“, „nur in ChurchTools“, Fehler) – dann steht das in der
   * Zeile „Dienste“, sie führt nirgends hin, und aufs Blatt kommen keine.
   */
  diensteHinweis?: string;
}) {
  const [stand] = useState(() => `Stand ${stempel.format(new Date())}`);
  const [wahl, setWahlRoh] = useState<BlattEinstellungen>(leseWahl);
  const [seite, setSeiteRoh] = useState<Seite>('haupt');
  // Nach dem ersten Wechsel blendet das Fenster nicht noch einmal ein – es ist dasselbe Fenster mit anderer Seite.
  const [gewechselt, setGewechselt] = useState(false);
  const setSeite = (s: Seite) => {
    setGewechselt(true);
    setSeiteRoh(s);
  };
  const [pdf, setPdf] = useState<Stand>({ art: 'baut' });
  const [geladen, setGeladen] = useState(false);

  const setWahl = (f: (w: BlattEinstellungen) => void) =>
    setWahlRoh((alt) => {
      const neu = structuredClone(alt);
      f(neu);
      merkeWahl(neu);
      return neu;
    });

  // Nach dem INHALT der Quelle, nicht nach dem Objekt: Die Aufrufer bauen sie beim Zeichnen neu (Termin-Ansicht im
  // Rückruf von `TerminAblauf`) – sonst entstünde das PDF bei jedem Neuzeichnen der Seite noch einmal.
  const quelleText = JSON.stringify(quelle);
  const blatt = useMemo(
    () => terminBlatt({ ...(JSON.parse(quelleText) as typeof quelle), stand }, wahl),
    [quelleText, stand, wahl],
  );

  useEffect(() => {
    // Wer während des Bauens umschaltet, bekommt das PDF zur NEUEN Wahl – ein später fertiges altes zählt nicht.
    let aktuell = true;
    setPdf({ art: 'baut' });
    setGeladen(false);
    terminBlattPdf(blatt).then(
      (doc) => aktuell && setPdf({ art: 'fertig', doc }),
      () => aktuell && setPdf({ art: 'fehler' }),
    );
    return () => {
      aktuell = false;
    };
  }, [blatt]);

  const zurueck = () => setSeite('haupt');
  // Ohne Dienste am Termin führt die Zeile nirgends hin – „keine Gruppe gewählt“ wäre falsch.
  const ohneDienste =
    diensteHinweis ??
    (quelle.dienste.length === 0 ? 'An diesem Termin sind keine Dienste vorgesehen.' : undefined);
  if (seite === 'dienste')
    return (
      <Sheet title="Dienste" onClose={onClose} zurueck={zurueck} knoepfe={null} einblenden={false}>
        <DiensteSeite quelle={quelle} wahl={wahl} setWahl={setWahl} />
      </Sheet>
    );
  if (seite === 'ablauf')
    return (
      <Sheet title="Ablauf" onClose={onClose} zurueck={zurueck} knoepfe={null} einblenden={false}>
        <AblaufSeite wahl={wahl} setWahl={setWahl} />
      </Sheet>
    );
  if (seite === 'infos')
    return (
      <Sheet title="Infos" onClose={onClose} zurueck={zurueck} knoepfe={null} einblenden={false}>
        <InfosSeite quelle={quelle} wahl={wahl} setWahl={setWahl} />
      </Sheet>
    );

  const fertig = pdf.art === 'fertig' ? pdf.doc : null;
  const seiten = fertig?.getNumberOfPages() ?? 0;
  return (
    <Sheet
      title="Termin teilen"
      onClose={onClose}
      einblenden={einblenden && !gewechselt}
      knoepfe={
        <>
          <FensterKnopf
            art="hell"
            disabled={!fertig}
            onClick={() => {
              if (!fertig) return;
              downloadPdf(fertig, blatt.dateiname);
              setGeladen(true);
            }}
          >
            <Icon name="download" size={18} /> Herunterladen
          </FensterKnopf>
          <FensterKnopf
            disabled={!fertig}
            onClick={() => {
              if (!fertig) return;
              void sharePdf(fertig, blatt.dateiname);
              onClose();
            }}
          >
            {pdf.art === 'baut' ? (
              <Spinner />
            ) : (
              <>
                <Icon name="share" size={18} /> Teilen
              </>
            )}
          </FensterKnopf>
        </>
      }
    >
      <div className={styles.inhalt}>
        {kopf}
        <div className={styles.liste}>
          <ZeilenWahl
            titel="Dienste"
            text={ohneDienste ?? diensteText(quelle, wahl)}
            onClick={() => setSeite('dienste')}
            gesperrt={ohneDienste !== undefined}
          />
          <ZeilenWahl
            titel="Ablauf"
            text={quelle.zeilen ? ablaufText(wahl) : 'Dieser Termin hat keinen Ablauf.'}
            onClick={() => setSeite('ablauf')}
            gesperrt={!quelle.zeilen}
          />
          {quelle.infoGruppen.length > 0 && (
            <ZeilenWahl
              titel="Infos"
              text={infosText(quelle, wahl)}
              onClick={() => setSeite('infos')}
            />
          )}
        </div>
        <div className={styles.reihe}>
          <span className={styles.reiheText}>Seite</span>
          <Segment
            verbunden
            value={wahl.quer ? 'quer' : 'hoch'}
            options={[
              { value: 'hoch', label: 'Hochformat' },
              { value: 'quer', label: 'Querformat' },
            ]}
            onChange={(v) => setWahl((w) => (w.quer = v === 'quer'))}
            ariaLabel="Seite"
          />
        </div>
        <p className={styles.stand} role="status">
          {pdf.art === 'baut'
            ? 'PDF wird erstellt …'
            : pdf.art === 'fehler'
              ? 'Das PDF konnte nicht erstellt werden – bitte noch einmal öffnen.'
              : [
                  `Fertig · ${seiten} ${seiten === 1 ? 'Seite' : 'Seiten'} · ${blatt.dateiname}.pdf`,
                  geladen ? 'Heruntergeladen' : '',
                ]
                  .filter(Boolean)
                  .join('. ')}
        </p>
        {fertig && <PdfSeitenVorschau doc={fertig} />}
      </div>
    </Sheet>
  );
}

// ── Zusammenfassungen auf der Hauptseite ────────────────────────────────────

const AUS = 'nicht auf dem Blatt';

function diensteText(q: Pick<BlattQuelle, 'dienste'>, w: BlattEinstellungen): string {
  if (!w.dienste.an) return AUS;
  const namen = q.dienste
    .filter((g) => !w.dienste.ohne.includes(gruppenSchluessel(g)))
    .map((g) => g.name);
  if (namen.length === 0) return 'keine Gruppe gewählt';
  return `${namen.join(', ')} · ${w.dienste.unten ? 'unter' : 'über'} dem Ablauf`;
}

function ablaufText(w: BlattEinstellungen): string {
  const a = w.ablauf;
  if (!a.an) return AUS;
  const teile = [
    a.uhrzeit && 'Uhrzeit',
    a.dauer && 'Dauer',
    a.zustaendig && (a.zustaendigUnter ? 'Zuständig unter dem Eintrag' : 'Zuständig'),
    a.notiz && 'Notiz',
  ].filter(Boolean);
  const lied = [a.tonart && 'Tonart', a.tempo && 'Tempo'].filter(Boolean);
  return [
    teile.join(', ') || 'nur die Einträge',
    lied.length ? `Lieder mit ${lied.join(' und ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function infosText(
  q: Pick<BlattQuelle, 'infoGruppen' | 'ansichtInfos'>,
  w: BlattEinstellungen,
): string {
  if (!w.infos.an) return AUS;
  const ids = w.infos.gruppen ?? q.ansichtInfos;
  const namen = q.infoGruppen.filter((g) => ids.includes(g.id)).map((g) => g.name);
  if (namen.length === 0) return 'keine Gruppe gewählt';
  return `${namen.join(', ')} ${w.infos.unter ? 'unter dem Eintrag' : 'als Spalten'}${w.infos.gruppen === null ? ' – wie in der Ansicht' : ''}`;
}

// ── Bausteine ───────────────────────────────────────────────────────────────

function ZeilenWahl({
  titel,
  text,
  onClick,
  gesperrt = false,
}: {
  titel: string;
  text: string;
  onClick: () => void;
  gesperrt?: boolean;
}) {
  return (
    <button type="button" className={styles.zeile} onClick={onClick} disabled={gesperrt}>
      <span className={styles.text}>
        <b>{titel}</b>
        <small>{text}</small>
      </span>
      {!gesperrt && <Icon name="chev-right" size={16} />}
    </button>
  );
}

/** Oben auf jeder Unterseite: den Teil ein- oder ausschalten. Die ganze Zeile ist der Knopf (wie `SchalterZeile`). */
function HauptSchalter({
  titel,
  hinweis,
  an,
  onUmschalten,
}: {
  titel: string;
  hinweis: string;
  an: boolean;
  onUmschalten: () => void;
}) {
  return (
    <div className={styles.liste}>
      <button type="button" className={styles.zeile} aria-pressed={an} onClick={onUmschalten}>
        <span className={styles.text}>
          <b>{titel}</b>
          <small>{hinweis}</small>
        </span>
        <Schalter an={an} />
      </button>
    </div>
  );
}

function Kaestchen({
  label,
  hinweis,
  an,
  onUmschalten,
}: {
  label: string;
  hinweis?: string;
  an: boolean;
  onUmschalten: () => void;
}) {
  return (
    <label className={styles.kaestchen}>
      <input type="checkbox" checked={an} onChange={onUmschalten} />
      <span className={styles.text}>
        <span>{label}</span>
        {hinweis && <small>{hinweis}</small>}
      </span>
    </label>
  );
}

function Gruppe({ titel, aus, children }: { titel: string; aus?: boolean; children: ReactNode }) {
  return (
    <section className={`${styles.gruppe}${aus ? ` ${styles.aus}` : ''}`} aria-disabled={aus}>
      <h3 className={styles.ueber}>{titel}</h3>
      {children}
    </section>
  );
}

type WahlSetzen = (f: (w: BlattEinstellungen) => void) => void;

// ── Unterseiten ─────────────────────────────────────────────────────────────

function DiensteSeite({
  quelle,
  wahl,
  setWahl,
}: {
  quelle: Pick<BlattQuelle, 'dienste'>;
  wahl: BlattEinstellungen;
  setWahl: WahlSetzen;
}) {
  const d = wahl.dienste;
  return (
    <div className={styles.inhalt}>
      <HauptSchalter
        titel="Dienste aufs Blatt"
        hinweis="wer was macht, nach Gruppen"
        an={d.an}
        onUmschalten={() => setWahl((w) => (w.dienste.an = !w.dienste.an))}
      />
      {quelle.dienste.length > 0 && (
        <Gruppe titel="Gruppen" aus={!d.an}>
          <div className={styles.liste}>
            {quelle.dienste.map((g) => {
              const k = gruppenSchluessel(g);
              return (
                <Kaestchen
                  key={k}
                  label={g.name}
                  an={!d.ohne.includes(k)}
                  onUmschalten={() =>
                    setWahl((w) => {
                      w.dienste.ohne = w.dienste.ohne.includes(k)
                        ? w.dienste.ohne.filter((x) => x !== k)
                        : [...w.dienste.ohne, k];
                    })
                  }
                />
              );
            })}
          </div>
        </Gruppe>
      )}
      <Gruppe titel="Zeigen" aus={!d.an}>
        <div className={styles.liste}>
          <Kaestchen
            label="Freie Plätze"
            hinweis="rot als „frei“"
            an={d.frei}
            onUmschalten={() => setWahl((w) => (w.dienste.frei = !w.dienste.frei))}
          />
          <Kaestchen
            label="„angefragt“"
            hinweis="bei allen, die noch nicht zugesagt haben"
            an={d.angefragt}
            onUmschalten={() => setWahl((w) => (w.dienste.angefragt = !w.dienste.angefragt))}
          />
        </div>
      </Gruppe>
      <Gruppe titel="Auf dem Blatt" aus={!d.an}>
        <Segment
          verbunden
          value={d.unten ? 'unten' : 'oben'}
          options={[
            { value: 'oben', label: 'Über dem Ablauf' },
            { value: 'unten', label: 'Unter dem Ablauf' },
          ]}
          onChange={(v) => setWahl((w) => (w.dienste.unten = v === 'unten'))}
          ariaLabel="Auf dem Blatt"
        />
      </Gruppe>
    </div>
  );
}

function AblaufSeite({ wahl, setWahl }: { wahl: BlattEinstellungen; setWahl: WahlSetzen }) {
  const a = wahl.ablauf;
  const kasten = (label: string, feld: keyof BlattEinstellungen['ablauf'], hinweis?: string) => (
    <Kaestchen
      label={label}
      hinweis={hinweis}
      an={a[feld]}
      onUmschalten={() => setWahl((w) => (w.ablauf[feld] = !w.ablauf[feld]))}
    />
  );
  return (
    <div className={styles.inhalt}>
      <HauptSchalter
        titel="Ablauf aufs Blatt"
        hinweis="alle Einträge mit Zeiten"
        an={a.an}
        onUmschalten={() => setWahl((w) => (w.ablauf.an = !w.ablauf.an))}
      />
      <Gruppe titel="Spalten" aus={!a.an}>
        <div className={styles.liste}>
          {kasten('Uhrzeit', 'uhrzeit')}
          {kasten('Dauer', 'dauer')}
          {kasten('Zuständig', 'zustaendig', 'ganze Teams nur als Dienst-Name')}
          {kasten('Notiz', 'notiz')}
        </div>
        {a.zustaendig && (
          <div className={styles.reihe}>
            <span className={styles.reiheText}>Zuständig</span>
            <Segment
              verbunden
              value={a.zustaendigUnter ? 'unter' : 'spalte'}
              options={[
                { value: 'spalte', label: 'Eigene Spalte' },
                { value: 'unter', label: 'Unter dem Eintrag' },
              ]}
              onChange={(v) => setWahl((w) => (w.ablauf.zustaendigUnter = v === 'unter'))}
              ariaLabel="Zuständig"
            />
          </div>
        )}
      </Gruppe>
      <Gruppe titel="Lieder" aus={!a.an}>
        <div className={styles.liste}>
          {kasten('Tonart', 'tonart')}
          {kasten('Tempo', 'tempo')}
          {kasten('Arrangement', 'arrangement')}
        </div>
      </Gruppe>
      <Gruppe titel="Einträge" aus={!a.an}>
        <div className={styles.liste}>
          {kasten('Vorlauf', 'vorlauf', 'Einträge vor Beginn, z. B. Soundcheck')}
          {kasten('Weggelassene Einträge', 'weggelassen')}
        </div>
      </Gruppe>
    </div>
  );
}

function InfosSeite({
  quelle,
  wahl,
  setWahl,
}: {
  quelle: Pick<BlattQuelle, 'infoGruppen' | 'ansichtInfos'>;
  wahl: BlattEinstellungen;
  setWahl: WahlSetzen;
}) {
  const i = wahl.infos;
  const ids = i.gruppen ?? quelle.ansichtInfos;
  return (
    <div className={styles.inhalt}>
      <HauptSchalter
        titel="Infos aufs Blatt"
        hinweis="was die Gruppen zu einem Eintrag notiert haben"
        an={i.an}
        onUmschalten={() => setWahl((w) => (w.infos.an = !w.infos.an))}
      />
      <p className={styles.hinweis}>
        Vorgabe: wie unter „Spalten“ in der Termin-Ansicht. Hier geändert, gilt es nur fürs Teilen.
        {i.gruppen !== null && (
          <>
            {' '}
            <button
              type="button"
              className={styles.link}
              onClick={() => setWahl((w) => (w.infos.gruppen = null))}
            >
              Wieder wie in der Ansicht
            </button>
          </>
        )}
      </p>
      <Gruppe titel="Gruppen" aus={!i.an}>
        <div className={styles.liste}>
          {quelle.infoGruppen.map((g) => (
            <Kaestchen
              key={g.id}
              label={g.name}
              an={ids.includes(g.id)}
              onUmschalten={() =>
                setWahl((w) => {
                  const jetzt = w.infos.gruppen ?? [...quelle.ansichtInfos];
                  w.infos.gruppen = jetzt.includes(g.id)
                    ? jetzt.filter((x) => x !== g.id)
                    : [...jetzt, g.id];
                })
              }
            />
          ))}
        </div>
      </Gruppe>
      <Gruppe titel="Darstellung" aus={!i.an}>
        <Segment
          verbunden
          value={i.unter ? 'unter' : 'spalten'}
          options={[
            { value: 'spalten', label: 'Als Spalten' },
            { value: 'unter', label: 'Unter dem Eintrag' },
          ]}
          onChange={(v) => setWahl((w) => (w.infos.unter = v === 'unter'))}
          ariaLabel="Darstellung"
        />
      </Gruppe>
    </div>
  );
}
