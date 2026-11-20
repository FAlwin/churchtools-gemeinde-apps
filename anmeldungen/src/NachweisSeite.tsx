import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { AnsichtWahl } from '@ui/bedienung/AnsichtWahl';
import { Etikett } from '@ui/bedienung/Etikett';
import { KlickZeile } from '@ui/bedienung/KlickZeile';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { tagPunkt } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { nachweisGueltigText } from '@shared/anmeldung/nachweise';
import { faelligeZahl } from '@shared/anmeldung/nachweisFaellige';
import {
  aufmerksamkeitZaehlen,
  brauchtAufmerksamkeit,
  standText,
  standTon,
} from '@shared/anmeldung/nachweisStand';
import { nachweiseSeiteLaden, type NachweisArt } from './nachweisArten';
import { personenMitStand, type PersonMitStand } from './nachweisPersonen';
import { NachweisArtFenster } from './NachweisArtFenster';
import { EinsichtFenster } from './EinsichtFenster';
import { FaelligeFenster } from './FaelligeFenster';
import type { Aenderung } from './Rueckgaengig';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import n from './Nachweise.module.scss';

/** Wer darf neue Nachweis-Arten anlegen? Steht auch im Hinweis, wenn man es nicht darf. */
const WER_DARF = 'Neue Nachweis-Arten legt an, wer in ChurchTools „Berechtigungen verwalten“ hat.';

/** Die Ansicht der Seite: alle Personen oder nur die, die die Vertrauensperson braucht (Adresse `#/nachweise/aufmerksam`). */
export type NachweisFilter = 'alle' | 'aufmerksam';

/** „–“ für ein leeres Datum, sonst „TT.MM.JJJJ“. */
const datumOderStrich = (tag: string | null) => (tag ? tagPunkt(tag) : '–');

/**
 * **Die Seite „Nachweise“** (N1b; N2a Entwurf `n2-stand-v1`, Ansicht 2 und 5) – je **Nachweis-Art eine Karte**: im Kopf
 * Gültigkeit, Antrag und Vertrauenspersonen (die frühere Liste „Nachweis-Arten“), „Nachweis-Art bearbeiten“ im „⋯“-Menü,
 * darunter ihre Personen mit dem Stand (am Handy als Liste, am Rechner als Tabelle). Der Stand wird **nur gelesen**; die Regeln
 * stehen in `shared/anmeldung/nachweisStand.ts`. Einsicht festhalten (N2b): ein Klick auf eine Person. Fällige anschreiben (N2c): stiller Knopf im Kartenkopf.
 *
 * Sehen darf die Seite, wer „Berechtigungen verwalten“ hat oder eine Nachweis-Gruppe leitet (die Startseite entscheidet).
 * Neu anlegen und Bearbeiten nur mit „Berechtigungen verwalten“ – sonst steht da, wer das darf.
 *
 * Nicht lesbar ist nicht „leer“: Antwortet ChurchTools nicht, steht der Fehlerkasten mit „Erneut versuchen“ da, keine
 * leere Liste.
 */
export function NachweisSeite({
  gemeinde = null,
  filter = 'alle',
  onFilter = () => {},
  onZurueck,
  onGeaendert,
}: {
  /** Name der Gemeinde – Vorgabe für den Briefkopf des Antrags. */
  gemeinde?: string | null;
  /** Die Ansicht; die App hält sie in der Adresse (`#/nachweise/aufmerksam`). */
  filter?: NachweisFilter;
  onFilter?: (f: NachweisFilter) => void;
  onZurueck: () => void;
  onGeaendert: (a: Aenderung) => void;
}) {
  const { stand, neu } = useLaden(() => nachweiseSeiteLaden(), []);
  const handy = useMedienAbfrage(HANDY_BREITE);
  const heute = heuteImKalender();
  /** Welche Art im Fenster offen ist: `null` = keins, `'neu'` = neue Art. */
  const [fenster, setFenster] = useState<NachweisArt | 'neu' | null>(null);
  /** Die Art, für die gerade „Fällige anschreiben“ offen ist (N2c). */
  const [faellige, setFaellige] = useState<{ art: NachweisArt; personen: PersonMitStand[] } | null>(
    null,
  );
  /** Die Person, deren Einsicht gerade festgehalten wird. */
  const [einsicht, setEinsicht] = useState<{ art: NachweisArt; person: PersonMitStand } | null>(
    null,
  );

  const zurueck = (
    <button type="button" className={v.zurueck} onClick={onZurueck}>
      <Icon name="chev-left" size={18} />
      Übersicht
    </button>
  );

  if (stand.art === 'laedt' || stand.art === 'aus')
    return (
      <div className={v.seite}>
        {zurueck}
        <p className={s.leise}>Wird geladen …</p>
      </div>
    );
  if (stand.art === 'fehler')
    return (
      <div className={v.seite}>
        {zurueck}
        <FehlerKasten fehler={stand.fehler} onNochmal={neu} />
      </div>
    );

  const { grundlage, arten } = stand.daten;
  const darf = grundlage.darfEinrichten;
  // Der Stand je Art für heute; `null` = für dich nicht sichtbar.
  const karten = arten.map((a) => ({ art: a, personen: personenMitStand(a, heute) }));
  const faelle = (l: PersonMitStand[] | null) =>
    (l ?? []).filter((p) => brauchtAufmerksamkeit(p.stand));
  const merker = aufmerksamkeitZaehlen(
    karten.flatMap((k) => (k.personen ?? []).map((p) => p.stand)),
  ).summe;
  const nurFaelle = filter === 'aufmerksam';
  const sichtbar = nurFaelle ? karten.filter((k) => faelle(k.personen).length > 0) : karten;

  return (
    <div className={v.seite}>
      {zurueck}
      <header className={v.kopf}>
        <div>
          <h1>Nachweise</h1>
        </div>
        {darf && (
          <KopfKnopf
            neu
            label="Neue Nachweis-Art"
            symbol={<Icon name="plus" size={18} />}
            onClick={() => setFenster('neu')}
          />
        )}
      </header>
      <p className={v.hinweis}>
        Eine Nachweis-Art ist zum Beispiel das Führungszeugnis: Wer dafür eingetragen ist, bekommt
        eine Aufforderung, und die Vertrauenspersonen halten fest, wann sie es eingesehen haben.
      </p>
      {arten.length > 0 && (
        <Werkzeugzeile
          handy={handy}
          ariaLabel="Nachweise"
          links={
            <AnsichtWahl<NachweisFilter>
              ariaLabel="Ansicht"
              value={filter}
              onChange={onFilter}
              handy={handy}
              options={[
                { value: 'alle', label: 'Alle' },
                { value: 'aufmerksam', label: 'Braucht Aufmerksamkeit', zahl: merker },
              ]}
            />
          }
        />
      )}
      {arten.length === 0 ? (
        <section className={s.karte} aria-labelledby="nachweis-arten">
          <div className={s.kopf}>
            <h2 id="nachweis-arten">Nachweis-Arten</h2>
          </div>
          <div className={s.leer}>
            <b>Es gibt noch keine Nachweis-Art.</b>
            <span className={s.leise}>
              {darf
                ? 'Mit „Neue Nachweis-Art“ legst du die erste an, zum Beispiel „Führungszeugnis“.'
                : WER_DARF}
            </span>
          </div>
        </section>
      ) : (
        <div className={n.artKarten}>
          {nurFaelle && sichtbar.length === 0 && (
            <section className={s.karte} aria-label="Nichts zu tun">
              <div className={s.leer}>
                <b>Gerade braucht niemand etwas.</b>
                <span className={s.leise}>
                  Wer fehlt, bald abläuft, abgelaufen ist oder eine Eintragung hat, steht hier.
                </span>
              </div>
            </section>
          )}
          {sichtbar.map(({ art: a, personen }) => {
            const zeilen = nurFaelle ? faelle(personen) : personen;
            return (
              <section key={a.id} className={s.karte} aria-labelledby={`art-${a.id}`}>
                <div className={n.artKopf}>
                  <div className={n.artText}>
                    <h2 id={`art-${a.id}`}>{a.name}</h2>
                    <small className={n.personen}>
                      {a.einstellungen
                        ? `${nachweisGueltigText(a.einstellungen)} · ${a.einstellungen.antrag?.an ? 'mit Antrag' : 'ohne Antrag'}`
                        : 'Noch nicht fertig eingerichtet – „Nachweis-Art bearbeiten“ holt das nach.'}
                    </small>
                    <small className={n.personen}>
                      {a.vertrauen === null
                        ? 'Vertrauenspersonen: für dich nicht sichtbar'
                        : a.vertrauen.length === 0
                          ? 'Keine Vertrauensperson eingetragen'
                          : `Vertrauenspersonen: ${a.vertrauen.map((p) => p.name).join(', ')}`}
                    </small>
                  </div>
                  <div className={n.artAktionen}>
                    {/* Still (R1/R2): gefüllt ist nur der grüne Knopf oben. Nur, wenn es jemanden gibt, der Post braucht. */}
                    {a.einstellungen && personen && faelligeZahl(personen) > 0 && (
                      <KopfKnopf
                        still
                        label="Fällige anschreiben"
                        title={`${a.name}: Fällige anschreiben`}
                        symbol={<Icon name="brief" size={18} />}
                        onClick={() => setFaellige({ art: a, personen })}
                      />
                    )}
                    {darf && (
                      <MehrMenue
                        handy={handy}
                        titel={`${a.name}: Mehr`}
                        optionen={[
                          {
                            label: 'Nachweis-Art bearbeiten',
                            symbol: <Icon name="pencil" size={18} />,
                            onClick: () => setFenster(a),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
                <PersonenBereich
                  personen={zeilen}
                  handy={handy}
                  // Festhalten kann, wer die Art sieht (Admin oder Vertrauensperson) – und nur eine fertig eingerichtete Art.
                  onWaehlen={
                    a.einstellungen ? (p) => setEinsicht({ art: a, person: p }) : undefined
                  }
                />
              </section>
            );
          })}
        </div>
      )}
      {!darf && <p className={v.hinweis}>{WER_DARF}</p>}

      {einsicht && einsicht.art.einstellungen && (
        <EinsichtFenster
          // Eine andere Person beginnt mit frischen Eingaben.
          key={`${einsicht.art.id}-${einsicht.person.personId}`}
          art={einsicht.art}
          person={einsicht.person}
          heute={heute}
          onClose={(geaendert) => {
            setEinsicht(null);
            if (geaendert) neu();
          }}
          onFertig={(text) => {
            setEinsicht(null);
            onGeaendert({ text, rueckgaengig: null });
            neu();
          }}
        />
      )}
      {faellige && faellige.art.einstellungen && (
        <FaelligeFenster
          // Eine andere Art beginnt mit frischem Text.
          key={faellige.art.id}
          art={faellige.art}
          personen={faellige.personen}
          heute={heute}
          onClose={() => setFaellige(null)}
          onFertig={(text) => {
            setFaellige(null);
            onGeaendert({ text, rueckgaengig: null });
            neu();
          }}
        />
      )}
      {fenster && (
        <NachweisArtFenster
          // Eine andere Art oder „neu“ beginnt mit frischen Eingaben.
          key={fenster === 'neu' ? 'neu' : fenster.id}
          art={fenster === 'neu' ? null : fenster}
          grundlage={grundlage}
          gemeinde={gemeinde}
          onClose={() => setFenster(null)}
          onFertig={(text) => {
            setFenster(null);
            onGeaendert({ text, rueckgaengig: null });
            neu();
          }}
        />
      )}
    </div>
  );
}

/** Die Personen einer Art: Hinweis statt Tabelle, wenn es nichts zu zeigen gibt. */
function PersonenBereich({
  personen,
  handy,
  onWaehlen,
}: {
  /** `null`: für dich nicht sichtbar. */
  personen: PersonMitStand[] | null;
  handy: boolean;
  /** Ein Klick auf eine Person (Einsicht festhalten); fehlt es, sind die Zeilen nur zum Ansehen. */
  onWaehlen?: (p: PersonMitStand) => void;
}) {
  if (personen === null)
    return <p className={`${s.leise} ${n.leer}`}>Die Personen sind für dich nicht sichtbar.</p>;
  if (personen.length === 0)
    return <p className={`${s.leise} ${n.leer}`}>Noch niemand eingetragen.</p>;
  return (
    <>
      {handy ? (
        <PersonenListe personen={personen} onWaehlen={onWaehlen} />
      ) : (
        <PersonenTabelle personen={personen} onWaehlen={onWaehlen} />
      )}
      {onWaehlen && (
        <small className={`${n.personen} ${n.leer}`}>
          Ein Klick auf eine Person öffnet „Einsicht festhalten“.
        </small>
      )}
    </>
  );
}

/** Name, darunter rot die Lücke im Antrag. */
function NameMitLuecke({ p }: { p: PersonMitStand }) {
  return (
    <span className={n.tName}>
      <b>{p.name}</b>
      {p.luecke && <span className={n.luecke}>{p.luecke}</span>}
    </span>
  );
}

function StandEtikett({ p }: { p: PersonMitStand }) {
  return <Etikett ton={standTon(p.stand)}>{standText(p.stand)}</Etikett>;
}

/** Rechner: Name | Stand | Eingesehen am | Ausgestellt am | Gültig bis. */
function PersonenTabelle({
  personen,
  onWaehlen,
}: {
  personen: PersonMitStand[];
  onWaehlen?: (p: PersonMitStand) => void;
}) {
  return (
    <div className={n.tabelleRahmen}>
      <table className={n.tabelle}>
        <thead>
          <tr>
            <th scope="col" className={n.tKopf}>
              Name
            </th>
            <th scope="col" className={n.tKopf}>
              Stand
            </th>
            <th scope="col" className={n.tKopf}>
              Eingesehen am
            </th>
            <th scope="col" className={n.tKopf}>
              Ausgestellt am
            </th>
            <th scope="col" className={n.tKopf}>
              Gültig bis
            </th>
          </tr>
        </thead>
        <tbody>
          {personen.map((p) => (
            <tr
              key={p.personId}
              className={onWaehlen ? n.klickbar : undefined}
              // Die Zeile ist der Knopf: Maus, Tab und Eingabe/Leertaste (kein eigener Knopf in der Zelle).
              tabIndex={onWaehlen ? 0 : undefined}
              onClick={onWaehlen ? () => onWaehlen(p) : undefined}
              onKeyDown={
                onWaehlen
                  ? (e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      onWaehlen(p);
                    }
                  : undefined
              }
            >
              <td className={n.tZelle}>
                <NameMitLuecke p={p} />
              </td>
              <td className={n.tZelle}>
                <StandEtikett p={p} />
              </td>
              <td className={`${n.tZelle} ${n.tDatum}`}>{datumOderStrich(p.eingesehenAm)}</td>
              <td className={`${n.tZelle} ${n.tDatum}`}>{datumOderStrich(p.ausgestelltAm)}</td>
              <td className={`${n.tZelle} ${n.tDatum}`}>{datumOderStrich(p.gueltigBis)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Handy: Name, Etikett und EIN Datum (gültig bis, sonst eingesehen am), dazu die Lücke im Antrag. */
function PersonenListe({
  personen,
  onWaehlen,
}: {
  personen: PersonMitStand[];
  onWaehlen?: (p: PersonMitStand) => void;
}) {
  return (
    <ul className={s.liste}>
      {personen.map((p) => {
        const inhalt = (
          <>
            <NameMitLuecke p={p} />
            <span className={n.personRechts}>
              <StandEtikett p={p} />
              {p.gueltigBis ? (
                <small className={n.personen}>Gültig bis {tagPunkt(p.gueltigBis)}</small>
              ) : p.eingesehenAm ? (
                <small className={n.personen}>Eingesehen am {tagPunkt(p.eingesehenAm)}</small>
              ) : null}
            </span>
          </>
        );
        return onWaehlen ? (
          <li key={p.personId}>
            <KlickZeile className={n.person} onClick={() => onWaehlen(p)}>
              {inhalt}
            </KlickZeile>
          </li>
        ) : (
          <li key={p.personId} className={n.person}>
            {inhalt}
          </li>
        );
      })}
    </ul>
  );
}
