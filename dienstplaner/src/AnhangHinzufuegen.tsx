import { useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { dateiGroesse } from '@ui/lied/dateiGroesse';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import {
  DATEI_MAX_TEXT,
  linkAdresse,
  pruefeTerminDatei,
  type TerminDatei,
} from '@shared/ct/terminDateien';
import { dateienAendern } from './ladeTerminDateien';
import infos from './InfosFenster.module.scss';
import styles from './DateienFenster.module.scss';

/** Eine ausgewählte Datei und wie weit sie ist. */
interface Auswahl {
  schluessel: number;
  datei: File;
  /** Vor dem Hochladen geprüft (`pruefeTerminDatei`): zu groß/leer geht nicht hoch, gleicher Name ist nur ein Hinweis. */
  pruefung: { art: 'fehler' | 'warnung'; text: string } | null;
  stand: 'wartet' | 'laeuft' | 'fehler';
  anteil: number;
  meldung?: string;
}

/**
 * **„Anhang hinzufügen“** (Scheibe T2b, Entwurf `termin-einstellungen.html`) – wie die Büroklammer in ChurchTools:
 * Dateien hochladen oder einen Link anhängen, ohne „Hochladen und E-Mail schreiben“ (kommt mit E8). Zu große Dateien
 * stehen sofort rot da und gehen gar nicht erst hoch; der Knopf nennt, was wirklich hochgeht. Hochgeladen wird eine
 * Datei nach der anderen, jede mit Fortschritt in % (Alwin 02.11.2026). Was klappt, verschwindet aus der Auswahl; was
 * scheitert, bleibt mit seiner Meldung stehen. Jede neue Liste geht über `onAktuell` zurück.
 */
export function AnhangHinzufuegen({
  fuer,
  terminId,
  vorhanden,
  onAktuell,
  onFertig,
  onClose,
  zurueck,
  aendern = dateienAendern,
}: {
  fuer: string;
  terminId: number;
  /** Die Dateien, die schon da sind – für den Hinweis „gibt es schon“. */
  vorhanden: readonly TerminDatei[];
  onAktuell: (dateien: TerminDatei[]) => void;
  /** Alles hochgeladen bzw. Link angehängt – zurück zur Liste. */
  onFertig: () => void;
  onClose: () => void;
  /** „‹“ und „Abbrechen“ zurück zur Liste – fehlt, wenn das Fenster direkt hier geöffnet wurde (dann schließen sie). */
  zurueck?: () => void;
  /** Nur für Tests. */
  aendern?: typeof dateienAendern;
}) {
  const [art, setArt] = useState<'datei' | 'link'>('datei');
  const [auswahl, setAuswahl] = useState<Auswahl[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [ziehen, setZiehen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLInputElement>(null);
  const zaehler = useRef(0);

  function waehlen(liste: FileList | null): void {
    if (!liste) return;
    const neu = [...liste].map((datei) => ({
      schluessel: ++zaehler.current,
      datei,
      pruefung: pruefeTerminDatei(datei, vorhanden),
      stand: 'wartet' as const,
      anteil: 0,
    }));
    setAuswahl((alt) => [...alt, ...neu]);
  }

  const setze = (schluessel: number, teil: Partial<Auswahl>) =>
    setAuswahl((alt) => alt.map((a) => (a.schluessel === schluessel ? { ...a, ...teil } : a)));

  const hochzuladen = auswahl.filter((a) => a.pruefung?.art !== 'fehler');

  async function hochladen(): Promise<void> {
    setLaeuft(true);
    let alleOk = true;
    // Eine nach der anderen: ChurchTools zählt mehrere Dateien einer Anfrage zusammen (128 MiB je Anfrage, gemessen).
    for (const a of hochzuladen) {
      setze(a.schluessel, { stand: 'laeuft', anteil: 0, meldung: undefined });
      try {
        const neu = await aendern.hochladen(terminId, a.datei, (anteil) =>
          setze(a.schluessel, { anteil }),
        );
        onAktuell(neu);
        setAuswahl((alt) => alt.filter((x) => x.schluessel !== a.schluessel));
      } catch (e) {
        alleOk = false;
        setze(a.schluessel, { stand: 'fehler', meldung: fehlerMeldung(e).text });
      }
    }
    setLaeuft(false);
    // Nur wenn nichts hängen geblieben ist – auch keine zu große Datei, die noch rot dasteht.
    if (alleOk && hochzuladen.length === auswahl.length) onFertig();
  }

  async function verlinken(): Promise<void> {
    setLaeuft(true);
    setFehler(null);
    try {
      onAktuell(await aendern.link(terminId, linkName, linkUrl));
      onFertig();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    } finally {
      setLaeuft(false);
    }
  }

  const adresse = linkAdresse(linkUrl);
  const knopf =
    art === 'datei' ? (
      <FensterKnopf disabled={laeuft || hochzuladen.length === 0} onClick={() => void hochladen()}>
        {laeuft
          ? 'Lädt hoch …'
          : hochzuladen.length === 0
            ? 'Hochladen'
            : hochzuladen.length === 1
              ? '1 Datei hochladen'
              : `${hochzuladen.length} Dateien hochladen`}
      </FensterKnopf>
    ) : (
      <FensterKnopf disabled={laeuft || adresse === null} onClick={() => void verlinken()}>
        {laeuft ? 'Hängt an …' : 'Link anhängen'}
      </FensterKnopf>
    );

  return (
    <Sheet
      title="Anhang hinzufügen"
      onClose={onClose}
      zurueck={zurueck}
      onAbbrechen={zurueck ?? onClose}
      beschaeftigt={laeuft}
      // Eine Auswahl oder ein angefangener Link soll nicht durch einen Tipp daneben verschwinden.
      onHintergrund={auswahl.length > 0 || linkUrl !== '' || linkName !== '' ? () => {} : undefined}
      knoepfe={knopf}
    >
      <p className={infos.fuer}>{fuer}</p>
      <Segment
        value={art}
        onChange={(w) => {
          setArt(w);
          setFehler(null);
        }}
        options={[
          { value: 'datei', label: 'Dateien hochladen' },
          { value: 'link', label: 'Link anhängen' },
        ]}
        ariaLabel="Art des Anhangs"
        verbunden
      />
      {art === 'datei' ? (
        <>
          <label
            className={`${styles.ablage}${ziehen ? ` ${styles.ziehen}` : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setZiehen(true);
            }}
            onDragLeave={() => setZiehen(false)}
            onDrop={(e) => {
              e.preventDefault();
              setZiehen(false);
              if (!laeuft) waehlen(e.dataTransfer.files);
            }}
          >
            <Icon name="plus" size={18} />
            <span>Dateien hierher ziehen oder antippen zum Auswählen</span>
            <input
              ref={feld}
              type="file"
              multiple
              hidden
              disabled={laeuft}
              onChange={(e) => {
                waehlen(e.target.files);
                // Geleert, damit dieselbe Datei noch einmal gewählt werden kann (sonst feuert `change` nicht).
                e.target.value = '';
              }}
            />
          </label>
          {auswahl.length > 0 && (
            <ul className={styles.auswahl}>
              {auswahl.map((a) => (
                <li key={a.schluessel}>
                  <div className={styles.auswahlKopf}>
                    <span className={styles.auswahlName}>{a.datei.name}</span>
                    <span className={styles.auswahlGroesse}>{dateiGroesse(a.datei.size)}</span>
                    {!laeuft && (
                      <button
                        type="button"
                        className={styles.weg}
                        aria-label={`„${a.datei.name}“ nicht hochladen`}
                        onClick={() =>
                          setAuswahl((alt) => alt.filter((x) => x.schluessel !== a.schluessel))
                        }
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                  {a.stand === 'laeuft' && (
                    <div
                      className={styles.balken}
                      role="progressbar"
                      aria-label={`„${a.datei.name}“ wird hochgeladen`}
                      aria-valuenow={Math.round(a.anteil * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <i style={{ width: `${Math.round(a.anteil * 100)}%` }} />
                      <span>{Math.round(a.anteil * 100)} %</span>
                    </div>
                  )}
                  {a.stand === 'fehler' && (
                    <p className={styles.zuGross} role="alert">
                      {a.meldung}
                    </p>
                  )}
                  {a.pruefung && a.stand !== 'fehler' && (
                    <p className={a.pruefung.art === 'fehler' ? styles.zuGross : styles.warnung}>
                      {a.pruefung.art === 'fehler'
                        ? `${a.pruefung.text} Diese Datei wird nicht hochgeladen.`
                        : `Es gibt hier schon eine Datei mit diesem Namen – beide liegen danach da.`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className={infos.hinweis}>
            Höchstens {DATEI_MAX_TEXT} je Datei. Größere Videos besser als Link anhängen.
          </p>
        </>
      ) : (
        <div className={styles.linkFelder}>
          <label className={infos.feld}>
            <span>Name</span>
            <input
              className={styles.eingabe}
              value={linkName}
              placeholder="z. B. Liedtexte"
              disabled={laeuft}
              onChange={(e) => setLinkName(e.target.value)}
            />
          </label>
          <label className={infos.feld}>
            <span>Adresse</span>
            <input
              className={styles.eingabe}
              type="url"
              inputMode="url"
              value={linkUrl}
              placeholder="https://…"
              disabled={laeuft}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </label>
          {linkUrl.trim() !== '' && adresse === null && (
            <p className={infos.hinweis}>Bitte die ganze Adresse angeben, mit https://</p>
          )}
          {fehler && (
            <p className={infos.fehler} role="alert">
              {fehler}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
