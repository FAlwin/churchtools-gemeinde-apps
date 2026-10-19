import { useMemo, useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import { Sheet } from '@ui/fenster/Sheet';
import { UnterschriftBild } from '@ui/anmeldeformular/Bausteine';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { euroText } from '@shared/anmeldung/preis';
import { unterschriftLesen } from '@shared/anmeldung/unterschrift';
import { wartenTrotzPlatz } from '@shared/anmeldung/nachpruefung';
import {
  anmeldungenAus,
  antwortZeilen,
  listenZahlen,
  type Absage,
  type AntwortZeile,
  type ListenAnmeldung,
  type ListenPerson,
} from '@shared/anmeldung/liste';
import type { GeladenerStand } from './mitglieder';
import { tagPunkt as lang } from '@shared/ct/datum';
import { anzahlText } from './anzeige';
import { AnmeldungZahlung } from './AnmeldungZahlung';
import type { Aenderung } from './Rueckgaengig';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import a from './AnmeldungenReiter.module.scss';

/** Stand der Mitglieder einer Veranstaltung – für Liste und Nachprüfung (A7-1). */
export type MitgliederZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'verboten' }
  | { art: 'fertig'; stand: GeladenerStand };

type Filter = 'alle' | 'offen' | 'warte' | 'abgesagt';

/** `TT.MM.` */
const kurz = (tag: string | null) => (tag ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.` : '');
const ganzerName = (p: { vor: string; nach: string }) => `${p.vor} ${p.nach}`.trim();
const personLink = (id: number) => `${ctBasis()}/?q=churchdb#PersonView/searchEntry:%23${id}/`;

function Antworten({ zeilen }: { zeilen: AntwortZeile[] }) {
  if (zeilen.length === 0) return null;
  return (
    <dl className={a.antworten}>
      {zeilen.map((z) => {
        const striche = z.striche ? unterschriftLesen(z.striche) : null;
        return (
          <div key={z.frage} className={a.antwort}>
            <dt>{z.frage}</dt>
            <dd>
              {striche && (
                <span className={a.unterschrift}>
                  <UnterschriftBild striche={striche} />
                </span>
              )}
              {z.text && <span className={a.mehrzeilig}>{z.text}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PersonPille({ p }: { p: ListenPerson }) {
  return p.status === 'wartet' ? (
    <span className={`${a.pille} ${a.pilleWarte}`}>
      Warteliste{p.warteplatz ? ` ${p.warteplatz}` : ''}
    </span>
  ) : (
    <span className={`${a.pille} ${a.pilleOk}`}>hat einen Platz</span>
  );
}

function ZahlungPille({ x, kostet }: { x: ListenAnmeldung; kostet: boolean }) {
  if (!kostet || x.betragCent === null || x.betragCent <= 0) return null;
  if (x.bezahlt)
    return (
      <span className={`${a.pille} ${a.pilleOk}`}>
        ✓ {x.zahlart ?? 'bezahlt'}
        {x.bezahltAm ? ` ${kurz(x.bezahltAm)}` : ''}
      </span>
    );
  return x.zahlungOffen ? <span className={`${a.pille} ${a.pilleOffen}`}>offen</span> : null;
}

/** **Das Fenster einer Anmeldung** – alle Antworten (A7-1), Betrag und Zahlung (A7-2). Nachrücken und Absagen: A7-3. */
function AnmeldungAnsehen({
  x,
  e,
  kostet,
  onClose,
  id,
  zahlarten,
  heute,
  darf,
  onGeaendert,
}: {
  x: ListenAnmeldung;
  e: OeffentlicheEinstellungen;
  kostet: boolean;
  onClose: () => void;
  id: number;
  zahlarten: string[];
  heute: string;
  darf: boolean;
  onGeaendert: (a: Aenderung) => void;
}) {
  const einmal = antwortZeilen(e.formular.anmeldung, x.einmal, e.ctFelder);
  const kontakt = e.ctFelder.kontakt === undefined ? undefined : x.einmal[e.ctFelder.kontakt];
  const fuerAlle =
    x.personen.length === 1
      ? 'Für die Anmeldung'
      : `Für die ganze Anmeldung · gilt für ${x.personen.map((p) => p.vor).join(', ')}`;
  return (
    <Sheet title={x.wer} onClose={onClose} cancelLabel="Schließen">
      <p className={a.unterTitel}>
        {x.nr && (
          <>
            Anmelde-Nr. <span className={v.nr}>{x.nr}</span> ·{' '}
          </>
        )}
        {x.angemeldetAm && <>angemeldet am {lang(x.angemeldetAm)}</>}
        {x.email && <> · {x.email}</>}
      </p>

      {(einmal.length > 0 || kontakt) && (
        <section className={a.teil}>
          <h3>{fuerAlle}</h3>
          {x.einmalAusVerlauf && (
            <p className={a.leise}>
              Aus dem Verlauf von ChurchTools – die Person, bei der es stand, hat abgesagt.
            </p>
          )}
          <Antworten
            zeilen={[...(kontakt ? [{ frage: 'Angemeldet von', text: kontakt }] : []), ...einmal]}
          />
        </section>
      )}

      <section className={a.teil}>
        <h3>{x.personen.length === 1 ? 'Person' : 'Personen'}</h3>
        {x.personen.map((p) => (
          <div key={p.personId} className={a.person}>
            <div className={a.personOben}>
              <b>
                {ganzerName(p)}
                {p.alter !== null && `, ${p.alter}`}
              </b>
              <PersonPille p={p} />
            </div>
            <Antworten
              zeilen={[
                ...(p.geburtstag ? [{ frage: 'Geburtsdatum', text: lang(p.geburtstag) }] : []),
                ...antwortZeilen(e.formular.person, p.werte, e.ctFelder),
              ]}
            />
            <a className={s.link} href={personLink(p.personId)}>
              In ChurchTools
              <Icon name="external" size={13} />
            </a>
          </div>
        ))}
      </section>

      {kostet && (
        <AnmeldungZahlung
          key={`${x.schluessel}-${x.betragCent}-${x.bezahlt}`}
          id={id}
          x={x}
          zahlarten={zahlarten}
          heute={heute}
          darf={darf}
          onGeaendert={onGeaendert}
        />
      )}

      {x.abgesagt.length > 0 && (
        <section className={a.teil}>
          <h3>Abgesagt</h3>
          {x.abgesagt.map((b) => (
            <p key={b.personId} className={a.leise}>
              {b.name} – {absageText(b)}
            </p>
          ))}
        </section>
      )}
    </Sheet>
  );
}

const absageText = (b: Absage) =>
  `am ${kurz(b.am)} ${b.selbst ? 'selbst abgesagt (Link in der Mail)' : 'vom Team entfernt'}`;

/**
 * **Reiter „Anmeldungen“** (A7-1, Entwurf `a7-anmeldungen-v2`) – eine Zeile je Anmeldung, Zahlen, Hinweis „frei, aber
 * jemand wartet“, Filter und Suche; Klick öffnet das Fenster mit allen Antworten. Nur ansehen.
 */
export function AnmeldungenReiter({
  id,
  e,
  maxPlaetze,
  entwurf,
  zustand,
  stichtag,
  heute,
  darf,
  zahlarten,
  onNeuLaden,
  onGeaendert,
}: {
  id: number;
  e: OeffentlicheEinstellungen;
  maxPlaetze: number | null;
  entwurf: boolean;
  zustand: MitgliederZustand | null;
  /** Erster Tag der Veranstaltung (Alter), sonst heute. */
  stichtag: string;
  heute: string;
  /** Darf ändern (bezahlt, Betrag) – ChurchTools prüft es beim Schreiben ohnehin. */
  darf: boolean;
  /** Die Zahlarten dieser Veranstaltung (A7-2). */
  zahlarten: string[];
  onNeuLaden: () => void;
  /** Nach einer Änderung: „Rückgängig“ anbieten; die Seite lädt die Mitglieder neu. */
  onGeaendert: (a: Aenderung) => void;
}) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  // Beim Neuladen (nach einer Änderung) bleibt der letzte Stand stehen – sonst ginge das offene Fenster zu.
  const letzter = useRef<GeladenerStand | null>(null);
  if (zustand?.art === 'fertig') letzter.current = zustand.stand;
  const stand =
    zustand?.art === 'fertig' ? zustand.stand : zustand?.art === 'laedt' ? letzter.current : null;
  const liste = useMemo(
    () => (stand ? anmeldungenAus(e, stand, stichtag) : []),
    [e, stand, stichtag],
  );

  if (entwurf || !zustand)
    return (
      <section className={`${s.karte} ${a.leer}`}>
        <b>Noch keine Anmeldungen.</b>
        <span>
          Die Veranstaltung ist noch ein Entwurf. Nach dem Freigeben steht hier, wer sich anmeldet.
        </span>
      </section>
    );
  if (zustand.art === 'laedt' && !stand)
    return <p className={s.leise}>Anmeldungen werden geladen …</p>;
  if (zustand.art === 'verboten')
    return (
      <p className={v.hinweis}>
        Die Anmeldungen sieht, wer in ChurchTools die Mitglieder dieser Gruppe sehen darf.
      </p>
    );
  if (zustand.art === 'fehler')
    return (
      <div className={v.warnung}>
        {zustand.text}{' '}
        <button type="button" className={v.bearbeiten} onClick={onNeuLaden}>
          Nochmal
        </button>
      </div>
    );

  const z = listenZahlen(e, liste);
  const plaetze = { belegt: z.belegt, wartend: z.wartend, max: maxPlaetze };
  const wartende = liste
    .flatMap((x) => x.personen.filter((p) => p.status === 'wartet').map((p) => ({ p, x })))
    .sort((u, w) => (u.p.warteplatz ?? 999) - (w.p.warteplatz ?? 999));
  const absagen = [...stand!.absagen].sort((u, w) => w.am.localeCompare(u.am));
  const frei = maxPlaetze === null ? null : maxPlaetze - z.belegt;
  const q = suche.trim().toLowerCase();
  const passt = (...texte: (string | null)[]) =>
    !q || texte.some((t) => t?.toLowerCase().includes(q));
  const zuX = (x: ListenAnmeldung) => passt(x.wer, x.nr, ...x.personen.map(ganzerName));
  const zeilen =
    filter === 'offen' ? liste.filter((x) => x.zahlungOffen && zuX(x)) : liste.filter(zuX);
  const ausgewaehlt = offen ? liste.find((x) => x.schluessel === offen) : undefined;
  const nrFeld = e.ctFelder.nr;
  const gehoertZu = (b: Absage) => {
    const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
    return nr ? liste.find((x) => x.nr === nr) : undefined;
  };

  const filterKnopf = (f: Filter, text: string, n: number) => (
    <button
      type="button"
      className={s.filterChip}
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
    >
      {text}
      <span className={s.zaehler}>{n}</span>
    </button>
  );

  return (
    <div className={a.reiter}>
      <div className={a.zahlen}>
        <div className={a.zahl}>
          <span>Plätze</span>
          <b>{maxPlaetze === null ? z.belegt : `${z.belegt} von ${maxPlaetze}`}</b>
          <small>{anzahlText(z.anmeldungen, 'Anmeldung', 'Anmeldungen')}</small>
        </div>
        <div className={a.zahl}>
          <span>Warteliste</span>
          <b className={z.wartend ? v.pruefInfo : undefined}>{z.wartend}</b>
          <small>
            {frei === null
              ? 'unbegrenzt'
              : frei > 0
                ? `${anzahlText(frei, 'Platz', 'Plätze')} frei`
                : 'kein Platz frei'}
          </small>
        </div>
        {z.kostet && (
          <div className={a.zahl}>
            <span>Zahlung offen</span>
            <b>{euroText(z.offenCent)}</b>
            <small>
              {anzahlText(z.offen, 'Anmeldung', 'Anmeldungen')} · {euroText(z.eingegangenCent)} da
            </small>
          </div>
        )}
      </div>

      {wartenTrotzPlatz(plaetze) && wartende[0] && (
        <p className={v.pruefHinweis}>
          <b>
            {frei === null ? 'Es ist Platz frei' : `${anzahlText(frei, 'Platz', 'Plätze')} frei`} –{' '}
            {z.wartend === 1 ? '1 wartet' : `${z.wartend} warten`}.
          </b>{' '}
          ChurchTools lässt niemanden von selbst nachrücken. Als Nächste wartet{' '}
          {ganzerName(wartende[0].p)}
          {wartende[0].x.angemeldetAm && ` (seit ${kurz(wartende[0].x.angemeldetAm)})`}. Nachrücken
          lassen: vorerst in ChurchTools.
        </p>
      )}

      <section className={s.karte} aria-label="Anmeldungen">
        <div className={s.filter}>
          {filterKnopf('alle', 'Alle', liste.length)}
          {z.kostet && filterKnopf('offen', 'Zahlung offen', z.offen)}
          {filterKnopf('warte', 'Warteliste', z.wartend)}
          {filterKnopf('abgesagt', 'Abgesagt', absagen.length)}
          <input
            type="search"
            className={a.suche}
            placeholder="Name suchen"
            aria-label="Name suchen"
            value={suche}
            onChange={(ev) => setSuche(ev.target.value)}
          />
        </div>

        {(filter === 'alle' || filter === 'offen') && (
          <ul className={s.liste}>
            {zeilen.map((x) => (
              <li key={x.schluessel} className={a.eintrag}>
                <button type="button" className={a.zeile} onClick={() => setOffen(x.schluessel)}>
                  <span className={a.links}>
                    <b>
                      {x.wer}{' '}
                      {x.nr ? (
                        <span className={v.nr}>{x.nr}</span>
                      ) : (
                        <span className={s.chip}>ohne Nr.</span>
                      )}
                    </b>
                    <span className={a.personen}>
                      {x.personen.map((p) => (
                        <span key={p.personId} className={a.p}>
                          {p.vor}
                          {p.alter !== null && ` ${p.alter}`}
                          {p.status === 'wartet' && (
                            <span className={`${a.pille} ${a.pilleWarte}`}>
                              Warteliste{p.warteplatz ? ` ${p.warteplatz}` : ''}
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={a.geld}>
                    {!z.kostet ? null : x.betragCent !== null ? (
                      <b>{euroText(x.betragCent)}</b>
                    ) : x.personen.every((p) => p.status === 'wartet') ? (
                      <small>Betrag beim Nachrücken</small>
                    ) : null}
                    <ZahlungPille x={x} kostet={z.kostet} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {filter === 'warte' && (
          <ul className={s.liste}>
            {wartende
              .filter(({ p, x }) => passt(ganzerName(p), x.wer, x.nr))
              .map(({ p, x }) => (
                <li key={p.personId} className={a.eintrag}>
                  <button type="button" className={a.zeile} onClick={() => setOffen(x.schluessel)}>
                    <span className={a.links}>
                      <b>
                        {p.warteplatz ? `${p.warteplatz} · ` : ''}
                        {ganzerName(p)} {x.nr && <span className={v.nr}>{x.nr}</span>}
                      </b>
                      <small className={a.leise}>
                        {x.angemeldetAm && `wartet seit ${kurz(x.angemeldetAm)} · `}
                        angemeldet von {x.wer}
                        {x.personen.some((o) => o.status === 'aktiv') &&
                          ` (${x.personen
                            .filter((o) => o.status === 'aktiv')
                            .map((o) => o.vor)
                            .join(', ')} hat einen Platz)`}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        {filter === 'abgesagt' && (
          <ul className={s.liste}>
            {absagen
              .filter((b) => passt(b.name))
              .map((b) => {
                const x = gehoertZu(b);
                return (
                  <li key={b.personId} className={`${a.eintrag} ${a.zeileStill}`}>
                    <span className={a.links}>
                      <b>
                        {b.name}{' '}
                        {nrFeld !== undefined && b.werte[nrFeld] && (
                          <span className={v.nr}>{b.werte[nrFeld]}</span>
                        )}
                      </b>
                      <small className={a.leise}>
                        {absageText(b)}
                        {b.warVorher === 'wartet' && ' · stand auf der Warteliste'}
                        {x && ` · gehörte zu ${x.wer}`}
                      </small>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}

        {((filter === 'alle' && zeilen.length === 0) ||
          (filter === 'offen' && zeilen.length === 0) ||
          (filter === 'warte' && wartende.length === 0) ||
          (filter === 'abgesagt' && absagen.length === 0)) && (
          <p className={a.leerZeile}>
            {q
              ? `Niemand mit „${suche.trim()}“ gefunden.`
              : filter === 'offen'
                ? 'Alle haben bezahlt.'
                : filter === 'warte'
                  ? 'Niemand auf der Warteliste.'
                  : filter === 'abgesagt'
                    ? 'Niemand hat abgesagt.'
                    : 'Noch keine Anmeldungen.'}
          </p>
        )}

        <p className={v.pruefFuss}>
          Sortiert nach Anmeldetag. Eine Zeile je Anmeldung; ältere Anmeldungen ohne Nr. stehen je
          Person einzeln. Die Leitung steht nicht in der Liste.
          {stand!.verlaufGekuerzt &&
            ' Der Verlauf in ChurchTools ist sehr lang – die ältesten Absagen fehlen hier.'}{' '}
          <button type="button" className={a.linkKnopf} onClick={onNeuLaden}>
            Neu laden
          </button>
        </p>
      </section>

      {ausgewaehlt && (
        <AnmeldungAnsehen
          x={ausgewaehlt}
          e={e}
          kostet={z.kostet}
          onClose={() => setOffen(null)}
          id={id}
          zahlarten={zahlarten}
          heute={heute}
          darf={darf}
          onGeaendert={onGeaendert}
        />
      )}
    </div>
  );
}
