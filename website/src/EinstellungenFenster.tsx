import { useEffect, useRef, useState } from 'react';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import {
  FUSSZEILE_MAX,
  fusszeileAendern,
  fusszeileEntfernen,
  fusszeileHinzufuegen,
  fusszeileVerschieben,
  formularAnwenden,
  formularAus,
  type EinstellungenFormular,
} from '@shared/website/einstellungen';
import { datenschutzFehlt, type Link, type Seite } from '@shared/website/modell';
import { BANNER_STANDARDTEXT } from '@shared/website/render';
import { seitenAuswahlText } from '@shared/website/seitenListe';
import { Feld } from './Felder';
import { useEinstellungen, type EinstellungenBereit } from './einstellungenKontext';
import { zielAusWert, zielWert } from './regeln';
import { AUSSEHEN_TEXTE, einstellungenFremdText } from './sperrTexte';
import styles from './Fenster.module.scss';

const KEIN_LINK = '';

/**
 * **Das Fenster „Einstellungen“** (Bauplan Website W3a-3b, E-W17): Name der Gemeinde, Links in der Fußzeile, Datenschutz-Link,
 * Text des YouTube-Banners. Geöffnet vom letzten Reiter „Einstellungen“ (`ErweiterungsSeite`, wie in allen Erweiterungen).
 *
 * **Gespeichert wird mit „Speichern“** – wie in den Fenstern von Gebetsabend, Organigramm und Anmeldungen, nicht sofort bei
 * jeder Eingabe; bis dahin ändert sich nichts (Abbrechen/X verwirft). Darum braucht es hier kein „Rückgängig“.
 *
 * **Der Arbeitsstand ist nicht der des Fensters**, sondern der geteilte aus `EinstellungenQuelle` – dieselbe Einheit wie im
 * Reiter „Aussehen“: Das Fenster hält nur seinen Formular-Entwurf und legt beim Speichern **Name, Fußzeile, Datenschutz-Link
 * und Banner-Text** auf den neuesten Stand (Farben, Schriften, CSS bleiben, wie sie dort gerade sind). Ist die Einheit
 * fremd gesperrt, ist das Fenster nur zum Lesen.
 */
export function EinstellungenFenster({ onSchliessen }: { onSchliessen: () => void }) {
  const q = useEinstellungen();
  if (q.art !== 'bereit')
    return (
      <Sheet title="Einstellungen" onClose={onSchliessen} knoepfe={null}>
        {q.art === 'laedt' && <p className={styles.leise}>Die Einstellungen werden geladen …</p>}
        {q.art === 'fehler' && (
          <>
            <p className={styles.fehler} role="alert">
              {q.fehler.text}
            </p>
            <FensterKnopf art="zweit" onClick={q.neu}>
              Erneut versuchen
            </FensterKnopf>
          </>
        )}
        {q.art === 'unlesbar' && (
          <p className={styles.fehler} role="alert">
            Die gespeicherten Einstellungen lassen sich nicht lesen. Sie bleiben unberührt; solange
            das so ist, lassen sie sich hier nicht ändern.
          </p>
        )}
      </Sheet>
    );
  return <Bereit q={q} onSchliessen={onSchliessen} />;
}

function Bereit({ q, onSchliessen }: { q: EinstellungenBereit; onSchliessen: () => void }) {
  const { arbeit, stand, sperre, ich } = q;
  const [form, setForm] = useState<EinstellungenFormular>(() => formularAus(arbeit));
  const [wartet, setWartet] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [abgelehnt, setAbgelehnt] = useState(false);
  /** Zählt die Klicks auf „Speichern“ – nach jedem gescheiterten Versuch wird die Meldung einmal ins Bild gerollt. */
  const [versuch, setVersuch] = useState(0);
  const gezeigt = useRef(0);
  const meldungen = useRef<HTMLDivElement>(null);
  const gesperrt = sperre.fremd !== null;
  const speicherArt = sperre.speicher.art;

  // Die Meldungen stehen unter dem letzten Feld; wer oben „Speichern“ drückt, sähe sonst nur, dass das Fenster offen bleibt
  // (Test-Instanz/Dev 20.11.2026). Einmal je Versuch, sobald das Ergebnis da ist. Rumpf in { }: `scrollIntoView` liefert in
  // neuen Browsern ein Promise – als Rückgabe eines Effekts gäbe das beim Abbauen eine weiße Seite (Chrome 152).
  useEffect(() => {
    if (wartet || versuch === gezeigt.current) return;
    const block = meldungen.current;
    if (!block || block.childElementCount === 0) return;
    gezeigt.current = versuch;
    block.scrollIntoView?.({ block: 'nearest' });
  }, [versuch, wartet, meldung, abgelehnt, speicherArt]);

  // Ändert sich die Arbeitskopie von außen (neu geladen, Bearbeitung übernommen), zeigt das Fenster den neuen Stand –
  // sonst überschriebe „Speichern“ mit dem alten Entwurf, was ein anderer inzwischen eingetragen hat.
  useEffect(() => {
    setForm(formularAus(arbeit));
  }, [arbeit]);

  // Nach „Speichern“ wartet das Fenster auf das Ende der Schlange: gespeichert → zu; sonst bleibt es offen und zeigt den Grund.
  useEffect(() => {
    if (!wartet) return;
    if (speicherArt === 'gespeichert') onSchliessen();
    else if (speicherArt !== 'speichert') setWartet(false);
  }, [wartet, speicherArt, onSchliessen]);

  const speichern = async () => {
    setMeldung(null);
    setAbgelehnt(false);
    setVersuch((v) => v + 1);
    const r = await q.speichereJetzt((e) => formularAnwenden(e, form));
    if (r.art === 'ungueltig') return setMeldung(r.meldung);
    if (r.art === 'abgelehnt') return setAbgelehnt(true);
    setWartet(true);
  };

  const aendern = (f: EinstellungenFormular) => {
    setMeldung(null);
    setForm(f);
  };

  const noch = FUSSZEILE_MAX - form.fusszeile.length;
  const braucheDatenschutz = datenschutzFehlt(stand.seiten, formularAnwenden(arbeit, form));

  return (
    <Sheet
      title="Einstellungen"
      onClose={onSchliessen}
      mittel
      beschaeftigt={wartet}
      knoepfe={
        <FensterKnopf disabled={wartet || gesperrt} onClick={() => void speichern()}>
          {wartet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      {gesperrt && (
        <p className={styles.hinweisband} role="status">
          {einstellungenFremdText(sperre.fremd!, ich.person)}
        </p>
      )}
      <fieldset disabled={gesperrt} className={styles.formularFeld}>
        <Feld
          label="Name der Gemeinde"
          hilfe="Steht im Titel jeder Seite und als Beschreibung des Logos."
        >
          {(id) => (
            <input
              id={id}
              className={styles.eingabe}
              value={form.name}
              maxLength={100}
              onChange={(e) => aendern({ ...form, name: e.target.value })}
            />
          )}
        </Feld>

        <h4 className={styles.gruppe}>Links in der Fußzeile</h4>
        {form.fusszeile.map((l, i) => {
          const n = i + 1;
          return (
            <div key={i} className={styles.knopfBlock}>
              <input
                className={styles.eingabe}
                aria-label={`Titel von Link ${n}`}
                placeholder="Titel, z. B. Impressum"
                value={l.titel}
                maxLength={60}
                onChange={(e) => aendern(fusszeileAendern(form, i, { titel: e.target.value }))}
              />
              <ZielFeld
                label={`Link ${n}`}
                ziel={l.ziel}
                seiten={stand.seiten}
                onAendern={(ziel) => aendern(fusszeileAendern(form, i, { ziel: ziel! }))}
              />
              <div className={styles.fussKnoepfe}>
                <ZeilenKnopf
                  label={`Link ${n} nach oben`}
                  disabled={i === 0}
                  onClick={() => aendern(fusszeileVerschieben(form, i, 'hoch'))}
                >
                  <Icon name="chev-up" size={16} />
                </ZeilenKnopf>
                <ZeilenKnopf
                  label={`Link ${n} nach unten`}
                  disabled={i === form.fusszeile.length - 1}
                  onClick={() => aendern(fusszeileVerschieben(form, i, 'runter'))}
                >
                  <Icon name="chev-down" size={16} />
                </ZeilenKnopf>
                <ZeilenKnopf
                  label={`Link ${n} entfernen`}
                  onClick={() => aendern(fusszeileEntfernen(form, i))}
                >
                  <Icon name="x" size={16} />
                </ZeilenKnopf>
              </div>
            </div>
          );
        })}
        {form.fusszeile.length === 0 && (
          <p className={styles.leise}>Noch kein Link in der Fußzeile.</p>
        )}
        <FensterKnopf
          art="zweit"
          disabled={noch <= 0}
          onClick={() => aendern(fusszeileHinzufuegen(form, stand.seiten))}
        >
          <Icon name="plus" size={16} />
          Link
        </FensterKnopf>
        <p className={styles.unterText}>
          {noch > 0
            ? `Höchstens ${FUSSZEILE_MAX} Links – noch ${noch} frei.`
            : `Das sind die höchstens ${FUSSZEILE_MAX} Links.`}
        </p>

        <h4 className={styles.gruppe}>Datenschutz</h4>
        <div className={styles.knopfBlock}>
          <ZielFeld
            label="Datenschutz-Link"
            ziel={form.datenschutz}
            seiten={stand.seiten}
            kein
            onAendern={(ziel) => aendern({ ...form, datenschutz: ziel })}
          />
        </div>
        <p className={styles.unterText}>
          Dahin führt der Hinweis im YouTube-Banner und in der Video-Sperre.
        </p>
        {braucheDatenschutz && (
          <p className={styles.hinweisband} role="note">
            Auf der Website gibt es einen Livestream, aber noch keinen Datenschutz-Link – Banner und
            Video-Sperre brauchen ihn. Bitte gib hier einen an.
          </p>
        )}

        <h4 className={styles.gruppe}>YouTube-Banner</h4>
        <Feld
          label="Text des Banners"
          hilfe="Leer lassen, dann gilt der Standardtext. Das Banner erscheint, bevor ein Video von YouTube geladen wird."
        >
          {(id) => (
            <textarea
              id={id}
              className={`${styles.textfeld} ${styles.kurz}`}
              rows={3}
              maxLength={600}
              placeholder={BANNER_STANDARDTEXT}
              value={form.youtubeText}
              onChange={(e) => aendern({ ...form, youtubeText: e.target.value })}
            />
          )}
        </Feld>
      </fieldset>

      <div ref={meldungen}>
        {meldung && (
          <p className={styles.fehler} role="alert">
            Noch nicht gespeichert: {meldung}
          </p>
        )}
        {abgelehnt && !gesperrt && sperre.hinweis && (
          <p className={styles.fehler} role="alert">
            {sperre.hinweis}
          </p>
        )}
        {!wartet && speicherArt === 'fehler' && (
          <p className={styles.fehler} role="alert">
            Nicht gespeichert – {fehlerMeldung(sperre.speicher.fehler).text} Deine Eingaben bleiben
            hier stehen; „Speichern“ versucht es noch einmal.
          </p>
        )}
        {!wartet && (speicherArt === 'veraendert' || speicherArt === 'gesperrt') && (
          <>
            <p className={styles.fehler} role="alert">
              {AUSSEHEN_TEXTE.veraendert}
            </p>
            <FensterKnopf art="zweit" onClick={() => void sperre.neuLaden()}>
              Neu laden
            </FensterKnopf>
          </>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Das Ziel eines Links: eine Seite der Website oder eine Adresse (`kein`: auch „Kein Link“). Dieselbe Wahl wie bei den Knöpfen
 * (`zielWert`/`zielAusWert`); Sprunglinke (`#anker`) gehören in einen Knopf auf einer Seite, nicht hierher.
 */
function ZielFeld({
  label,
  ziel,
  seiten,
  kein = false,
  onAendern,
}: {
  label: string;
  ziel: Link | null;
  seiten: readonly Seite[];
  kein?: boolean;
  onAendern: (ziel: Link | null) => void;
}) {
  const wert = ziel === null ? KEIN_LINK : zielWert(ziel);
  const bekannt =
    ziel === null ||
    ziel.art === 'extern' ||
    (ziel.art === 'seite' && seiten.some((s) => s.id === ziel.seiteId));
  return (
    <>
      <select
        className={styles.eingabe}
        aria-label={`Ziel von ${label}`}
        value={wert}
        onChange={(e) =>
          onAendern(e.target.value === KEIN_LINK ? null : zielAusWert(e.target.value, ziel, ''))
        }
      >
        {kein && <option value={KEIN_LINK}>Kein Link</option>}
        {!bekannt && <option value={wert}>(Ziel gibt es nicht mehr)</option>}
        {seiten.map((s) => (
          <option key={s.id} value={`seite:${s.id}`}>
            Seite: {seitenAuswahlText(s)}
          </option>
        ))}
        <option value="extern">Andere Adresse …</option>
      </select>
      {ziel?.art === 'extern' && (
        <div className={styles.volleBreite}>
          <input
            className={styles.eingabe}
            aria-label={`Adresse von ${label}`}
            placeholder="https://…"
            value={ziel.url}
            onChange={(e) => onAendern({ art: 'extern', url: e.target.value })}
          />
        </div>
      )}
    </>
  );
}
