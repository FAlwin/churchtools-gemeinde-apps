import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import type { Baustein } from '@shared/website/modell';
import { BausteinFelder, type FelderKontext } from './BausteinFelder';
import { BAUSTEIN_NAMEN } from './texte';
import styles from './Fenster.module.scss';

/**
 * **Fenster „Baustein bearbeiten“** (W3a-2): Die Felder je Typ (`BausteinFelder`), darunter „Entfernen“ (fragt nach),
 * „Abbrechen“ (stellt den Stand vor dem Öffnen wieder her) und „Fertig“ (prüft, dann wird gespeichert). Änderungen gehen
 * sofort an den Editor und sind in der Vorschau zu sehen; das Fenster hält den Baustein nicht selbst.
 *
 * „Eigenes HTML“ ändert nur, wer das darf (`kontext.htmlErlaubt`): sonst steht hier der Hinweis und „Fertig“ gibt es nicht –
 * nur Schließen.
 */
export function BausteinBearbeiten({
  baustein,
  kontext,
  meldungen,
  onAendern,
  onEntfernen,
  onFertig,
  onAbbrechen,
}: {
  baustein: Baustein;
  kontext: FelderKontext;
  meldungen: readonly string[];
  onAendern: (b: Baustein) => void;
  onEntfernen: () => void;
  onFertig: () => void;
  onAbbrechen: () => void;
}) {
  const gesperrt = baustein.typ === 'html' && !kontext.htmlErlaubt;
  return (
    <Sheet
      title={BAUSTEIN_NAMEN[baustein.typ]}
      onClose={onAbbrechen}
      onHintergrund={() => {}}
      onAbbrechen={onAbbrechen}
      cancelLabel={gesperrt ? 'Schließen' : 'Abbrechen'}
      links={
        gesperrt ? undefined : (
          <FensterKnopf art="loeschen" onClick={onEntfernen}>
            Entfernen
          </FensterKnopf>
        )
      }
      knoepfe={gesperrt ? null : <FensterKnopf onClick={onFertig}>Fertig</FensterKnopf>}
      mittel
    >
      <BausteinFelder baustein={baustein} kontext={kontext} onAendern={onAendern} />
      {meldungen.length > 0 && (
        <ul className={styles.meldungen} role="alert">
          {meldungen.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
