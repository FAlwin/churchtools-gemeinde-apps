import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { Segment } from '@ui/bedienung/Segment';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { ctBasis } from '@ui/ct/basis';
import { tagKurz, tagPunkt } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import type { Stufe, Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import {
  aktuellesWechseljahr,
  gruppenSicht,
  phaseAm,
  pflegeAus,
  type GruppenSicht,
  type KindZeile,
  type KjZugang,
  type NeuZeile,
  type Phase,
} from '@shared/organigramm/gruppenwechselSicht';
import { initialenAus, istLeitung } from '@shared/organigramm/mitglieder';
import { ladeFerien, ladeKjDaten, type FerienStand, type KjLadeStand } from './ladeKinderJugend';
import type { Start } from './start';
import styles from './KinderJugend.module.scss';

interface Props {
  start: Start;
  einrichtung: Einrichtung;
  zugang: KjZugang;
  /** Abgemeldet gilt für die ganze Seite – dieselbe Stelle wie für den Rest der App. */
  onAbgemeldet: (e: unknown) => void;
}

type Unter = 'gruppe' | 'daten';
type Laden<T> = { art: 'laedt' } | T;

/** „Mo, 06.09.2027“ – der Wechseltag mit Wochentag (Entwurf v3). */
const wechseltagText = (tag: string) => `${tagKurz(tag).split(',')[0]}, ${tagPunkt(tag)}`;
const kurz = (name: string) => name.split(' ')[0];

/**
 * **Der Reiter „Kinder & Jugend“ – nur lesen** (Bauplan O9-2, Entwurf v3): Leitungen sehen ihre Gruppe, Bereichsleitung
 * und Admins eine Übersicht über alle Stufen; dazu „Daten pflegen“. Ein Kind öffnet ein Fenster, das nur zeigt –
 * die Ausnahme setzen kommt mit O9-3.
 */
export function KinderJugend({ start, einrichtung, zugang, onAbgemeldet }: Props) {
  const heute = useMemo(() => heuteImKalender(), []);
  const [ferien, setFerien] = useState<Laden<FerienStand>>({ art: 'laedt' });
  const [daten, setDaten] = useState<Laden<KjLadeStand>>({ art: 'laedt' });
  const [unter, setUnter] = useState<Unter>('gruppe');
  // Leitung mehrerer Stufen: welche gerade. Bereichsleitung: die aus der Übersicht geöffnete (`null` = Übersicht).
  const [stufeWahl, setStufeWahl] = useState<number | null>(
    zugang.art === 'leitung' ? zugang.stufen[0] : null,
  );
  const [offenesKind, setOffenesKind] = useState<{ kind: KindZeile; stufe: GruppenSicht } | null>(
    null,
  );

  const laden = useCallback(() => {
    setFerien({ art: 'laedt' });
    setDaten({ art: 'laedt' });
    // Beide werfen nur, wenn man abgemeldet ist; alles andere kommt als `fehler` zurück.
    ladeFerien(einrichtung.einstellung, heute).then(setFerien, onAbgemeldet);
    ladeKjDaten(einrichtung, (rolleId) => istLeitung(start.rollen, rolleId)).then(
      setDaten,
      onAbgemeldet,
    );
  }, [einrichtung, heute, start.rollen, onAbgemeldet]);
  useEffect(laden, [laden]);

  const jahr = ferien.art === 'da' ? aktuellesWechseljahr(ferien.jahre, heute) : null;
  const sichten = useMemo(() => {
    if (!jahr || daten.art !== 'da') return [];
    const stufen =
      zugang.art === 'bereich'
        ? einrichtung.einstellung.stufen.map((s) => s.gruppeId)
        : zugang.stufen;
    const neu = zugang.art === 'bereich' ? 'immer' : 'abAnkuendigung';
    return stufen.flatMap(
      (id) => gruppenSicht(einrichtung, id, daten.daten, jahr, heute, neu) ?? [],
    );
  }, [jahr, daten, zugang, einrichtung, heute]);

  if (ferien.art === 'laedt' || daten.art === 'laedt')
    return <CenterMessage loading text="Kinder und Wechseltage werden geladen …" />;
  if (ferien.art === 'fehler' || daten.art === 'fehler')
    return <CenterMessage icon="warnung" text="Gerade nicht ladbar." onRetry={laden} />;
  if (ferien.art === 'keinKalender')
    return (
      <CenterMessage
        icon="calendar"
        text={`Der Kalender „${einrichtung.einstellung.ferienkalender}“ ist für dich nicht sichtbar. Ohne ihn fehlen die Wechseltage – bitte einen Admin, ihn für dich freizugeben.`}
      />
    );
  if (!jahr)
    return (
      <CenterMessage
        icon="calendar"
        text={`Im Kalender „${einrichtung.einstellung.ferienkalender}“ stehen keine künftigen Sommerferien. Bitte einem Admin Bescheid geben.`}
      />
    );

  const phase = phaseAm(jahr, heute);
  const bereich = zugang.art === 'bereich';
  const offeneSicht = sichten.find((s) => s.stufe.gruppeId === stufeWahl) ?? null;
  const kindOeffnen = (stufe: GruppenSicht) => (kind: KindZeile) => setOffenesKind({ kind, stufe });

  return (
    <div className={styles.seite}>
      <Segment<Unter>
        value={unter}
        options={[
          { value: 'gruppe', label: bereich ? 'Übersicht' : 'Meine Gruppe' },
          { value: 'daten', label: 'Daten pflegen' },
        ]}
        onChange={(u) => {
          setUnter(u);
          if (bereich) setStufeWahl(null);
        }}
        ariaLabel="Kinder & Jugend"
        verbunden
      />
      {unter === 'gruppe' && !bereich && sichten.length > 1 && (
        <Segment<string>
          value={String(stufeWahl)}
          options={sichten.map((s) => ({ value: String(s.stufe.gruppeId), label: s.stufe.name }))}
          onChange={(v) => setStufeWahl(Number(v))}
          ariaLabel="Gruppe"
          verbunden
        />
      )}
      {unter === 'gruppe' &&
        (offeneSicht ? (
          <GruppenSeite
            sicht={offeneSicht}
            jahr={jahr}
            phase={phase}
            bereich={bereich}
            onZurueck={bereich ? () => setStufeWahl(null) : undefined}
            onKind={kindOeffnen(offeneSicht)}
          />
        ) : bereich ? (
          <Uebersicht sichten={sichten} jahr={jahr} phase={phase} onStufe={setStufeWahl} />
        ) : null)}
      {unter === 'daten' && (
        <DatenPflegen sichten={sichten} bereich={bereich} jahr={jahr} onKind={setOffenesKind} />
      )}
      {offenesKind && (
        <KindFenster
          kind={offenesKind.kind}
          sicht={offenesKind.stufe}
          jahr={jahr}
          onSchliessen={() => setOffenesKind(null)}
        />
      )}
    </div>
  );
}

// ── Bausteine ──────────────────────────────────────────────────────────────────────────────────────────────────

function Hinweis({ children }: { children: ReactNode }) {
  return (
    <div className={styles.hinweis}>
      <Icon name="info" size={16} />
      <span>{children}</span>
    </div>
  );
}

function Jahresband({ jahr, phase }: { jahr: Wechseljahr; phase: Phase }) {
  return (
    <section className={styles.jahr} aria-label="Ablauf im Jahr">
      <div className={phase === 'angekuendigt' ? styles.jetzt : undefined}>
        <b>Angekündigt</b>
        <span>
          {phase === 'ruhig' ? 'am' : 'seit'} {tagPunkt(jahr.ankuendigung)}
        </span>
        <small>von selbst</small>
      </div>
      <div className={phase === 'wechsel' ? styles.jetzt : undefined}>
        <b>Wechseltag</b>
        <span>{wechseltagText(jahr.wechseltag)}</span>
        <small>Kinder gehen von selbst in die neue Gruppe</small>
      </div>
      <div>
        <b>Stichtag</b>
        <span>{tagPunkt(jahr.stichtag)}</span>
        <small>zählt fürs Alter</small>
      </div>
    </section>
  );
}

function Chips({ kind, neuVon }: { kind?: KindZeile; neuVon?: string }) {
  const chips: { text: string; art: 'blau' | 'gruen' | 'rot' | 'grau' }[] = [];
  if (neuVon) chips.push({ text: `kommt aus ${kurz(neuVon)}`, art: 'gruen' });
  if (kind) {
    const w = kind.wechsel;
    if (w.art === 'wechselt') chips.push({ text: `wechselt → ${kurz(w.nach.name)}`, art: 'blau' });
    if (w.art === 'ausnahme') chips.push({ text: 'bleibt noch ein Jahr', art: 'grau' });
    if (w.art === 'ohneGeburtstag') chips.push({ text: 'Geburtstag fehlt', art: 'rot' });
    if (w.art === 'unbekannt') chips.push({ text: 'nicht lesbar', art: 'grau' });
    if (kind.wird18) chips.push({ text: 'wird 18', art: 'blau' });
  }
  return (
    <span className={styles.chips}>
      {chips.map((c) => (
        <span key={c.text} className={`${styles.chip} ${styles[c.art]}`}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

function meta(k: KindZeile, jahr: Wechseljahr): string {
  if (k.wechsel.art === 'unbekannt') return 'Daten nicht lesbar';
  if (!k.geburtstag) return 'ohne Geburtstag';
  return `geb. ${tagPunkt(k.geburtstag)} · am ${tagPunkt(jahr.stichtag).slice(0, 6)} ${k.alter} Jahre`;
}

function KindListe<K extends KindZeile>({
  kinder,
  leer,
  jahr,
  onKind,
}: {
  kinder: readonly K[];
  leer: string;
  jahr: Wechseljahr;
  onKind: (k: K) => void;
}) {
  if (kinder.length === 0) return <p className={styles.leer}>{leer}</p>;
  return (
    <ul className={styles.zeilen}>
      {kinder.map((k) => (
        <li key={k.personId}>
          <button type="button" className={styles.zeile} onClick={() => onKind(k)}>
            <PersonBild name={k.name} bild={null} initialen={initialenAus(k.name)} groesse={32} />
            <span className={styles.mitte}>
              <span className={styles.name}>{k.name}</span>
              <span className={styles.meta}>{meta(k, jahr)}</span>
            </span>
            <Chips kind={k} />
            <Icon name="chev-right" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function NeuListe({ neu }: { neu: readonly NeuZeile[] }) {
  if (neu.length === 0) return <p className={styles.leer}>Niemand kommt neu dazu.</p>;
  return (
    <ul className={styles.zeilen}>
      {neu.map((k) => (
        <li key={k.personId} className={styles.zeile}>
          <PersonBild name={k.name} bild={null} initialen={initialenAus(k.name)} groesse={32} />
          <span className={styles.mitte}>
            <span className={styles.name}>{k.name}</span>
          </span>
          <Chips neuVon={k.von.name} />
        </li>
      ))}
    </ul>
  );
}

function Abschnitt({
  titel,
  anzahl,
  children,
}: {
  titel: string;
  anzahl: number;
  children: ReactNode;
}) {
  return (
    <>
      <h3 className={styles.abschnitt}>
        {titel}
        <span className={styles.anzahl}>{anzahl}</span>
      </h3>
      {children}
    </>
  );
}

// ── Seiten ─────────────────────────────────────────────────────────────────────────────────────────────────────

function GruppenSeite({
  sicht,
  jahr,
  phase,
  bereich,
  onZurueck,
  onKind,
}: {
  sicht: GruppenSicht;
  jahr: Wechseljahr;
  phase: Phase;
  bereich: boolean;
  onZurueck?: () => void;
  onKind: (k: KindZeile) => void;
}) {
  const s = sicht;
  const wt = wechseltagText(jahr.wechseltag);
  return (
    <>
      <div className={styles.kopf}>
        {onZurueck && (
          <button
            type="button"
            className={styles.zurueck}
            onClick={onZurueck}
            aria-label="Zurück zur Übersicht"
          >
            <Icon name="chev-left" size={16} />
            Übersicht
          </button>
        )}
        <h2>{s.stufe.name}</h2>
        <span className={styles.leise}>
          {s.leitung.length > 0 ? `Leitung: ${s.leitung.join(', ')} · ` : ''}
          {s.kinder.length} Kinder
        </span>
      </div>
      <Jahresband jahr={jahr} phase={phase} />
      {s.stand !== 'sichtbar' ? (
        <Hinweis>
          {s.stand === 'verborgen'
            ? 'Die Mitglieder dieser Gruppe darfst du nicht sehen.'
            : 'Die Mitglieder dieser Gruppe sind gerade nicht ladbar.'}
        </Hinweis>
      ) : phase === 'ruhig' ? (
        <Hinweis>
          Noch nicht angekündigt. Unten steht, wer <b>nach heutigem Stand</b> am {wt} wechselt.
        </Hinweis>
      ) : phase === 'angekuendigt' ? (
        <Hinweis>
          <b>Der Wechsel ist angekündigt.</b> Prüfe die Liste bis zum {wt}. Danach geht alles von
          selbst.
        </Hinweis>
      ) : (
        <Hinweis>
          <b>Der Wechsel läuft.</b> Die Kinder kommen bis zum {tagPunkt(jahr.aufnahmeBis)} von
          selbst in die neue Gruppe.
        </Hinweis>
      )}
      {s.naechste && !s.ausnahmenBekannt && (
        <Hinweis>
          Ob jemand als Ausnahme noch bleibt, ist gerade nicht lesbar – die Liste zeigt alle, die
          alt genug sind.
        </Hinweis>
      )}
      <section className={styles.karte}>
        {s.naechste && (
          <Abschnitt titel={`Wechseln zu ${s.naechste.name}`} anzahl={s.wechseln.length}>
            <KindListe kinder={s.wechseln} leer="Niemand wechselt." jahr={jahr} onKind={onKind} />
          </Abschnitt>
        )}
        <Abschnitt titel={`Bleiben in ${kurz(s.stufe.name)}`} anzahl={s.bleiben.length}>
          <KindListe kinder={s.bleiben} leer="Niemand bleibt." jahr={jahr} onKind={onKind} />
        </Abschnitt>
      </section>
      {s.vorige &&
        (s.neu ? (
          <section className={styles.karte}>
            <Abschnitt titel="Kommen neu dazu" anzahl={s.neu.length}>
              <NeuListe neu={s.neu} />
            </Abschnitt>
          </section>
        ) : (
          <p className={styles.leise}>
            {bereich || phase !== 'ruhig'
              ? `Wer aus ${s.vorige.name} neu dazukommt, ist gerade nicht lesbar.`
              : `Kinder, die aus ${s.vorige.name} neu zu euch kommen, siehst du ab der Ankündigung am ${tagPunkt(jahr.ankuendigung)}.`}
          </p>
        ))}
    </>
  );
}

function Uebersicht({
  sichten,
  jahr,
  phase,
  onStufe,
}: {
  sichten: readonly GruppenSicht[];
  jahr: Wechseljahr;
  phase: Phase;
  onStufe: (id: number) => void;
}) {
  const alle = sichten.reduce((n, s) => n + s.kinder.length, 0);
  const wechseln = sichten.reduce(
    (n, s) => n + s.wechseln.filter((k) => k.wechsel.art === 'wechselt').length,
    0,
  );
  const pflege = pflegeAus(sichten);
  return (
    <>
      <div className={styles.kopf}>
        <h2>Übersicht</h2>
        <span className={styles.leise}>
          {alle} Kinder und Jugendliche · {wechseln} wechseln · {pflege.ohneGeburtstag.length} ohne
          Geburtstag
        </span>
      </div>
      <Jahresband jahr={jahr} phase={phase} />
      <div className={styles.kacheln}>
        {sichten.map((s) => {
          const w = s.wechseln.filter((k) => k.wechsel.art === 'wechselt').length;
          const a = s.wechseln.filter((k) => k.wechsel.art === 'ausnahme').length;
          const o = s.kinder.filter((k) => k.wechsel.art === 'ohneGeburtstag').length;
          const e = s.kinder.filter((k) => k.wird18).length;
          return (
            <button
              key={s.stufe.gruppeId}
              type="button"
              className={styles.kachel}
              onClick={() => onStufe(s.stufe.gruppeId)}
            >
              <h3>{s.stufe.name}</h3>
              <span className={styles.zahl}>
                {s.stand === 'sichtbar' ? s.kinder.length : '–'}
                <small>Kinder</small>
              </span>
              <span className={styles.chips}>
                {w > 0 && <span className={`${styles.chip} ${styles.blau}`}>{w} wechseln</span>}
                {a > 0 && <span className={`${styles.chip} ${styles.grau}`}>{a} bleiben</span>}
                {o > 0 && (
                  <span className={`${styles.chip} ${styles.rot}`}>{o} ohne Geburtstag</span>
                )}
                {e > 0 && <span className={`${styles.chip} ${styles.blau}`}>{e} wird 18</span>}
                {s.stand !== 'sichtbar' && (
                  <span className={`${styles.chip} ${styles.grau}`}>nicht lesbar</span>
                )}
              </span>
              {s.leitung.length > 0 && (
                <span className={styles.leise}>Leitung: {s.leitung.join(', ')}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function DatenPflegen({
  sichten,
  bereich,
  jahr,
  onKind,
}: {
  sichten: readonly GruppenSicht[];
  bereich: boolean;
  jahr: Wechseljahr;
  onKind: (x: { kind: KindZeile; stufe: GruppenSicht }) => void;
}) {
  const p = pflegeAus(sichten);
  const oeffnen = (k: KindZeile & { stufe: Stufe }) => {
    const stufe = sichten.find((s) => s.stufe.gruppeId === k.stufe.gruppeId);
    if (stufe) onKind({ kind: k, stufe });
  };
  return (
    <>
      <div className={styles.kopf}>
        <h2>Daten pflegen</h2>
        <span className={styles.leise}>
          {bereich ? 'alle Gruppen' : sichten.map((s) => s.stufe.name).join(', ')}
        </span>
      </div>
      <section className={styles.karte}>
        <Abschnitt titel="Geburtstag fehlt" anzahl={p.ohneGeburtstag.length}>
          <p className={styles.erklaerung}>
            Ohne Geburtstag fällt ein Kind durch jede Altersregel und wechselt nie von selbst.
          </p>
          <KindListe
            kinder={p.ohneGeburtstag}
            leer="Alles erledigt."
            jahr={jahr}
            onKind={oeffnen}
          />
        </Abschnitt>
      </section>
      {bereich && (
        <section className={styles.karte}>
          <Abschnitt titel="Wird bis zum Stichtag 18" anzahl={p.wird18.length}>
            <p className={styles.erklaerung}>
              Mitglieder bleiben in der Gemeindeliste, alle anderen kommen zu „Externe Kontakte“.
            </p>
            <KindListe kinder={p.wird18} leer="Niemand." jahr={jahr} onKind={oeffnen} />
          </Abschnitt>
        </section>
      )}
    </>
  );
}

// ── Fenster: ein Kind (nur lesen) ──────────────────────────────────────────────────────────────────────────────

function KindFenster({
  kind,
  sicht,
  jahr,
  onSchliessen,
}: {
  kind: KindZeile;
  sicht: GruppenSicht;
  jahr: Wechseljahr;
  onSchliessen: () => void;
}) {
  const w = kind.wechsel;
  const wechsel =
    w.art === 'wechselt'
      ? `${wechseltagText(jahr.wechseltag)} → ${w.nach.name}`
      : w.art === 'ausnahme'
        ? 'bleibt noch ein Jahr (Ausnahme)'
        : w.art === 'bleibt'
          ? 'nein'
          : 'unbekannt';
  return (
    <Sheet title={kind.name} onClose={onSchliessen} knoepfe={null}>
      <dl className={styles.daten}>
        <dt>Gruppe</dt>
        <dd>{sicht.stufe.name}</dd>
        <dt>Geburtstag</dt>
        <dd>
          {w.art === 'unbekannt'
            ? 'nicht lesbar'
            : kind.geburtstag
              ? tagPunkt(kind.geburtstag)
              : 'fehlt'}
        </dd>
        <dt>Alter am {tagPunkt(jahr.stichtag)}</dt>
        <dd>{kind.alter === null ? 'unbekannt' : `${kind.alter} Jahre`}</dd>
        <dt>Wechsel</dt>
        <dd>{wechsel}</dd>
      </dl>
      {w.art === 'ohneGeburtstag' && (
        <Hinweis>
          Ohne Geburtstag wechselt das Kind nie von selbst. Bitte in ChurchTools nachtragen.
        </Hinweis>
      )}
      {w.art === 'ausnahme' && (
        <Hinweis>
          Die Ausnahme bleibt, bis jemand sie aufhebt – auch über den Wechseltag hinaus.
        </Hinweis>
      )}
      {w.art === 'wechselt' && (
        <Hinweis>
          {kurz(kind.name)} wechselt am {wechseltagText(jahr.wechseltag)} von selbst.
        </Hinweis>
      )}
      <a
        className={styles.oeffnen}
        href={`${ctBasis()}/?q=churchdb#PersonView/searchEntry:%23${kind.personId}/`}
        target="_top"
      >
        In ChurchTools öffnen
      </a>
    </Sheet>
  );
}
