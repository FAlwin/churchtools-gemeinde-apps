import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './ChordEditor.module.scss';
import { ANDERE, KOPFANGABEN, TEILE, type Einfuegen } from '../utils/einfuegen';

interface Props {
  offen: boolean;
  umschalten: () => void;
  waehlen: (e: Einfuegen) => void;
  /** Gibt es die Liedinfo? Dann öffnen die Kopfangaben dort ihr Feld, sonst kommen sie in den Text. */
  mitLiedinfo: boolean;
}

// Knöpfe rund um den Text nehmen ihm den Fokus nicht – sonst ginge am iPad die Tastatur zu.
const ohneFokus = (e: React.MouseEvent) => e.preventDefault();

/**
 * **Menü „Einfügen“** (Lied-Editor L6, Variante B – Alwin, 24.10.2026): ersetzt das Format-Menü. Oben die Teile
 * (auch mit eigenem Namen), darunter der Pedal-Halt, die Kopfangaben der Liedinfo und abgesetzt „Nur für andere
 * Programme“ – alles, was das Format-Menü hatte, ist hier auffindbar (Alwin, 26.10.2026).
 */
export function EinfuegenMenue({ offen, umschalten, waehlen, mitLiedinfo }: Props) {
  return (
    <div className={styles.dd}>
      <button
        type="button"
        className={styles.ddBtn}
        onMouseDown={ohneFokus}
        onClick={umschalten}
        aria-expanded={offen}
      >
        Einfügen
        <Icon name="chev-down" size={16} stroke={2} />
      </button>
      {offen && <Inhalt waehlen={waehlen} mitLiedinfo={mitLiedinfo} />}
    </div>
  );
}

/** Der Inhalt – eigene Komponente, damit ein angefangener eigener Name beim Schließen verschwindet. */
function Inhalt({ waehlen, mitLiedinfo }: Pick<Props, 'waehlen' | 'mitLiedinfo'>) {
  const [eigen, setEigen] = useState<string | null>(null);
  const eigenFertig = (eigen ?? '').trim();
  return (
    <div className={`${styles.ddPanel} ${styles.ddPanelWide}`}>
      <div className={styles.ddKopf}>Neuer Teil</div>
      <div className={styles.ddTeile}>
        {TEILE.map((name) => (
          <button
            key={name}
            type="button"
            className={styles.ddFormat}
            onMouseDown={ohneFokus}
            onClick={() => waehlen({ art: 'teil', name })}
          >
            <span className={styles.ddFormatLabel}>{name}</span>
          </button>
        ))}
      </div>
      {eigen === null ? (
        <button
          type="button"
          className={styles.ddFormat}
          onMouseDown={ohneFokus}
          onClick={() => setEigen('')}
        >
          <span className={styles.ddFormatLabel}>Eigener Name …</span>
          <code className={styles.ddFormatTag}>comment</code>
        </button>
      ) : (
        <form
          className={styles.ddEigen}
          onSubmit={(e) => {
            e.preventDefault();
            if (eigenFertig) waehlen({ art: 'teil', name: eigenFertig });
          }}
        >
          <input
            className={styles.ddEigenFeld}
            aria-label="Name des Teils"
            placeholder="z. B. Tag, Instrumental, Gebet"
            value={eigen}
            maxLength={40}
            autoFocus
            onChange={(e) => setEigen(e.target.value)}
          />
          <button type="submit" className={styles.ddBtn} disabled={!eigenFertig}>
            Hinzufügen
          </button>
        </form>
      )}
      <div className={styles.ddTrenner} />
      <button
        type="button"
        className={styles.ddFormat}
        onMouseDown={ohneFokus}
        onClick={() => waehlen({ art: 'pedal' })}
      >
        <span className={styles.ddFormatLabel}>Pedal-Halt</span>
        <code className={styles.ddFormatTag}>----</code>
      </button>
      <div className={styles.ddTrenner} />
      <div className={styles.ddKopf}>Liedinfo</div>
      <p className={styles.ddHinweis}>
        {mitLiedinfo
          ? 'Steht in ChurchTools – ein Tipp öffnet das Feld in der Liedinfo.'
          : 'Kommt als Angabe in den Text.'}
      </p>
      {KOPFANGABEN.map((k) => (
        <button
          key={k.feld}
          type="button"
          className={styles.ddFormat}
          onMouseDown={ohneFokus}
          onClick={() => waehlen({ art: 'liedinfo', feld: k.feld, tag: k.tag })}
        >
          <span className={styles.ddFormatLabel}>{k.label}</span>
          <code className={styles.ddFormatTag}>{k.tag}</code>
        </button>
      ))}
      <div className={styles.ddTrenner} />
      <div className={styles.ddKopf}>Nur für andere Programme</div>
      <p className={styles.ddHinweis}>Wirkt nicht in dieser App. Kapo stellst du am Blatt ein.</p>
      {ANDERE.map((a) => (
        <button
          key={a.tag}
          type="button"
          className={styles.ddFormat}
          onMouseDown={ohneFokus}
          onClick={() => waehlen({ art: 'anderes', tag: a.tag, mitWert: a.mitWert })}
        >
          <span className={styles.ddFormatLabel}>{a.label}</span>
          <code className={styles.ddFormatTag}>{a.tag}</code>
        </button>
      ))}
    </div>
  );
}
