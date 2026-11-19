import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { nachweisGueltigText } from '@shared/anmeldung/nachweise';
import { nachweiseSeiteLaden, type NachweisArt } from './nachweisArten';
import { NachweisArtFenster } from './NachweisArtFenster';
import type { Aenderung } from './Rueckgaengig';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import n from './Nachweise.module.scss';

/** Wer darf neue Nachweis-Arten anlegen? Steht auch im Hinweis, wenn man es nicht darf. */
const WER_DARF = 'Neue Nachweis-Arten legt an, wer in ChurchTools „Berechtigungen verwalten“ hat.';

/**
 * **Die Seite „Nachweise“** (N1b, Entwurf `n-nachweise-v2`, Ansicht 1) – bisher nur die **Liste der Nachweis-Arten**
 * (Gruppen „Nachweis: …“ mit Gültigkeit und Vertrauenspersonen). Wer wann eingesehen hat, kommt mit N2.
 *
 * Sehen darf die Seite, wer „Berechtigungen verwalten“ hat oder eine Nachweis-Gruppe leitet (die Startseite entscheidet).
 * Neu anlegen und Bearbeiten nur mit „Berechtigungen verwalten“ – sonst steht da, wer das darf.
 *
 * Nicht lesbar ist nicht „leer“: Antwortet ChurchTools nicht, steht der Fehlerkasten mit „Erneut versuchen“ da, keine
 * leere Liste.
 */
export function NachweisSeite({
  onZurueck,
  onGeaendert,
}: {
  onZurueck: () => void;
  onGeaendert: (a: Aenderung) => void;
}) {
  const { stand, neu } = useLaden(() => nachweiseSeiteLaden(), []);
  /** Welche Art im Fenster offen ist: `null` = keins, `'neu'` = neue Art. */
  const [fenster, setFenster] = useState<NachweisArt | 'neu' | null>(null);

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
      <section className={s.karte} aria-labelledby="nachweis-arten">
        <div className={s.kopf}>
          <h2 id="nachweis-arten">Nachweis-Arten</h2>
          {arten.length > 0 && <span className={s.leise}>{arten.length}</span>}
        </div>
        {arten.length === 0 ? (
          <div className={s.leer}>
            <b>Es gibt noch keine Nachweis-Art.</b>
            <span className={s.leise}>
              {darf
                ? 'Mit „Neue Nachweis-Art“ legst du die erste an, zum Beispiel „Führungszeugnis“.'
                : WER_DARF}
            </span>
          </div>
        ) : (
          <ul className={s.liste}>
            {arten.map((a) => (
              <li key={a.id} className={s.zeile}>
                <span className={`${s.kachel} ${s.kachelGrau}`} aria-hidden="true">
                  <Icon name="kreis-haken" size={18} />
                </span>
                <div className={s.mitte}>
                  <b>{a.name}</b>
                  <small>
                    {a.einstellungen
                      ? `Gültig ${nachweisGueltigText(a.einstellungen)}`
                      : 'Noch nicht fertig eingerichtet – „Bearbeiten“ holt das nach.'}
                  </small>
                  <small className={n.personen}>
                    {a.vertrauen === null
                      ? 'Vertrauenspersonen: für dich nicht sichtbar'
                      : a.vertrauen.length === 0
                        ? 'Keine Vertrauensperson eingetragen'
                        : `Vertrauenspersonen: ${a.vertrauen.map((p) => p.name).join(', ')}`}
                  </small>
                </div>
                {darf && (
                  <FensterKnopf
                    art="zweit"
                    aria-label={`${a.name} bearbeiten`}
                    onClick={() => setFenster(a)}
                  >
                    Bearbeiten
                  </FensterKnopf>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {!darf && <p className={v.hinweis}>{WER_DARF}</p>}

      {fenster && (
        <NachweisArtFenster
          // Eine andere Art oder „neu“ beginnt mit frischen Eingaben.
          key={fenster === 'neu' ? 'neu' : fenster.id}
          art={fenster === 'neu' ? null : fenster}
          grundlage={grundlage}
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
