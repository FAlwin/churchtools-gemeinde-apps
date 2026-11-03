import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { tagLang } from '@shared/ct/datum';
import type { MeinDienst, TerminZeile } from '@shared/dienstplan/termine';
import type { Antworten } from './useAntworten';
import infos from './InfosFenster.module.scss';
import styles from './AntwortKnoepfe.module.scss';

/**
 * **Eine Anfrage beantworten** (E7-1, Entwurf `e7-anfragen.html` Variante A, Alwin 03.11.2026): „Zusagen“ und „Absagen“
 * direkt an der Anfrage – auf der Startseite und unter „Dienste“. Absagen fragt nach einem freiwilligen Grund. Eben
 * beantwortet steht da „Zugesagt“/„Abgesagt“ mit „Rückgängig“ – zehn Minuten lang, so lange lässt ChurchTools es zu.
 * Erlaubt der Dienst kein Absagen (`allowDecline`), steht statt des Knopfs ein Hinweis.
 */
export function AntwortKnoepfe({
  termin,
  d,
  antworten: a,
  mitDienst = false,
}: {
  termin: TerminZeile;
  d: MeinDienst;
  antworten: Antworten;
  /** „Gesang zusagen“ statt „Zusagen“ – unter „Dienste“, wo die Zeile den Termin nennt, nicht den Dienst. */
  mitDienst?: boolean;
}) {
  const [absagenOffen, setAbsagenOffen] = useState(false);
  if (!d.ort) return null;
  const vorgang = a.laeuft(termin.id, d);
  const laeuft = vorgang !== null;
  const fehler = a.fehler(termin.id, d);

  if (d.antwort) {
    const zu = d.antwort.art === 'zugesagt';
    return (
      <div className={styles.beantwortet} data-art={d.antwort.art}>
        <span className={styles.status}>
          <Icon name={zu ? 'check' : 'x'} size={14} />
          <b>
            {mitDienst ? `${d.dienst} ` : ''}
            {zu ? 'zugesagt' : 'abgesagt'}
          </b>
        </span>
        {d.antwort.letzte && (
          <FensterKnopf
            art="link"
            disabled={laeuft}
            onClick={() => void a.rueckgaengig(termin.id, d)}
          >
            {vorgang === 'rueckgaengig' ? 'Wird zurückgenommen …' : 'Rückgängig'}
          </FensterKnopf>
        )}
        {fehler && (
          <p className={styles.fehler} role="alert">
            {fehler}
          </p>
        )}
      </div>
    );
  }
  if (d.zugesagt) return null;

  return (
    <div className={styles.knoepfe}>
      <FensterKnopf disabled={laeuft} onClick={() => void a.zusagen(termin.id, d)}>
        <Icon name="check" size={15} stroke={2.4} />
        {vorgang === 'zusagen' ? 'Sagt zu …' : mitDienst ? `${d.dienst} zusagen` : 'Zusagen'}
      </FensterKnopf>
      {d.absagen ? (
        <FensterKnopf art="zweit" disabled={laeuft} onClick={() => setAbsagenOffen(true)}>
          <Icon name="x" size={15} stroke={2.4} />
          Absagen
        </FensterKnopf>
      ) : (
        <small className={styles.hinweis}>
          Absagen geht hier nicht – bitte sprich mit dem Planer.
        </small>
      )}
      {fehler && !absagenOffen && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {absagenOffen && (
        <AbsagenFenster
          termin={termin}
          d={d}
          laeuft={vorgang === 'absagen'}
          fehler={fehler}
          onAbsagen={async (grund) => {
            if (await a.absagen(termin.id, d, grund)) setAbsagenOffen(false);
          }}
          onClose={() => setAbsagenOffen(false)}
        />
      )}
    </div>
  );
}

/** „Anfrage absagen“ – mit freiwilligem Grund, den sieht, wer den Dienst plant. */
function AbsagenFenster({
  termin,
  d,
  laeuft,
  fehler,
  onAbsagen,
  onClose,
}: {
  termin: TerminZeile;
  d: MeinDienst;
  laeuft: boolean;
  fehler: string | null;
  onAbsagen: (grund: string) => Promise<void>;
  onClose: () => void;
}) {
  const [grund, setGrund] = useState('');
  return (
    <Sheet
      title="Anfrage absagen"
      onClose={onClose}
      beschaeftigt={laeuft}
      // Ein angefangener Grund soll nicht durch einen Tipp daneben verschwinden.
      onHintergrund={grund !== '' ? () => {} : undefined}
      knoepfe={
        <FensterKnopf art="gefahr" disabled={laeuft} onClick={() => void onAbsagen(grund)}>
          {laeuft ? 'Sagt ab …' : 'Absagen'}
        </FensterKnopf>
      }
    >
      <p className={infos.fuer}>
        {d.dienst} · {termin.name} · {tagLang(termin.tag)}, {termin.uhrzeit} Uhr
      </p>
      <label className={infos.feld}>
        <span>Grund (optional)</span>
        <textarea
          className={infos.textarea}
          value={grund}
          rows={3}
          maxLength={255}
          autoFocus
          disabled={laeuft}
          placeholder="z. B. „bin im Urlaub“"
          onChange={(e) => setGrund(e.target.value)}
        />
      </label>
      <p className={infos.hinweis}>
        Den Grund sieht, wer den Dienst plant. Der Platz wird danach wieder frei.
      </p>
      {fehler && (
        <p className={infos.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
