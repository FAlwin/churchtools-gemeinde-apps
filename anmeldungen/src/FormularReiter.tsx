import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { FeldEingabe, FeldRahmen } from '@ui/anmeldeformular/AnmeldeFormular';
import {
  BAUSTEINE,
  ctAblage,
  platzBelegt,
  type Feld,
  type Feldtyp,
  type Feldzustand,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import {
  antwortenZaehlen,
  ctFelderLesen,
  feldEntfernen,
  feldSpeichern,
  neueFeldKennung,
  reihenfolgeSpeichern,
  type Bereich,
} from './formularFelder';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import f from './Formular.module.scss';
import b from './FormularReiter.module.scss';

/**
 * **Reiter „Formular“** (A5) – der Baukasten aus dem Entwurf vom 09.10.2026: Bausteine links, das Formular rechts
 * so, wie es aussieht (`FeldEingabe` – dieselbe Darstellung wie für Gäste). Jedes Feld hat sein Fenster; jedes
 * Feld wird in ChurchTools eine Spalte (`formularFelder.ts`). Name, E-Mail und Datenschutz sind immer dabei,
 * der Bereich „Auswahl und Extras“ kommt aus den Preisen.
 */

const TYPNAME: Partial<Record<Feldtyp, string>> = Object.fromEntries(
  BAUSTEINE.map((x) => [x.typ, x.name]),
);

/** Was ein neuer Baustein mitbringt. */
function neuesFeld(typ: Feldtyp, id: string): Feld {
  const frage: Partial<Record<Feldtyp, string>> = {
    text: 'Neue Frage',
    textarea: 'Neue Frage',
    janein: 'Neue Ja/Nein-Frage',
    check: 'Ich bin einverstanden, dass …',
    radio: 'Neue Auswahl',
    select: 'Neue Auswahl',
    multi: 'Neue Mehrfachauswahl',
    date: 'Datum',
    number: 'Anzahl',
    info: 'Hinweis',
  };
  return {
    id,
    art: 'eigen',
    typ,
    frage: frage[typ] ?? 'Neue Frage',
    hilfe: '',
    zustand: 'freiwillig',
    antworten:
      typ === 'radio' || typ === 'select' || typ === 'multi' ? ['Antwort 1', 'Antwort 2'] : [],
  };
}

const ZUSTAND_TEXT: Record<Feldzustand, string> = {
  aus: 'aus',
  freiwillig: 'freiwillig',
  pflicht: 'Pflicht',
};

/** Feste Felder (Name, E-Mail, Datenschutz) und der Preisbereich lassen sich nicht verschieben. */
const fest = (x: Feld) => x.art === 'fest' || x.typ === 'price';

function Platz({ anteil }: { anteil: number }) {
  const prozent = Math.min(100, Math.round(anteil * 100));
  return (
    <div className={b.platz}>
      <div className={b.platzZeile}>
        <span>Platz in ChurchTools</span>
        <b>{prozent} % belegt</b>
      </div>
      <div className={`${b.platzBalken} ${prozent >= 85 ? b.knapp : ''}`}>
        <i style={{ width: `${prozent}%` }} />
      </div>
      {prozent >= 85 && (
        <small>Es wird knapp – lange Hilfetexte oder der Begrüßungstext kürzen hilft.</small>
      )}
    </div>
  );
}

function Baustein({
  feld,
  gestaltung,
  darf,
  hoch,
  runter,
  onOeffnen,
  onHoch,
  onRunter,
  preisInfo,
}: {
  feld: Feld;
  gestaltung: OeffentlicheEinstellungen['gestaltung'];
  darf: boolean;
  hoch: boolean;
  runter: boolean;
  onOeffnen: () => void;
  onHoch: () => void;
  onRunter: () => void;
  preisInfo: string;
}) {
  const art =
    feld.typ === 'price'
      ? 'aus den Preisen'
      : feld.art === 'eigen'
        ? (TYPNAME[feld.typ] ?? 'Feld')
        : feld.art === 'fest'
          ? 'immer dabei'
          : 'vorgegeben';
  // Name, E-Mail und Datenschutz sind fest – nichts einzustellen; die Preise stellt der Reiter „Veranstaltung“ ein.
  const kannOeffnen = darf && feld.typ !== 'price' && feld.art !== 'fest';
  return (
    <li className={`${b.feld} ${feld.zustand === 'aus' ? b.aus : ''}`}>
      <div className={b.leiste}>
        <span className={`${b.zustand} ${b[feld.zustand]}`}>
          {feld.typ === 'price'
            ? 'Preise'
            : feld.art === 'fest'
              ? 'immer'
              : ZUSTAND_TEXT[feld.zustand]}
        </span>
        <span className={b.art}>{art}</span>
        <span className={b.platzhalter} />
        {darf && !fest(feld) && (
          <>
            <button
              type="button"
              className={b.pfeil}
              disabled={!hoch}
              aria-label={`${feld.frage} nach oben`}
              onClick={onHoch}
            >
              <Icon name="chev-down" size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button"
              className={b.pfeil}
              disabled={!runter}
              aria-label={`${feld.frage} nach unten`}
              onClick={onRunter}
            >
              <Icon name="chev-down" size={16} />
            </button>
          </>
        )}
        {kannOeffnen && (
          <button type="button" className={v.bearbeiten} onClick={onOeffnen}>
            Bearbeiten
          </button>
        )}
      </div>
      <div className={b.koerper}>
        {feld.typ === 'price' ? (
          <p className={f.hinweis}>{preisInfo}</p>
        ) : feld.zustand === 'aus' ? (
          <p className={f.hinweis}>{feld.frage} · ausgeblendet</p>
        ) : (
          <FeldRahmen gestaltung={gestaltung}>
            <FeldEingabe
              feld={feld}
              pfad={`bk-${feld.id}`}
              wert={undefined}
              onWert={() => {}}
              gesperrt
            />
          </FeldRahmen>
        )}
      </div>
    </li>
  );
}

interface AntwortEntwurf {
  text: string;
  altId?: string;
}

function FeldFenster({
  id,
  bereich,
  feld,
  ctId,
  neu,
  hatAltersPreise,
  gestaltung,
  onClose,
  onGespeichert,
}: {
  id: number;
  bereich: Bereich;
  feld: Feld;
  /** Die Spalte in ChurchTools (`ctFelder`), falls es sie schon gibt. */
  ctId: number | undefined;
  neu: boolean;
  hatAltersPreise: boolean;
  gestaltung: OeffentlicheEinstellungen['gestaltung'];
  onClose: () => void;
  onGespeichert: (text: string) => void;
}) {
  const [d, setD] = useState(feld);
  const [antworten, setAntworten] = useState<AntwortEntwurf[]>(
    feld.antworten.map((t) => ({ text: t })),
  );
  const [ursprung, setUrsprung] = useState<AntwortEntwurf[]>([]);
  const [beantwortet, setBeantwortet] = useState<number | null>(null);
  const [jeAntwort, setJeAntwort] = useState<Map<string, number>>(new Map());
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});
  const mitAntworten = d.typ === 'radio' || d.typ === 'select' || d.typ === 'multi';
  const gruppenfeld = ctAblage(feld).ort === 'gruppenfeld';

  // Vorhandene Spalte: IDs der Antworten (für „umbenennen behält die Wahl“) und wie oft beantwortet.
  useEffect(() => {
    if (neu || !gruppenfeld || ctId === undefined) return;
    let aktuell = true;
    Promise.all([ctFelderLesen(id), antwortenZaehlen(id)]).then(
      ([felder, zahlen]) => {
        if (!aktuell) return;
        const ct = felder.get(ctId);
        const zuId = new Map((ct?.options ?? []).map((o) => [o.name, String(o.id)]));
        const mitIds = feld.antworten.map((t) => ({ text: t, altId: zuId.get(t) }));
        setAntworten(mitIds);
        setUrsprung(mitIds);
        const z = zahlen.get(ctId);
        setBeantwortet(z?.gesamt ?? 0);
        setJeAntwort(z?.jeOption ?? new Map());
      },
      () => aktuell && setBeantwortet(null),
    );
    return () => {
      aktuell = false;
    };
  }, [id, neu, gruppenfeld, feld, ctId]);

  const zustaende: { value: Feldzustand; label: string }[] =
    feld.id === 'birth'
      ? [
          { value: 'aus', label: 'aus' },
          { value: 'pflicht', label: 'Pflicht' },
        ]
      : d.typ === 'info'
        ? [
            { value: 'aus', label: 'aus' },
            { value: 'freiwillig', label: 'anzeigen' },
          ]
        : [
            { value: 'aus', label: 'aus' },
            { value: 'freiwillig', label: 'freiwillig' },
            { value: 'pflicht', label: d.typ === 'check' ? 'muss angekreuzt werden' : 'Pflicht' },
          ];
  const entwurf: Feld = {
    ...d,
    antworten: mitAntworten ? antworten.map((a) => a.text.trim()) : [],
  };
  const leerFrage = d.art === 'eigen' && !d.frage.trim();
  const zuWenig = mitAntworten && antworten.filter((a) => a.text.trim()).length < 2;
  // Entfernte Antworten, die schon jemand gewählt hat: bleiben verborgen stehen (Alwin: „ausblenden“).
  const entferntGewaehlt = ursprung.filter(
    (o) =>
      o.altId && !antworten.some((a) => a.altId === o.altId) && (jeAntwort.get(o.altId) ?? 0) > 0,
  );

  return (
    <Sheet
      title={
        neu
          ? `Neu: ${TYPNAME[d.typ] ?? 'Feld'}`
          : d.art === 'eigen'
            ? (TYPNAME[d.typ] ?? 'Feld')
            : d.frage
      }
      onClose={onClose}
    >
      {beantwortet !== null && beantwortet > 0 && (
        <p className={f.hinweis} role="note">
          {beantwortet === 1 ? 'Eine Anmeldung hat' : `${beantwortet} Anmeldungen haben`} hier schon
          geantwortet. Umbenennen lässt die Antworten stehen.
        </p>
      )}
      <label className={f.feld}>
        <span>
          {d.typ === 'info'
            ? 'Überschrift'
            : d.typ === 'check'
              ? 'Text neben dem Kästchen'
              : 'Frage'}
        </span>
        <input
          className={f.eingabe}
          value={d.frage}
          maxLength={200}
          disabled={d.art !== 'eigen'}
          onChange={(e) => setD({ ...d, frage: e.target.value })}
        />
      </label>
      <label className={f.feld}>
        <span>{d.typ === 'info' ? 'Hinweistext' : 'Hilfetext darunter (freiwillig)'}</span>
        <input
          className={f.eingabe}
          value={d.hilfe}
          maxLength={400}
          onChange={(e) => setD({ ...d, hilfe: e.target.value })}
        />
      </label>
      {mitAntworten && (
        <div className={f.feld}>
          <span>Antworten</span>
          <ul className={f.optionen}>
            {antworten.map((a, i) => (
              <li key={i} className={f.zeile}>
                <input
                  className={f.eingabe}
                  value={a.text}
                  maxLength={80}
                  aria-label={`Antwort ${i + 1}`}
                  onChange={(e) =>
                    setAntworten(
                      antworten.map((x, j) => (i === j ? { ...x, text: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className={f.klein}
                  aria-label={`Antwort ${i + 1} entfernen`}
                  disabled={antworten.length <= 2}
                  onClick={() => setAntworten(antworten.filter((_, j) => j !== i))}
                >
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={v.bearbeiten}
            onClick={() =>
              setAntworten([...antworten, { text: `Antwort ${antworten.length + 1}` }])
            }
          >
            + Antwort
          </button>
          {entferntGewaehlt.length > 0 && (
            <small className={f.hinweis} role="note">
              {entferntGewaehlt.map((o) => `„${o.text}“`).join(', ')}{' '}
              {entferntGewaehlt.length === 1 ? 'hat' : 'haben'} schon jemand gewählt – bleibt in
              ChurchTools stehen und wird im Formular nur ausgeblendet.
            </small>
          )}
        </div>
      )}
      {d.art !== 'fest' && (
        <div className={f.feld}>
          <span>{d.typ === 'check' ? 'Kästchen' : 'Im Formular'}</span>
          <Segment
            ariaLabel="Im Formular"
            value={d.zustand}
            onChange={(z) => setD({ ...d, zustand: z })}
            options={zustaende}
          />
        </div>
      )}
      {feld.id === 'birth' && d.zustand === 'aus' && hatAltersPreise && (
        <p className={f.fehler}>
          Es gibt Preise nach Alter. Ohne Geburtsdatum kann das Formular sie nicht rechnen.
        </p>
      )}
      <div className={f.feld}>
        <span>So sieht es aus</span>
        <div className={b.vorschau}>
          <FeldRahmen gestaltung={gestaltung}>
            <FeldEingabe
              feld={d.zustand === 'aus' ? { ...entwurf, zustand: 'freiwillig' } : entwurf}
              pfad="vorschau"
              wert={undefined}
              onWert={() => {}}
              gesperrt
            />
          </FeldRahmen>
        </div>
      </div>
      {leerFrage && <p className={f.fehler}>Bitte eine Frage eintragen.</p>}
      {zuWenig && <p className={f.fehler}>Bitte mindestens zwei Antworten eintragen.</p>}
      <Fehler text={fehler} />
      <button
        type="button"
        className={f.knopf}
        disabled={leerFrage || zuWenig || arbeitet}
        onClick={() =>
          speichern(
            () =>
              feldSpeichern(
                id,
                bereich,
                { ...entwurf, frage: entwurf.frage.trim() },
                mitAntworten
                  ? antworten.map((a) => ({ text: a.text.trim(), altId: a.altId }))
                  : undefined,
              ),
            () => onGespeichert(`„${entwurf.frage.trim()}“ gespeichert.`),
          )
        }
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
      {!neu && d.art === 'eigen' && (
        <button
          type="button"
          className={f.entfernen}
          disabled={arbeitet}
          onClick={() => {
            let ergebnis = '';
            void speichern(
              async () => {
                const r = await feldEntfernen(id, bereich, feld.id);
                ergebnis =
                  r.art === 'geloescht'
                    ? `„${feld.frage}“ entfernt.`
                    : `„${feld.frage}“ ausgeblendet – ${r.antworten === 1 ? 'die Antwort bleibt' : `die ${r.antworten} Antworten bleiben`} in ChurchTools.`;
              },
              () => onGespeichert(ergebnis),
            );
          }}
        >
          {beantwortet ? 'Ausblenden (Antworten bleiben)' : 'Feld entfernen'}
        </button>
      )}
    </Sheet>
  );
}

export function FormularReiter({
  id,
  einstellungen: e,
  darf,
  onGespeichert,
}: {
  id: number;
  einstellungen: OeffentlicheEinstellungen;
  darf: boolean;
  /** Nach dem Speichern: neu laden und „Rückgängig“ anbieten. */
  onGespeichert: (text: string) => void;
}) {
  const kinder = e.wer === 'kinder';
  const [ziel, setZiel] = useState<Bereich>('person');
  const [offen, setOffen] = useState<{ bereich: Bereich; feld: Feld; neu: boolean } | null>(null);
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});

  const preisInfo =
    e.preis.grundpreis.art === 'auswahl' || e.preis.extras.length
      ? 'Auswahl und Extras erscheinen hier so, wie sie im Reiter „Veranstaltung“ unter „Preise“ stehen.'
      : 'Hier erscheinen Auswahl (z. B. Zimmertyp) und Extras, sobald es sie unter „Preise“ gibt.';

  function verschieben(bereich: Bereich, i: number, um: -1 | 1) {
    const ids = e.formular[bereich].map((x) => x.id);
    [ids[i], ids[i + um]] = [ids[i + um], ids[i]];
    void speichern(
      () => reihenfolgeSpeichern(id, bereich, ids),
      () => onGespeichert('Reihenfolge gespeichert.'),
    );
  }

  const bereichKarte = (bereich: Bereich, titel: string, untertitel: string) => {
    const liste = e.formular[bereich];
    return (
      <section className={s.karte} aria-label={titel}>
        <div className={s.kopf}>
          <h2>{titel}</h2>
          <span className={s.leise}>{untertitel}</span>
        </div>
        <ul className={b.liste}>
          {liste.map((x, i) => (
            <Baustein
              key={x.id}
              feld={x}
              gestaltung={e.gestaltung}
              darf={darf && !arbeitet}
              hoch={i > 0 && !fest(liste[i - 1])}
              runter={i < liste.length - 1 && !fest(liste[i + 1])}
              onOeffnen={() => setOffen({ bereich, feld: x, neu: false })}
              onHoch={() => verschieben(bereich, i, -1)}
              onRunter={() => verschieben(bereich, i, 1)}
              preisInfo={preisInfo}
            />
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className={b.raster}>
      {darf && (
        <div className={`${s.spalte} ${v.klebt}`}>
          <section className={s.karte} aria-label="Bausteine">
            <div className={s.kopf}>
              <h2>Bausteine</h2>
            </div>
            <div className={b.palette}>
              <Platz anteil={platzBelegt(e)} />
              <div className={f.feld}>
                <span>Neues Feld kommt in</span>
                <Segment
                  ariaLabel="Neues Feld kommt in"
                  value={ziel}
                  onChange={setZiel}
                  options={[
                    { value: 'anmeldung', label: kinder ? 'Kontakt' : 'Einmal pro Anmeldung' },
                    { value: 'person', label: kinder ? 'Jedes Kind' : 'Jede Person' },
                  ]}
                />
              </div>
              <div className={b.kacheln}>
                {BAUSTEINE.map((x) => (
                  <button
                    key={x.typ}
                    type="button"
                    className={b.kachel}
                    onClick={() =>
                      setOffen({
                        bereich: ziel,
                        feld: neuesFeld(x.typ, neueFeldKennung(e.formular)),
                        neu: true,
                      })
                    }
                  >
                    {x.name}
                  </button>
                ))}
              </div>
              <p className={f.hinweis}>
                Antippen öffnet das neue Feld. Jedes Feld außer Name und E-Mail wird in ChurchTools
                eine Spalte der Mitgliederliste.
              </p>
              <Fehler text={fehler} />
            </div>
          </section>
        </div>
      )}
      <div className={s.spalte}>
        {!darf && <p className={v.hinweis}>Nur die Leitung der Gruppe kann das Formular ändern.</p>}
        {bereichKarte(
          'anmeldung',
          kinder ? 'Kontakt der Eltern' : 'Einmal pro Anmeldung',
          'Name, E-Mail und Datenschutz sind immer dabei',
        )}
        {bereichKarte(
          'person',
          kinder ? 'Für jedes Kind' : 'Für jede Person',
          `wiederholt sich pro ${kinder ? 'Kind' : 'Person'}`,
        )}
      </div>
      {offen && (
        <FeldFenster
          key={offen.feld.id}
          id={id}
          bereich={offen.bereich}
          feld={offen.feld}
          ctId={e.ctFelder[offen.feld.id]}
          neu={offen.neu}
          hatAltersPreise={e.preis.alter.length > 0}
          gestaltung={e.gestaltung}
          onClose={() => setOffen(null)}
          onGespeichert={(text) => {
            setOffen(null);
            onGespeichert(text);
          }}
        />
      )}
    </div>
  );
}
