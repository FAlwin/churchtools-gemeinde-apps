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
import { bescheidMail, dazuPlan, type Mail } from '@shared/anmeldung/bewegung';
import type { ListenAnmeldung } from '@shared/anmeldung/liste';
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
import { PlatzWahl } from './PlatzWahl';
import { fehlerMeldung } from './zustand';
import type { Aenderung } from './Rueckgaengig';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import k from './Baukasten.module.scss';
import { mailHinweis } from './anzeige';

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
  hinweis?: string;
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
  dazu = null,
  onZurueckholen,
  onClose,
  onFertig,
  mitBestaetigung = false,
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
  /**
   * **Person dazu** (A7-4b): zu dieser Anmeldung (gleiche Anmelde-Nr.) – nur die Fragen der Person, eine eigene
   * Zahlung; Kontakt, Unterschrift und Auswahl stehen schon bei der Anmeldung.
   */
  dazu?: ListenAnmeldung | null;
  /** Wer abgesagt hat, wird zurückgeholt (A7-4c) – mit den Antworten von damals statt einer neuen Anmeldung. */
  onZurueckholen?: (personId: number) => void;
  onClose: () => void;
  onFertig: (x: VonHandFertig) => void;
  /** Bestätigungsmails eingerichtet (A9-1). */
  mitBestaetigung?: boolean;
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
  const [nr] = useState(() => dazu?.nr ?? neueAnmeldeNr());

  const hf = useMemo(() => handFormular(e.formular), [e.formular]);
  const mitGeburt = geburtsdatumAn(e.formular);
  const platz = handPlatz(lage, trotzdem);
  const mitPlatz = platz.status === 'active';
  const betrag = betragAus(e, antworten, { option, extras }, heute, [mitPlatz]);
  // Person dazu: nur ihre Fragen werden geprüft – und sie bekommt eine eigene Zahlung (wie beim Nachrücken).
  const pruefFormular = dazu ? { anmeldung: [], person: hf.person } : hf;
  const birthAntwort = antworten.personen[0].birth;
  const dz =
    dazu && wahl
      ? dazuPlan(
          e,
          dazu,
          {
            vor: wahl.art === 'da' ? wahl.p.vor : wahl.neu.vor,
            geburtstag: typeof birthAntwort === 'string' && birthAntwort ? birthAntwort : null,
          },
          mitPlatz,
          heute,
        )
      : null;
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

  /** Eine gefundene Person nehmen – wer abgesagt hat, wird zurückgeholt (A7-4c), mit den Antworten von damals. */
  const nehmen = (p: Gefunden) =>
    abgesagt.has(p.personId) && onZurueckholen
      ? onZurueckholen(p.personId)
      : waehlen({ art: 'da', p });

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
    const offen = pruefeAntworten(pruefFormular, antworten);
    setFehlerFelder(offen);
    if (offen.length) return setFehler('Bitte die markierten Felder ausfüllen.');
    void laufen(async () => {
      try {
        const felder = await gruppenfelderLaden(id);
        const vermerk = papier && !dazu ? unterschriftAufPapier(await meinName(), heute) : null;
        const werte = handFelder(e, antworten, { option, extras }, heute, felder, {
          nr,
          mitPlatz,
          papier: vermerk,
          nurPerson: !!dazu,
        });
        const cf = e.ctFelder;
        if (dz?.zahlung && cf.betrag !== undefined && cf.aufschluesselung !== undefined) {
          werte[cf.betrag] = euroText(dz.zahlung.betragCent);
          werte[cf.aufschluesselung] = dz.zahlung.aufschluesselung;
        }
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
            }.`,
            rueckgaengig: r.rueckgaengig,
          },
          // Der lange Satz stand zuerst in der Zeile mit „Rückgängig“ und drückte die Knöpfe zusammen (22.10.2026).
          ...(wahl.art === 'neu'
            ? {
                hinweis: `${name} wurde in ChurchTools neu angelegt. „Rückgängig“ nimmt die Anmeldung zurück – die Person bleibt in ChurchTools.`,
              }
            : {}),
          mail: bescheidMail(e, {
            art: 'angemeldet',
            veranstaltung,
            x: dazu
              ? { email: dazu.email, wer: dazu.wer, nr }
              : {
                  email: typeof an === 'string' && an.trim() ? an.trim() : null,
                  wer: (kontakt && nameAus(antworten.anmeldung[kontakt.id])) || name,
                  nr,
                },
            person,
            betragCent: dazu ? (dz?.zahlung?.betragCent ?? 0) : betrag.gesamtCent,
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
      <Sheet title={dazu ? 'Person zur Anmeldung dazu' : 'Anmeldung von Hand'} onClose={onClose}>
        <p className={a.unterTitel}>
          {dazu ? `Anmeldung von ${dazu.wer} · Nr. ${nr}. ` : ''}Wen meldest du an? Erst in
          ChurchTools suchen.
        </p>
        <form
          className={a.handSuche}
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
          <button type="submit" className={f.knopf} disabled={arbeitet || suche.trim().length < 2}>
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
                    onClick={() => nehmen(p)}
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
                      <em className={`${a.pille} ${a.pilleOk} ${a.trefferMarke}`}>schon dabei</em>
                    ) : (
                      abgesagt.has(p.personId) && (
                        <em className={`${a.pille} ${a.pilleWarte} ${a.trefferMarke}`}>
                          {onZurueckholen ? 'hat abgesagt – zurückholen' : 'hat abgesagt'}
                        </em>
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
                onClick={() => nehmen(p)}
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
                  <em className={`${a.pille} ${a.pilleOk} ${a.trefferMarke}`}>schon dabei</em>
                ) : (
                  <em className={`${a.nachKnopf} ${a.trefferMarke}`}>Diese nehmen</em>
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
            // Der sichere Weg ist „Diese nehmen“ – „trotzdem“ legt ein Doppel an, deshalb nicht hervorgehoben.
            className={a.linkKnopf}
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
        {wahl?.art === 'neu' ? 'Neue Person · ' : ''}
        {dazu ? `zur Anmeldung von ${dazu.wer} · ` : ''}Anmelde-Nr. {nr}
      </p>
      {schlussVorbei && (
        <p className={a.hinweisBlau}>
          Der Anmeldeschluss war am {tagPunkt(anmeldeschluss)} – von Hand geht es trotzdem.
        </p>
      )}
      <div className={`${pv.pv} ${pv['fs-kasten']}`} style={FARBEN}>
        {dazu ? (
          <p className={a.leise}>
            Kontakt, Unterschrift und Auswahl stehen schon bei der Anmeldung – hier nur die Fragen
            für {vor}.
          </p>
        ) : (
          <section className={`${a.teil} ${a.handFragen}`}>
            <h3>Für die Anmeldung</h3>
            {hf.anmeldung.filter(sichtbar).map((x) => (
              <div key={x.id} className={a.handFragen}>
                {/* Der Name steht im Formular unter „Kontakt“ – hier braucht er eine eigene Überschrift. */}
                {x.typ === 'name' && <p className={a.feldTitel}>Angemeldet von</p>}
                <FeldEingabe
                  feld={x}
                  pfad={`anmeldung.${x.id}`}
                  wert={antworten.anmeldung[x.id]}
                  onWert={(w) => setAnmeldung(x.id, w)}
                  fehler={fehlerFelder}
                />
              </div>
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
        )}

        <section className={`${a.teil} ${a.handFragen}`}>
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

        {kostet && !dazu && (g.art === 'auswahl' || e.preis.extras.length > 0) && (
          <section className={`${a.teil} ${a.handFragen}`}>
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

      <PlatzWahl
        lage={lage}
        platz={platz}
        trotzdem={trotzdem}
        onTrotzdem={setTrotzdem}
        vor={vor}
        betrag={
          kostet
            ? {
                titel: dazu ? `Neue Zahlung für ${vor}` : 'Betrag',
                wert: !mitPlatz
                  ? `${dazu ? '' : '0,00 € – '}folgt beim Nachrücken`
                  : euroText(dazu ? (dz?.zahlung?.betragCent ?? 0) : betrag.gesamtCent),
              }
            : null
        }
      >
        {dazu && mitPlatz && kostet && (
          <p className={a.leise}>
            Wie beim Nachrücken: {vor} bekommt eine eigene Zahlung – um so viel wird die Anmeldung
            nach den Regeln teurer. Die bisherige Zahlung bleibt, wie sie ist.
          </p>
        )}
        {dz?.auswahlFehlt && (
          <p className={f.fehler}>
            Die gespeicherte Auswahl gibt es nicht mehr – der Betrag ist nach den heutigen Preisen
            gerechnet. Bitte danach prüfen.
          </p>
        )}
        <p className={a.leise}>
          Wie im Formular: Wer wartet, zahlt erst beim Nachrücken.{' '}
          {mailHinweis('eintragen', mitBestaetigung, vor)}
        </p>
      </PlatzWahl>

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
