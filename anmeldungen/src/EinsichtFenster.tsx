import { useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { personLink } from '@ui/ct/links';
import { tagPunkt } from '@shared/ct/datum';
import { ERGEBNIS_EINTRAG, ERGEBNIS_OHNE } from '@shared/anmeldung/nachweise';
import {
  einsichtFehler,
  einsichtFolgeTexte,
  einsichtPlan,
  einsichtVorbelegung,
  standText,
  standTon,
  type EinsichtWerte,
} from '@shared/anmeldung/nachweisStand';
import { EinsichtTeilweise, einsichtFesthalten } from './nachweisEinsicht';
import type { NachweisArt } from './nachweisArten';
import type { PersonMitStand } from './nachweisPersonen';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import n from './Nachweise.module.scss';

/**
 * **„Einsicht festhalten“** (N2b, Entwurf `n2-stand-v1`, Ansicht 3). Eingesehen am, Ausgestellt am, Ergebnis – und ein
 * blauer Kasten, der vorher sagt, was in ChurchTools geschieht (aus `einsichtPlan`, derselben Regel wie beim Schreiben).
 * Fehler stehen im Fenster, das Fenster bleibt offen. Nach einem Teilerfolg (Angaben gespeichert, Aufgabe noch offen)
 * lädt die Seite beim Schließen neu (`onClose(true)`).
 */
export function EinsichtFenster({
  art,
  person,
  heute,
  onClose,
  onFertig,
}: {
  art: Pick<NachweisArt, 'id' | 'name' | 'einstellungen'>;
  person: PersonMitStand;
  heute: string;
  /** `geaendert`: Es wurde schon etwas gespeichert – die Seite soll neu lesen. */
  onClose: (geaendert: boolean) => void;
  onFertig: (text: string) => void;
}) {
  const einst = art.einstellungen;
  const [w, setW] = useState<EinsichtWerte>(() => einsichtVorbelegung(person, person.stand, heute));
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [teilweise, setTeilweise] = useState(false);
  if (!einst) return null;

  const pruef = einsichtFehler(w, einst.ab, heute);
  const plan =
    !pruef && w.ergebnis
      ? einsichtPlan({
          einstellungen: einst,
          eingesehenAm: w.eingesehenAm,
          ausgestelltAm: w.ausgestelltAm || null,
          aufgabe: person.aufgabe
            ? { titel: person.aufgabe.titel, angelegt: person.aufgabe.angelegt }
            : null,
          heute,
        })
      : null;
  const folge =
    plan && w.ergebnis ? einsichtFolgeTexte(plan, einst, w.ergebnis, person.ergebnis) : [];
  const hatBisher = person.eingesehenAm || person.ausgestelltAm || person.ergebnis;

  const festhalten = async () => {
    if (pruef || !w.ergebnis) return;
    setArbeitet(true);
    setFehler(null);
    try {
      const erg = await einsichtFesthalten({
        art,
        person,
        eingesehenAm: w.eingesehenAm,
        ausgestelltAm: w.ausgestelltAm || null,
        ergebnis: w.ergebnis,
        heute,
      });
      onFertig(erg.text);
    } catch (e) {
      if (e instanceof EinsichtTeilweise) {
        setTeilweise(true);
        setFehler(e.message);
      } else setFehler(fehlerMeldung(e).text);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <Sheet
      title="Einsicht festhalten"
      onClose={() => onClose(teilweise)}
      beschaeftigt={arbeitet}
      mittel
      knoepfe={
        <FensterKnopf disabled={arbeitet || !!pruef} onClick={() => void festhalten()}>
          {arbeitet ? 'Wird festgehalten …' : 'Festhalten'}
        </FensterKnopf>
      }
    >
      <div className={n.einsichtKopf}>
        <b>{person.name}</b>
        <span>· {art.name} ·</span>
        <Etikett ton={standTon(person.stand)}>{standText(person.stand)}</Etikett>
      </div>
      {person.luecke && (
        <div className={`${n.kasten} ${n.kastenRot}`}>
          <span>
            <b>{person.luecke}.</b> In ChurchTools fehlt etwas im Profil – der Antrag hätte an
            diesen Stellen Lücken.
          </span>
          <a className={`${n.kastenLink} ${f.textKnopf}`} href={personLink(person.personId)}>
            Person in ChurchTools öffnen <Icon name="external" size={13} />
          </a>
        </div>
      )}
      {hatBisher && (
        <div className={n.kasten}>
          <span>
            Bisher:{' '}
            {[
              person.eingesehenAm ? `eingesehen ${tagPunkt(person.eingesehenAm)}` : null,
              person.ausgestelltAm ? `ausgestellt ${tagPunkt(person.ausgestelltAm)}` : null,
              person.ergebnis === 'eintrag'
                ? 'Ergebnis „Eintragung“'
                : person.gueltigBis
                  ? `gültig bis ${tagPunkt(person.gueltigBis)}`
                  : null,
            ]
              .filter((t) => t !== null)
              .join(', ')}
            .
          </span>
        </div>
      )}
      <div className={n.datumReihe}>
        <label className={f.feld}>
          <span>Eingesehen am</span>
          <input
            type="date"
            className={f.eingabe}
            value={w.eingesehenAm}
            max={heute}
            onChange={(e) => setW({ ...w, eingesehenAm: e.target.value })}
          />
        </label>
        <label className={f.feld}>
          <span>Ausgestellt am{einst.ab === 'einsicht' ? ' (freiwillig)' : ''}</span>
          <input
            type="date"
            className={f.eingabe}
            value={w.ausgestelltAm}
            max={w.eingesehenAm || heute}
            onChange={(e) => setW({ ...w, ausgestelltAm: e.target.value })}
          />
          <small className={f.hinweis}>Datum auf dem Zeugnis</small>
        </label>
      </div>
      <fieldset className={n.ergebnisSatz}>
        <legend>Ergebnis</legend>
        <div className={n.ergebnisWahl}>
          <label>
            <input
              type="radio"
              name="einsicht-ergebnis"
              checked={w.ergebnis === 'ohne'}
              onChange={() => setW({ ...w, ergebnis: 'ohne' })}
            />
            <span>{ERGEBNIS_OHNE}</span>
          </label>
          <label>
            <input
              type="radio"
              name="einsicht-ergebnis"
              checked={w.ergebnis === 'eintrag'}
              onChange={() => setW({ ...w, ergebnis: 'eintrag' })}
            />
            <span>{ERGEBNIS_EINTRAG}</span>
          </label>
        </div>
      </fieldset>
      {pruef && <p className={f.hinweis}>{pruef}</p>}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      {folge.length > 0 && (
        <div className={`${n.kasten} ${n.kastenBlau}`} aria-label="Was passiert">
          {folge.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <small className={f.hinweis}>
        Gespeichert wird nur, was § 72a Abs. 5 SGB VIII erlaubt: eingesehen am, Datum des
        Zeugnisses, Ergebnis. Das Zeugnis selbst nicht kopieren oder hochladen.
      </small>
    </Sheet>
  );
}
