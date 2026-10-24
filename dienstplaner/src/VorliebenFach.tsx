import { useEffect, useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import {
  BEZIEHUNG_TEXTE,
  HOECHSTENS_TEXTE,
  TAGESZEIT_TEXTE,
  type Vorliebe,
  type VorliebenGrund,
} from '@shared/dienstplan/vorlieben';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { vorliebenGrundText } from './vorliebenTexte';
import { CtSymbol } from './CtSymbol';
import styles from './VorliebenFach.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; grund: VorliebenGrund }
  | { art: 'bereit'; v: Vorliebe; gespeichert: Vorliebe; meldung: string | null; laeuft: boolean };

/**
 * **Der Stift – Vorlieben einer Person für eine Dienstgruppe** (Bauplan E5-3, Entwurf `e5-entwurf.html` Bild 4):
 * genau die drei Einstellungen aus ChurchTools. Gespeichert wird **sofort in ChurchTools** (wie die Plätze) und
 * nachgelesen; ohne Recht meldet ChurchTools zwar Erfolg, übernimmt aber nichts – das steht dann hier (gemessen
 * E5-3-0). Die Eingabe geht bei einem Fehler nie verloren. `onClose(true)`, wenn gespeichert wurde.
 */
export function VorliebenFach({
  person,
  gruppe,
  vorlieben,
  onClose,
}: {
  person: { id: number; name: string };
  gruppe: { id: number; name: string };
  vorlieben: EntwurfAnschluss['vorlieben'];
  onClose: (gespeichert: boolean) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    let aktuell = true;
    setZustand({ art: 'laedt' });
    void vorlieben.lesen(gruppe.id, person.id).then((r) => {
      if (!aktuell) return;
      setZustand(
        r.ok
          ? { art: 'bereit', v: r.vorliebe, gespeichert: r.vorliebe, meldung: null, laeuft: false }
          : { art: 'fehler', grund: r.grund },
      );
    });
    return () => {
      aktuell = false;
    };
  }, [vorlieben, gruppe.id, person.id, versuch]);

  const setze = (teil: Partial<Vorliebe>) =>
    setZustand((z) => (z.art === 'bereit' ? { ...z, v: { ...z.v, ...teil }, meldung: null } : z));

  const speichern = async () => {
    if (zustand.art !== 'bereit' || zustand.laeuft) return;
    const v = zustand.v;
    setZustand({ ...zustand, laeuft: true, meldung: null });
    const r = await vorlieben.speichern(gruppe.id, person.id, v);
    if (r.ok) onClose(true);
    else
      setZustand((z) =>
        z.art === 'bereit' ? { ...z, laeuft: false, meldung: vorliebenGrundText(r.grund) } : z,
      );
  };

  const bereit = zustand.art === 'bereit' ? zustand : null;
  const unveraendert =
    !!bereit &&
    bereit.v.hoechstens === bereit.gespeichert.hoechstens &&
    bereit.v.beziehung === bereit.gespeichert.beziehung &&
    bereit.v.tageszeit === bereit.gespeichert.tageszeit;

  return (
    <Sheet
      title={`Vorlieben · ${person.name}`}
      onClose={() => !bereit?.laeuft && onClose(false)}
      beschaeftigt={!!bereit?.laeuft}
      knoepfe={
        bereit ? (
          <FensterKnopf disabled={bereit.laeuft || unveraendert} onClick={() => void speichern()}>
            {bereit.laeuft ? 'Wird gespeichert …' : 'Speichern'}
          </FensterKnopf>
        ) : null
      }
    >
      <p className={styles.unter}>für {gruppe.name} · wie der Stift in ChurchTools</p>
      {zustand.art === 'laedt' && <p className={styles.hinweis}>Vorlieben werden geladen …</p>}
      {zustand.art === 'fehler' && (
        <div className={styles.kasten}>
          {vorliebenGrundText(zustand.grund)}{' '}
          {zustand.grund === 'voruebergehend' && (
            <button type="button" className={styles.link} onClick={() => setVersuch((x) => x + 1)}>
              Erneut versuchen
            </button>
          )}
        </div>
      )}
      {bereit && (
        <>
          <label className={styles.feld}>
            <span>Wie oft höchstens?</span>
            <select
              aria-label="Wie oft höchstens?"
              value={bereit.v.hoechstens}
              disabled={bereit.laeuft}
              onChange={(e) =>
                setze({ hoechstens: Number(e.target.value) as Vorliebe['hoechstens'] })
              }
            >
              {HOECHSTENS_TEXTE.map((t, i) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
            </select>
            <small>„nie“ = wird nicht mehr vorgeschlagen.</small>
          </label>
          <label className={styles.feld}>
            <span>Tageszeit</span>
            <select
              aria-label="Tageszeit"
              value={bereit.v.tageszeit}
              disabled={bereit.laeuft}
              onChange={(e) =>
                setze({ tageszeit: Number(e.target.value) as Vorliebe['tageszeit'] })
              }
            >
              {TAGESZEIT_TEXTE.map((t, i) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
            </select>
            <small>
              „nur“ schließt die andere Tageszeit aus, „eher“ verschiebt nur die Reihenfolge.
            </small>
          </label>
          <label className={styles.feld}>
            <span>Mit Ehepartner</span>
            <select
              aria-label="Mit Ehepartner"
              value={bereit.v.beziehung}
              disabled={bereit.laeuft}
              onChange={(e) =>
                setze({ beziehung: Number(e.target.value) as Vorliebe['beziehung'] })
              }
            >
              {BEZIEHUNG_TEXTE.map((t, i) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
            </select>
            <small>
              Wirkt nur, wenn in ChurchTools eine <b>Ehepaar</b>-Beziehung eingetragen ist
              (Eltern/Kind zählt nicht).
            </small>
          </label>
          {bereit.meldung && <div className={styles.kasten}>{bereit.meldung}</div>}
          <p className={styles.hinweis}>Gespeichert wird sofort in ChurchTools – kein Entwurf.</p>
        </>
      )}
    </Sheet>
  );
}

/**
 * Der Stift neben einem Namen (E5-3) – das Symbol aus ChurchTools (`fa-pen`, Alwin 16.10.2026), wie im
 * ChurchTools-Zauberstab neben der Auswahl. Eine Stelle für das Zauberstab-Fenster und „Wer kann?“.
 */
export function StiftKnopf({
  name,
  onKlick,
  disabled = false,
}: {
  name: string;
  onKlick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.stift}
      onClick={onKlick}
      disabled={disabled}
      aria-label={`Vorlieben von ${name}`}
      title={`Vorlieben von ${name}`}
    >
      <CtSymbol name="pen" size={13} />
    </button>
  );
}
