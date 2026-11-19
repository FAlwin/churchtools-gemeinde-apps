import { useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { Hinweis, Leise } from './Hinweis';
import { einrichten, ladeGruppen } from './einrichten';
import type { Start } from './start';
import styles from './Einrichtung.module.scss';

/**
 * **Noch nicht (ganz) eingerichtet** (Bauplan Website W3a-1). Ein Admin wählt die Gruppe „Website“ und richtet mit einem
 * Knopf ein; fehlt nur eine der beiden Kategorien (ein früherer Versuch ist abgebrochen), ergänzt der Knopf sie – die
 * Gruppe steht dann schon fest. Wer nicht einrichten darf, sieht einen freundlichen Hinweis (`App.tsx`).
 */
export function Einrichtung({
  start,
  onEingerichtet,
}: {
  start: Start;
  /** Nach dem Einrichten neu laden – die Seite liest die Kategorien dann frisch aus ChurchTools. */
  onEingerichtet: () => void;
}) {
  const vorhanden = start.einrichtung;
  const gruppen = useLaden(() => (vorhanden ? null : ladeGruppen()), [vorhanden]).stand;
  const liste = gruppen.art === 'fertig' ? gruppen.daten : [];
  const vorschlag = liste.find((g) => g.name.trim().toLowerCase() === 'website')?.id ?? null;
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);

  const gruppeId = vorhanden?.gruppe ?? gewaehlt ?? vorschlag;
  const gruppe = vorhanden
    ? { id: vorhanden.gruppe, name: vorhanden.name ?? `Gruppe ${vorhanden.gruppe}` }
    : liste.find((g) => g.id === gruppeId);

  const los = () => {
    if (!gruppe) return;
    setLaeuft(true);
    setFehler(null);
    einrichten(start.modul, gruppe).then(
      () => {
        setLaeuft(false);
        onEingerichtet();
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  return (
    <Hinweis titel="Website einrichten">
      <p>
        {vorhanden
          ? 'Die Website ist nur zum Teil eingerichtet – es fehlt noch ein Bereich für ihre Daten.'
          : 'Die Website ist noch nicht eingerichtet.'}
      </p>
      <Leise>
        Beim Einrichten legt die Erweiterung zwei Bereiche für ihre Daten an: „Entwürfe“ und
        „Veröffentlicht“. Wer die Website bearbeiten darf, richtet sich nach der Gruppe, die du hier
        wählst: Admins und die Leitung dieser Gruppe. Die Rechte an den Bereichen vergibst du danach
        in ChurchTools.
      </Leise>
      {vorhanden ? (
        <p>
          Gruppe: <strong>{gruppe?.name}</strong>
        </p>
      ) : (
        <>
          {gruppen.art === 'laedt' && <Leise>Gruppen werden geladen …</Leise>}
          {gruppen.art === 'fehler' && (
            <FehlerKasten fehler={gruppen.fehler} onNochmal={onEingerichtet} />
          )}
          {gruppen.art === 'fertig' && (
            <label className={styles.feld}>
              <span>Gruppe „Website“</span>
              <select
                className={styles.eingabe}
                value={gruppeId ?? ''}
                disabled={laeuft}
                onChange={(e) => setGewaehlt(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">Gruppe wählen …</option>
                {liste.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {gruppen.art === 'fertig' && vorschlag === null && (
            <Leise>
              Tipp: Lege in ChurchTools eine Gruppe „Website“ an, in der das Website-Team
              mitarbeitet – die Leitung dieser Gruppe darf die Website bearbeiten.
            </Leise>
          )}
        </>
      )}
      <div className={styles.knoepfe}>
        <FensterKnopf disabled={laeuft || !gruppe} onClick={los}>
          <Icon name="check" size={16} />
          {laeuft ? 'Wird eingerichtet …' : 'Einrichten'}
        </FensterKnopf>
      </div>
      {fehler && <FehlerKasten fehler={fehler} onNochmal={los} />}
    </Hinweis>
  );
}
