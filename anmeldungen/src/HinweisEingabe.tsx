import { useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import {
  adresseGueltig,
  hinweisLinks,
  linkEntfernen,
  linkSetzen,
  type HinweisLink,
} from '@shared/anmeldung/hinweisLinks';
import k from './Baukasten.module.scss';

/**
 * **Der Hinweistext im Baukasten – mit Links** (F5b, Entwurf `f5b-links-v1`, Variante A, Alwin 17.11.2026): ein Wort
 * markieren, „Link“, Adresse eintragen. Im Feld steht der Link als `[Text](https://…)`, darunter die Liste der Links
 * mit „ändern“ und „entfernen“. Das Format kennt nur `hinweisLinks.ts`.
 */
export function HinweisEingabe({
  wert,
  onWert,
  maxLength,
}: {
  wert: string;
  onWert: (t: string) => void;
  maxLength: number;
}) {
  const feld = useRef<HTMLTextAreaElement>(null);
  /** Die Markierung im Feld – gemerkt, denn beim Klick auf „Link“ verliert das Feld den Fokus. */
  const [auswahl, setAuswahl] = useState<{ von: number; bis: number } | null>(null);
  /** Offenes Fenster: neue Markierung oder ein vorhandener Link. */
  const [fenster, setFenster] = useState<{ von: number; bis: number; link?: HinweisLink } | null>(
    null,
  );
  const links = hinweisLinks(wert);

  const merken = () => {
    const el = feld.current;
    if (!el) return;
    setAuswahl(
      el.selectionEnd > el.selectionStart ? { von: el.selectionStart, bis: el.selectionEnd } : null,
    );
  };

  return (
    <div className={k.hinweisEingabe}>
      <div className={k.hinweisWerkzeug}>
        <button
          type="button"
          className={k.linkKnopf}
          disabled={!auswahl}
          onClick={() => auswahl && setFenster(auswahl)}
        >
          <Icon name="link" size={14} /> Link
        </button>
        <span>
          {auswahl
            ? 'Markiert – jetzt „Link“ drücken.'
            : 'Für einen Link erst ein Wort markieren, dann „Link“.'}
        </span>
      </div>
      <textarea
        ref={feld}
        className={k.hilfe}
        value={wert}
        rows={3}
        maxLength={maxLength}
        aria-label="Hinweistext"
        placeholder="Hinweistext"
        onChange={(e) => onWert(e.target.value)}
        onSelect={merken}
        onKeyUp={merken}
        onMouseUp={merken}
      />
      {links.length > 0 && (
        <div className={k.linkListe}>
          <b>Links in diesem Hinweis</b>
          {links.map((l, i) => (
            <div key={i} className={k.linkZeile}>
              <a href={l.adresse} target="_blank" rel="noopener noreferrer">
                {l.text}
              </a>
              <code>{l.adresse}</code>
              <button type="button" onClick={() => setFenster({ von: l.von, bis: l.bis, link: l })}>
                ändern
              </button>
              <button type="button" onClick={() => onWert(linkEntfernen(wert, l))}>
                entfernen
              </button>
            </div>
          ))}
        </div>
      )}
      {fenster && (
        <LinkFenster
          text={fenster.link?.text ?? wert.slice(fenster.von, fenster.bis)}
          adresse={fenster.link?.adresse ?? ''}
          onEntfernen={
            fenster.link
              ? () => {
                  onWert(linkEntfernen(wert, fenster.link!));
                  setFenster(null);
                }
              : undefined
          }
          onUebernehmen={(text, adresse) => {
            const neu = linkSetzen(wert, fenster.von, fenster.bis, text, adresse);
            if (neu === null) return false;
            onWert(neu);
            setFenster(null);
            setAuswahl(null);
            return true;
          }}
          onClose={() => setFenster(null)}
        />
      )}
    </div>
  );
}

/** Das Fenster „Link“: angezeigter Text und Adresse – nur `https`. */
function LinkFenster({
  text: start,
  adresse: startAdresse,
  onUebernehmen,
  onEntfernen,
  onClose,
}: {
  text: string;
  adresse: string;
  onUebernehmen: (text: string, adresse: string) => boolean;
  onEntfernen?: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(start);
  const [adresse, setAdresse] = useState(startAdresse);
  const [fehler, setFehler] = useState<string | null>(null);
  const uebernehmen = () => {
    if (!text.trim()) return setFehler('Bitte einen Text für den Link eintragen.');
    if (!adresseGueltig(adresse))
      return setFehler('Bitte eine Adresse mit https:// eintragen, z. B. https://ecg-donrath.de.');
    if (!onUebernehmen(text, adresse)) setFehler('Der Link ließ sich nicht setzen.');
  };
  return (
    <Sheet
      title="Link"
      onClose={onClose}
      mittel
      links={
        onEntfernen ? (
          <FensterKnopf art="loeschen" onClick={onEntfernen}>
            Link entfernen
          </FensterKnopf>
        ) : undefined
      }
      knoepfe={<FensterKnopf onClick={uebernehmen}>Übernehmen</FensterKnopf>}
    >
      <div className={k.linkFenster}>
        <label>
          <span>Angezeigter Text</span>
          <input value={text} maxLength={120} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          <span>Adresse</span>
          <input
            value={adresse}
            inputMode="url"
            placeholder="https://…"
            autoFocus
            onChange={(e) => {
              setAdresse(e.target.value);
              setFehler(null);
            }}
          />
        </label>
        {fehler && (
          <p className={k.fehler} role="alert">
            {fehler}
          </p>
        )}
      </div>
    </Sheet>
  );
}
