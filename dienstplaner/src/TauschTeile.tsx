import { useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Icon } from '@ui/icons/icons';
import { kachel, tagKurz, tagLang } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { einteilungSchluessel, type Eingang, type Kandidat } from '@shared/dienstplan/tausch';
import { CtSymbol } from './CtSymbol';
import { eingangSchluessel, type Tausch } from './useTausch';
import infos from './InfosFenster.module.scss';
import start from './Startseite.module.scss';
import styles from './TauschTeile.module.scss';

/** Was ein Tausch über den eigenen Dienst wissen muss. */
export interface EigenerDienst {
  terminId: number;
  termin: string;
  /** `YYYY-MM-DD` in der Gemeinde. */
  tag: string;
  dienst: string;
  ort: { serviceId: number; index: number | null };
}

const tagVon = (iso: string, zeitzone: string) => (iso ? tagAusIso(iso, zeitzone) : '');

/**
 * **Tauschen am eigenen Dienst** (E7-3, Entwurf `e7-3-tausch.html`): ein leiser Knopf „Tauschen“; läuft eine Anfrage,
 * steht sie stattdessen da – „Tausch angefragt bei Anna (So, 06.12.)“ mit „Zurückziehen“, abgelehnt mit „Andere fragen“.
 */
export function TauschAmDienst({
  d,
  tausch,
  zeitzone,
}: {
  d: EigenerDienst;
  tausch: Tausch;
  zeitzone: string;
}) {
  const [offen, setOffen] = useState(false);
  const k = einteilungSchluessel({ eventId: d.terminId, ...d.ort });
  const stand = tausch.stand(d.terminId, d.ort);
  const vorgang = tausch.laeuft(k);
  const fehler = tausch.fehler(k);
  const wann = (iso: string | null) => (iso ? ` (${tagKurz(tagVon(iso, zeitzone))})` : '');

  return (
    <>
      {stand?.art === 'offen' ? (
        <div className={styles.band}>
          <CtSymbol name="exchange-alt" size={13} />
          <span>
            <b>Tausch angefragt</b> bei {stand.name}
            {wann(stand.beginn)}
          </span>
          <FensterKnopf
            art="link"
            disabled={vorgang !== null}
            onClick={() => void tausch.zurueckziehen(k, stand.id)}
          >
            {vorgang === 'zurueckziehen' ? 'Wird zurückgezogen …' : 'Zurückziehen'}
          </FensterKnopf>
        </div>
      ) : stand?.art === 'abgelehnt' ? (
        <div className={`${styles.band} ${styles.nein}`}>
          <Icon name="x" size={13} />
          <span>
            {stand.name} hat den Tausch <b>abgelehnt</b>
          </span>
          <FensterKnopf art="link" onClick={() => setOffen(true)}>
            Andere fragen
          </FensterKnopf>
        </div>
      ) : (
        <FensterKnopf art="link" className={styles.knopf} onClick={() => setOffen(true)}>
          <CtSymbol name="exchange-alt" size={13} />
          Tauschen
        </FensterKnopf>
      )}
      {fehler && !offen && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {offen && (
        <TauschFenster
          d={d}
          schluessel={k}
          tausch={tausch}
          zeitzone={zeitzone}
          onClose={() => setOffen(false)}
        />
      )}
    </>
  );
}

/** „Dienst tauschen“ – wer denselben Dienst an einem anderen Termin hat; ein Tipp wählt, „Tausch anfragen“ schickt. */
function TauschFenster({
  d,
  schluessel,
  tausch,
  zeitzone,
  onClose,
}: {
  d: EigenerDienst;
  schluessel: string;
  tausch: Tausch;
  zeitzone: string;
  onClose: () => void;
}) {
  const geladen = useLaden(
    () => tausch.kandidaten(schluessel),
    // Nur beim Öffnen laden – `tausch` ändert sich bei jedem Zeichnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schluessel],
  ).stand;
  const liste: Kandidat[] | null | 'fehler' | 'weg' =
    geladen.art === 'fertig'
      ? (geladen.daten ?? 'weg')
      : geladen.art === 'fehler'
        ? 'fehler'
        : null;
  const [wahl, setWahl] = useState<number | null>(null);
  const laeuft = tausch.laeuft(schluessel) === 'anfragen';
  const fehler = tausch.fehler(schluessel);

  const leer = Array.isArray(liste) && liste.length === 0;
  return (
    <Sheet
      title="Dienst tauschen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        Array.isArray(liste) && liste.length > 0 ? (
          <FensterKnopf
            disabled={wahl === null || laeuft}
            onClick={async () => {
              if (wahl !== null && (await tausch.anfragen(schluessel, wahl))) onClose();
            }}
          >
            {laeuft ? 'Wird angefragt …' : 'Tausch anfragen'}
          </FensterKnopf>
        ) : undefined
      }
    >
      <p className={infos.fuer}>
        <b>
          {d.dienst} · {d.termin} · {tagLang(d.tag)}
        </b>
        {!leer && liste !== 'weg' && (
          <>
            {' '}
            – wähle, mit wem du tauschen möchtest. Die Person wird gefragt; getauscht wird erst,
            wenn sie annimmt.
          </>
        )}
      </p>
      {liste === null && <p className={infos.hinweis}>Wird geladen …</p>}
      {liste === 'fehler' && (
        <p className={infos.fehler} role="alert">
          ChurchTools antwortet gerade nicht – bitte gleich noch einmal.
        </p>
      )}
      {liste === 'weg' && <p className={infos.hinweis}>Diesen Dienst hast du nicht mehr.</p>}
      {leer && (
        <p className={infos.hinweis}>
          Gerade hat niemand sonst „{d.dienst}“ an einem anderen Termin. Frag am besten direkt bei
          der Person nach, die den Dienst plant – oder sag ab.
        </p>
      )}
      {Array.isArray(liste) && liste.length > 0 && (
        <div className={styles.wahl} role="radiogroup" aria-label="Mit wem tauschen">
          {liste.map((kd) => {
            const tag = tagVon(kd.beginn, zeitzone);
            const kk = tag ? kachel(tag) : null;
            return (
              <button
                key={kd.einteilung}
                type="button"
                role="radio"
                aria-checked={wahl === kd.einteilung}
                className={`${styles.wahlZeile}${wahl === kd.einteilung ? ` ${styles.an}` : ''}`}
                disabled={laeuft}
                onClick={() => setWahl(kd.einteilung)}
              >
                <span className={styles.punkt} aria-hidden="true" />
                {kk && <DatumKachel tag={kk.tag} monat={kk.monat} />}
                <span className={styles.text}>
                  <b>{kd.name}</b>
                  <small>
                    {kd.termin}
                    {tag ? ` · ${tagKurz(tag)}` : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {fehler && (
        <p className={infos.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}

/**
 * **Eine Tausch-Anfrage an mich** in „Für dich offen“: „Spike möchte tauschen: Du bekämst Gesang am So, 10.01. und gibst
 * deinen am So, 15.11. ab.“ – Annehmen tauscht sofort (ohne Rückfrage, Alwin 04.11.2026; ein Tausch lässt sich nicht
 * rückgängig machen, darum sagt der Text genau, was passiert), Ablehnen lässt alles, wie es war.
 */
export function TauschEingang({
  e,
  tausch,
  zeitzone,
}: {
  e: Eingang;
  tausch: Tausch;
  zeitzone: string;
}) {
  const k = eingangSchluessel(e);
  const vorgang = tausch.laeuft(k);
  const fehler = tausch.fehler(k);
  const bekomme = tagVon(e.bekomme.beginn, zeitzone);
  const gebe = tagVon(e.gebe.beginn, zeitzone);
  const kk = bekomme ? kachel(bekomme) : null;
  const dienst = tausch.dienstZu(e);
  return (
    <li className={start.zeile}>
      {kk && <DatumKachel tag={kk.tag} monat={kk.monat} />}
      <div className={start.mitte}>
        <b>Tausch-Anfrage · {dienst}</b>
        <small>
          {/* `strong`, nicht `b`: `.mitte b` ist die Titelzeile der Startseite (15 px). */}
          <strong>{e.von}</strong> möchte tauschen: Du bekämst {dienst} am{' '}
          <strong>{bekomme ? tagKurz(bekomme) : e.bekomme.termin}</strong> und gibst deinen am{' '}
          <strong>{gebe ? tagKurz(gebe) : e.gebe.termin}</strong> ab.
        </small>
        <div className={styles.knoepfe}>
          <FensterKnopf disabled={vorgang !== null} onClick={() => void tausch.annehmen(e)}>
            <Icon name="check" size={15} stroke={2.4} />
            {vorgang === 'annehmen' ? 'Wird getauscht …' : 'Annehmen'}
          </FensterKnopf>
          <FensterKnopf
            art="zweit"
            disabled={vorgang !== null}
            onClick={() => void tausch.ablehnen(e)}
          >
            <Icon name="x" size={15} stroke={2.4} />
            {vorgang === 'ablehnen' ? 'Lehnt ab …' : 'Ablehnen'}
          </FensterKnopf>
        </div>
        {fehler && (
          <p className={styles.fehler} role="alert">
            {fehler}
          </p>
        )}
      </div>
    </li>
  );
}

/** Eben angenommen – „Getauscht – du hast jetzt …“. */
export function TauschGetauscht({ text }: { text: string }) {
  return (
    <li className={start.zeile}>
      <div className={`${styles.band} ${styles.ok}`}>
        <Icon name="check" size={13} />
        <span>{text}</span>
      </div>
    </li>
  );
}
