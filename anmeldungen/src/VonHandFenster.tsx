import { useMemo, useState, type CSSProperties } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { ApiError } from '@ui/ct/fehler';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import { FeldEingabe } from '@ui/anmeldeformular/AnmeldeFormular';
import pv from '@ui/anmeldeformular/AnmeldeFormular.module.scss';
import {
  geburtsdatumAn,
  mailGueltig,
  pruefeAntworten,
  type Antwort,
  type Antworten,
  type Feld,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import {
  PasstNicht,
  betragAus,
  neueAnmeldeNr,
  unterschriftAufPapier,
} from '@shared/anmeldung/senden';
import { bescheidMail, type Mail } from '@shared/anmeldung/bewegung';
import { euroText, kannEtwasKosten } from '@shared/anmeldung/preis';
import { optionRest } from '@shared/anmeldung/kontingent';
import {
  handFelder,
  handFormular,
  handPlatz,
  handStart,
  mitUnterschrift,
  type HandLage,
  type HandPerson,
} from '@shared/anmeldung/vonHand';
import { tagPunkt } from '@shared/ct/datum';
import {
  GibtEsSchon,
  gleichNamige,
  meinName,
  personenSuchen,
  vonHandAnmelden,
  type Gefunden,
  type NeuePerson,
} from './vonHand';
import { gruppenfelderLaden } from './mitglieder';
import { fehlerMeldung } from './zustand';
import type { Aenderung } from './Rueckgaengig';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import k from './Baukasten.module.scss';

/**
 * **Anmeldung von Hand** (A7-4a, Entwurf `a7-4-von-hand-v1`) – erst in ChurchTools suchen, sonst neu anlegen; dann die
 * Fragen des Formulars, Platz und Betrag. Die Felder sind dieselben wie im Formular (`FeldEingabe`), in den Farben der
 * Erweiterung. Danach öffnet sich die neue Anmeldung mit „Mail schreiben“ und „Rückgängig“.
 */

/** Die Farben der Erweiterung für die Felder des Formulars – `FeldEingabe` liest diese Variablen (hell und dunkel). */
const FARBEN = {
  '--p-accent': 'var(--blue)',
  '--p-accent-text': 'var(--blue-ink)',
  '--p-on-accent': '#fff',
  '--p-page': 'transparent',
  '--p-card': 'var(--surface2)',
  '--p-text': 'var(--text)',
  '--p-muted': 'var(--text2)',
  '--p-line': 'var(--border)',
  '--p-line-strong': 'var(--text3)',
  '--p-field': 'var(--surface2)',
  '--p-fill': 'var(--surface3)',
  '--p-err': 'var(--red)',
  '--p-ok': 'var(--green)',
  '--p-head': 'var(--ui)',
  '--p-body': 'var(--ui)',
  '--p-fs': '15px',
  background: 'transparent',
} as CSSProperties;

type Wahl = { art: 'da'; p: Gefunden } | { art: 'neu'; neu: NeuePerson; trotzdem: boolean };
type Schritt = 'suchen' | 'neu' | 'doppelt' | 'antworten';

const ganz = (p: { vor: string; nach: string }) => `${p.vor} ${p.nach}`.trim();
const nameAus = (w: Antwort) => {
  const n = (w ?? {}) as { vor?: string; nach?: string };
  return `${n.vor ?? ''} ${n.nach ?? ''}`.trim();
};

/** Was nach dem Anmelden im Fenster der neuen Anmeldung steht. */
export interface VonHandFertig {
  nr: string;
  aenderung: Aenderung;
  mail: Mail;
}

export function VonHandFenster({
  id,
  e,
  veranstaltung,
  heute,
  lage,
  anmeldeschluss,
  dabei,
  abgesagt,
  onClose,
  onFertig,
}: {
  id: number;
  e: OeffentlicheEinstellungen;
  veranstaltung: string;
  heute: string;
  lage: HandLage;
  /** Ende des Anmeldezeitraums (ISO) – liegt es zurück, steht ein Hinweis da. */
  anmeldeschluss: string | null;
  /** Wer schon angemeldet ist (auch wartend). */
  dabei: ReadonlySet<number>;
  /** Wer abgesagt hat. */
  abgesagt: ReadonlySet<number>;
  onClose: () => void;
  onFertig: (x: VonHandFertig) => void;
}) {
  const [schritt, setSchritt] = useState<Schritt>('suchen');
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Gefunden[] | null>(null);
  const [neu, setNeu] = useState<NeuePerson>({
    vor: '',
    nach: '',
    geburtstag: null,
    email: null,
    zugestimmt: e.wer === 'kinder' ? 'eltern' : 'selbst',
  });
  const [gleiche, setGleiche] = useState<Gefunden[]>([]);
  const [wahl, setWahl] = useState<Wahl | null>(null);
  const [antworten, setAntworten] = useState<Antworten>({ anmeldung: {}, personen: [{}] });
  const [option, setOption] = useState(() =>
    Math.max(
      0,
      e.preis.grundpreis.optionen.findIndex((o) => optionRest(o) !== 0),
    ),
  );
  const [extras, setExtras] = useState<boolean[]>(e.preis.extras.map(() => false));
  const [papier, setPapier] = useState(false);
  const [trotzdem, setTrotzdem] = useState(false);
  const [fehlerFelder, setFehlerFelder] = useState<string[]>([]);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nr] = useState(neueAnmeldeNr);

  const hf = useMemo(() => handFormular(e.formular), [e.formular]);
  const mitGeburt = geburtsdatumAn(e.formular);
  const platz = handPlatz(lage, trotzdem);
  const mitPlatz = platz.status === 'active';
  const betrag = betragAus(e, antworten, { option, extras }, heute, [mitPlatz]);
  const kostet = kannEtwasKosten(e.preis);
  const schlussVorbei = !!anmeldeschluss && Date.parse(anmeldeschluss) < Date.now();
  const sichtbar = (x: Feld) => x.zustand !== 'aus';

  /** Ein Schritt, der etwas bei ChurchTools nachfragt – mit „Einen Moment …“ und der Meldung bei einem Fehler. */
  async function laufen(tun: () => Promise<void>) {
    setArbeitet(true);
    setFehler(null);
    try {
      await tun();
    } catch (x) {
      setFehler(fehlerMeldung(x).text);
    } finally {
      setArbeitet(false);
    }
  }

  const waehlen = (w: Wahl) => {
    const p: HandPerson =
      w.art === 'da'
        ? w.p
        : { vor: w.neu.vor, nach: w.neu.nach, geburtstag: w.neu.geburtstag, email: w.neu.email };
    setWahl(w);
    setAntworten(handStart(e, p));
    setFehlerFelder([]);
    setFehler(null);
    setSchritt('antworten');
  };

  const suchen = () =>
    laufen(async () => {
      setTreffer(await personenSuchen(suche));
    });

  const neuWeiter = () => {
    if (!neu.vor.trim() || !neu.nach.trim()) return setFehler('Bitte Vor- und Nachname eintragen.');
    if (mitGeburt && !neu.geburtstag) return setFehler('Bitte das Geburtsdatum eintragen.');
    if (neu.email?.trim() && !mailGueltig(neu.email))
      return setFehler('Die E-Mail-Adresse sieht nicht richtig aus.');
    void laufen(async () => {
      const da = await gleichNamige(neu.vor, neu.nach);
      if (da.length) {
        setGleiche(da);
        setSchritt('doppelt');
      } else waehlen({ art: 'neu', neu, trotzdem: false });
    });
  };

  const setAnmeldung = (fid: string, w: Antwort) =>
    setAntworten((x) => ({ ...x, anmeldung: { ...x.anmeldung, [fid]: w } }));
  const setPerson = (fid: string, w: Antwort) =>
    setAntworten((x) => ({ ...x, personen: [{ ...x.personen[0], [fid]: w }] }));

  const anmelden = () => {
    if (!wahl) return;
    const offen = pruefeAntworten(hf, antworten);
    setFehlerFelder(offen);
    if (offen.length) return setFehler('Bitte die markierten Felder ausfüllen.');
    void laufen(async () => {
      try {
        const felder = await gruppenfelderLaden(id);
        const vermerk = papier ? unterschriftAufPapier(await meinName(), heute) : null;
        const werte = handFelder(e, antworten, { option, extras }, heute, felder, {
          nr,
          mitPlatz,
          papier: vermerk,
        });
        const birth = antworten.personen[0].birth;
        const r = await vonHandAnmelden(
          id,
          {
            person:
              wahl.art === 'neu'
                ? wahl
                : {
                    art: 'da',
                    personId: wahl.p.personId,
                    geburtstagNachtragen:
                      mitGeburt && !wahl.p.geburtstag && typeof birth === 'string' && birth
                        ? birth
                        : null,
                  },
            felder: werte,
            nrFeld: e.ctFelder.nr,
            platz,
          },
          heute,
        );
        const person = wahl.art === 'da' ? wahl.p : wahl.neu;
        const kontakt = e.formular.anmeldung.find((x) => x.typ === 'name');
        const mailFeld = e.formular.anmeldung.find((x) => x.typ === 'email');
        const an = mailFeld ? antworten.anmeldung[mailFeld.id] : undefined;
        const name = ganz(person);
        onFertig({
          nr,
          aenderung: {
            text: `${name} ist angemeldet – ${
              r.warteplatz === null ? 'hat einen Platz' : `Warteliste ${r.warteplatz}`
            }.${wahl.art === 'neu' ? ' Neu in ChurchTools angelegt; „Rückgängig“ nimmt die Person nur aus der Anmeldung.' : ''}`,
            rueckgaengig: r.rueckgaengig,
          },
          mail: bescheidMail(e, {
            art: 'angemeldet',
            veranstaltung,
            x: {
              email: typeof an === 'string' && an.trim() ? an.trim() : null,
              wer: (kontakt && nameAus(antworten.anmeldung[kontakt.id])) || name,
              nr,
            },
            person,
            betragCent: betrag.gesamtCent,
            rueckzahlungCent: 0,
            heute,
            warteplatz: r.warteplatz,
          }),
        });
      } catch (x) {
        if (x instanceof GibtEsSchon) {
          // Jemand gleichen Namens ist inzwischen da – oder für mich nicht sichtbar.
          setGleiche(await gleichNamige(neu.vor, neu.nach).catch(() => []));
          setSchritt('doppelt');
          return;
        }
        if (x instanceof PasstNicht)
          throw new ApiError(
            422,
            `Die Veranstaltung passt nicht zum Formular: ${x.was}. Bitte im Reiter „Formular“ prüfen.`,
          );
        throw x;
      }
    });
  };

  const fehlerZeile = fehler && (
    <p className={f.fehler} role="alert">
      {fehler}
    </p>
  );

  // ── 1 Suchen ──
  if (schritt === 'suchen')
    return (
      <Sheet title="Anmeldung von Hand" onClose={onClose}>
        <p className={a.unterTitel}>Wen meldest du an? Erst in ChurchTools suchen.</p>
        <form
          className={f.zeile}
          onSubmit={(ev) => {
            ev.preventDefault();
            void suchen();
          }}
        >
          <input
            type="search"
            className={f.eingabe}
            aria-label="Name"
            placeholder="Name"
            autoFocus
            value={suche}
            onChange={(ev) => setSuche(ev.target.value)}
          />
          <button
            type="submit"
            className={f.knopf}
            disabled={arbeitet || suche.trim().length < 2}
            style={{ flex: 'none' }}
          >
            {arbeitet ? 'Sucht …' : 'Suchen'}
          </button>
        </form>
        {fehlerZeile}
        {treffer && (
          <ul className={f.optionen} aria-label="Gefunden">
            {treffer.length === 0 && <li className={a.leise}>Niemand gefunden.</li>}
            {treffer.map((p) => {
              const ist = dabei.has(p.personId);
              return (
                <li key={p.personId}>
                  <button
                    type="button"
                    className={f.aktion}
                    disabled={ist}
                    onClick={() => waehlen({ art: 'da', p })}
                  >
                    <span>
                      <b>{ganz(p)}</b>
                      <small>
                        {[p.geburtstag && `geb. ${tagPunkt(p.geburtstag)}`, p.email]
                          .filter(Boolean)
                          .join(' · ') || 'ohne Geburtsdatum und E-Mail'}
                      </small>
                    </span>
                    {ist ? (
                      <span className={`${a.pille} ${a.pilleOk}`}>schon dabei</span>
                    ) : (
                      abgesagt.has(p.personId) && (
                        <span className={`${a.pille} ${a.pilleWarte}`}>hat abgesagt</span>
                      )
                    )}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className={f.aktion}
                onClick={() => {
                  const [vor = '', ...rest] = suche.trim().split(/\s+/);
                  setNeu((x) => ({ ...x, vor, nach: rest.join(' ') }));
                  setFehler(null);
                  setSchritt('neu');
                }}
              >
                <span>
                  <b>＋ Nicht dabei – neue Person anlegen</b>
                </span>
              </button>
            </li>
          </ul>
        )}
      </Sheet>
    );

  // ── 1c Neu anlegen ──
  if (schritt === 'neu')
    return (
      <Sheet title="Neue Person anlegen" onClose={onClose}>
        <p className={a.unterTitel}>Anmeldung von Hand · wird in ChurchTools angelegt</p>
        <div className={f.zeile}>
          <label className={f.feld}>
            <span>Vorname</span>
            <input
              className={f.eingabe}
              value={neu.vor}
              autoFocus
              onChange={(ev) => setNeu({ ...neu, vor: ev.target.value })}
            />
          </label>
          <label className={f.feld}>
            <span>Nachname</span>
            <input
              className={f.eingabe}
              value={neu.nach}
              onChange={(ev) => setNeu({ ...neu, nach: ev.target.value })}
            />
          </label>
        </div>
        <div className={f.zeile}>
          <label className={f.feld}>
            <span>Geburtsdatum{mitGeburt ? '' : ' (freiwillig)'}</span>
            <input
              type="date"
              className={f.eingabe}
              value={neu.geburtstag ?? ''}
              onChange={(ev) => setNeu({ ...neu, geburtstag: ev.target.value || null })}
            />
          </label>
          <label className={f.feld}>
            <span>E-Mail (freiwillig)</span>
            <input
              type="email"
              className={f.eingabe}
              value={neu.email ?? ''}
              onChange={(ev) => setNeu({ ...neu, email: ev.target.value || null })}
            />
          </label>
        </div>
        <div className={f.feld}>
          <span>Dem Datenschutz zugestimmt hat</span>
          <Segment
            value={neu.zugestimmt}
            options={[
              { value: 'selbst', label: 'die Person selbst' },
              { value: 'eltern', label: 'ein Elternteil' },
            ]}
            onChange={(zugestimmt) => setNeu({ ...neu, zugestimmt })}
            ariaLabel="Dem Datenschutz zugestimmt hat"
          />
          <small className={a.leise}>
            Wird in ChurchTools mit dem heutigen Tag vermerkt („außerhalb von ChurchTools“).
          </small>
        </div>
        {fehlerZeile}
        <div className={a.knoepfe}>
          <button
            type="button"
            className={a.linkKnopf}
            disabled={arbeitet}
            onClick={() => setSchritt('suchen')}
          >
            Zurück
          </button>
          <button type="button" className={f.knopf} disabled={arbeitet} onClick={neuWeiter}>
            {arbeitet ? 'Einen Moment …' : 'Weiter'}
          </button>
        </div>
      </Sheet>
    );

  // ── 1b Gibt es schon ──
  if (schritt === 'doppelt')
    return (
      <Sheet title="Neue Person anlegen" onClose={onClose}>
        <p className={a.hinweisBlau}>
          <b>In ChurchTools gibt es schon {ganz(neu)}.</b> Ist es dieselbe Person? Dann bitte sie
          nehmen – sonst entsteht ein Doppel.
          {gleiche.length === 0 &&
            ' (ChurchTools kennt den Namen, du kannst die Person aber nicht sehen.)'}
        </p>
        <ul className={f.optionen}>
          {gleiche.map((p) => (
            <li key={p.personId}>
              <button
                type="button"
                className={f.aktion}
                disabled={dabei.has(p.personId)}
                onClick={() => waehlen({ art: 'da', p })}
              >
                <span>
                  <b>{ganz(p)}</b>
                  <small>
                    {[p.geburtstag && `geb. ${tagPunkt(p.geburtstag)}`, p.email]
                      .filter(Boolean)
                      .join(' · ') || 'ohne Geburtsdatum und E-Mail'}
                  </small>
                </span>
                {dabei.has(p.personId) ? (
                  <span className={`${a.pille} ${a.pilleOk}`}>schon dabei</span>
                ) : (
                  <span className={a.nachKnopf}>Diese nehmen</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className={a.knoepfe}>
          <button type="button" className={a.linkKnopf} onClick={() => setSchritt('neu')}>
            Zurück
          </button>
          <button
            type="button"
            className={f.knopf}
            onClick={() => waehlen({ art: 'neu', neu, trotzdem: true })}
          >
            Trotzdem neu anlegen
          </button>
        </div>
      </Sheet>
    );

  // ── 2 Antworten + Platz ──
  const person = wahl?.art === 'da' ? wahl.p : wahl?.neu;
  const vor = person?.vor ?? '';
  const gesperrt = (x: Feld) =>
    x.typ === 'name' || (x.id === 'birth' && (wahl?.art === 'neu' || !!person?.geburtstag));
  const g = e.preis.grundpreis;
  return (
    <Sheet title={`${person ? ganz(person) : ''} anmelden`} onClose={onClose}>
      <p className={a.unterTitel}>
        {wahl?.art === 'neu' ? 'Neue Person · ' : ''}Anmelde-Nr. {nr}
      </p>
      {schlussVorbei && (
        <p className={a.hinweisBlau}>
          Der Anmeldeschluss war am {tagPunkt(anmeldeschluss)} – von Hand geht es trotzdem.
        </p>
      )}
      <div className={`${pv.pv} ${pv['fs-kasten']}`} style={FARBEN}>
        <section className={a.teil}>
          <h3>Für die Anmeldung</h3>
          {hf.anmeldung.filter(sichtbar).map((x) => (
            <FeldEingabe
              key={x.id}
              feld={x}
              pfad={`anmeldung.${x.id}`}
              wert={antworten.anmeldung[x.id]}
              onWert={(w) => setAnmeldung(x.id, w)}
              fehler={fehlerFelder}
            />
          ))}
          {mitUnterschrift(e.formular) && (
            <>
              <button
                type="button"
                className={k.schalterZeile}
                aria-pressed={papier}
                onClick={() => setPapier(!papier)}
              >
                <Schalter an={papier} />
                Unterschrift liegt auf Papier vor
              </button>
              <p className={a.leise}>
                Unterschreiben kann hier nur die Familie selbst. Bei Papier steht in ChurchTools
                „auf Papier – vermerkt von …“ mit deinem Namen und dem heutigen Tag.
              </p>
            </>
          )}
        </section>

        <section className={a.teil}>
          <h3>{person ? ganz(person) : 'Person'}</h3>
          {hf.person.filter(sichtbar).map((x) => (
            <FeldEingabe
              key={x.id}
              feld={x}
              pfad={`personen.0.${x.id}`}
              wert={antworten.personen[0][x.id]}
              onWert={(w) => setPerson(x.id, w)}
              fehler={fehlerFelder}
              gesperrt={gesperrt(x)}
            />
          ))}
        </section>

        {kostet && (g.art === 'auswahl' || e.preis.extras.length > 0) && (
          <section className={a.teil}>
            <h3>Auswahl</h3>
            {g.art === 'auswahl' && (
              <div className={pv.choices} role="radiogroup" aria-label={g.auswahlName}>
                {g.optionen.map((o, i) => (
                  <label key={o.name} className={pv.choice}>
                    <input type="radio" checked={option === i} onChange={() => setOption(i)} />
                    <span>
                      {o.name} – {euroText(o.preisCent)}
                      {optionRest(o) === 0 ? ' (ausgebucht)' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {e.preis.extras.length > 0 && (
              <div className={pv.choices}>
                {e.preis.extras.map((x, i) => (
                  <label key={x.bezeichnung} className={pv.choice}>
                    <input
                      type="checkbox"
                      checked={extras[i] ?? false}
                      onChange={(ev) =>
                        setExtras(extras.map((c, j) => (i === j ? ev.target.checked : c)))
                      }
                    />
                    <span>
                      {x.bezeichnung} – {euroText(x.preisCent)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <section className={a.teil}>
        <h3>Platz und Betrag</h3>
        <p className={a.summe}>
          <span>Plätze</span>
          <span>
            {lage.max === null ? lage.belegt : `${lage.belegt} von ${lage.max}`}
            {lage.wartende > 0 &&
              ` · ${lage.wartende} ${lage.wartende === 1 ? 'wartet' : 'warten'}`}
          </span>
        </p>
        <p className={a.summe}>
          <span>{vor} kommt auf</span>
          {mitPlatz ? (
            <span className={`${a.pille} ${a.pilleOk}`}>
              einen Platz{platz.neuesMax !== null ? ` (Plätze → ${platz.neuesMax})` : ''}
            </span>
          ) : (
            <span className={`${a.pille} ${a.pilleWarte}`}>Warteliste {platz.warteplatz}</span>
          )}
        </p>
        {platz.wuerdeWarten && !platz.nurMitPlatz && (
          <button
            type="button"
            className={k.schalterZeile}
            aria-pressed={trotzdem}
            onClick={() => setTrotzdem(!trotzdem)}
          >
            <Schalter an={trotzdem} />
            Trotzdem einen Platz geben
            {lage.max !== null && lage.belegt >= lage.max
              ? ` (Plätze auf ${lage.belegt + 1} erhöhen)`
              : ''}
          </button>
        )}
        {platz.nurMitPlatz && (
          <p className={a.leise}>
            Kein Platz frei und keine Warteliste – {vor} bekommt einen Platz
            {platz.neuesMax !== null ? `, die Plätze werden auf ${platz.neuesMax} erhöht` : ''}.
          </p>
        )}
        {kostet && (
          <p className={a.summe}>
            <span>Betrag</span>
            <b>{mitPlatz ? euroText(betrag.gesamtCent) : '0,00 € – folgt beim Nachrücken'}</b>
          </p>
        )}
        <p className={a.leise}>
          Wie im Formular: Wer wartet, zahlt erst beim Nachrücken. ChurchTools schickt beim Anmelden
          von Hand keine Mail – danach gibt es „Mail schreiben“.
        </p>
      </section>

      {fehlerZeile}
      <div className={a.knoepfe}>
        <button
          type="button"
          className={a.linkKnopf}
          disabled={arbeitet}
          onClick={() => setSchritt(wahl?.art === 'neu' ? 'neu' : 'suchen')}
        >
          Zurück
        </button>
        <button type="button" className={f.knopf} disabled={arbeitet} onClick={anmelden}>
          {arbeitet ? 'Einen Moment …' : 'Anmelden'}
        </button>
      </div>
    </Sheet>
  );
}
