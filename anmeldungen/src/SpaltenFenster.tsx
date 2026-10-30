import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Icon } from '@ui/icons/icons';
import type { OeffentlicheEinstellungen, TabellenWahl } from '@shared/anmeldung/formular';
import {
  spalteAnheften,
  spaltenGruppen,
  spaltenKatalog,
  spalteVerschieben,
  spalteZeigen,
  vorgabeWahl,
  type TabellenModus,
} from '@shared/anmeldung/tabelle';
import a from './AnmeldungenReiter.module.scss';
import f from './SpaltenFenster.module.scss';

const GRUPPEN = [
  { k: 'fest', titel: 'Angeheftet' },
  { k: 'sichtbar', titel: 'Sichtbar' },
  { k: 'aus', titel: 'Ausgeblendet' },
] as const;

/**
 * **Spalten wählen** (U2-3, Entwurf `u2-tabelle-v1`, abgenommen 29.10.2026) – je Ansicht (je Anmeldung, je Person):
 * Häkchen zeigt eine Spalte, Pfeile ordnen, die Stecknadel heftet sie links an (mehrere, in der Reihenfolge des
 * Anheftens; am Handy bleibt nur die erste stehen). Die Regeln stehen in `@shared/anmeldung/tabelle`; das Fenster
 * zeichnet nur. Gemerkt wird beim Übernehmen – für alle im Team, wenn man die Veranstaltung bearbeiten darf.
 */
export function SpaltenFenster({
  e,
  modus,
  wahl,
  darf,
  onUebernehmen,
  onClose,
}: {
  e: OeffentlicheEinstellungen;
  modus: TabellenModus;
  wahl: TabellenWahl;
  /** Darf die Veranstaltung bearbeiten – sonst gilt die Wahl nur bis zum Neuladen (wie bei der Druckliste). */
  darf: boolean;
  onUebernehmen: (w: TabellenWahl) => void;
  onClose: () => void;
}) {
  const [w, setW] = useState(wahl);
  const titel = new Map(spaltenKatalog(e, modus).map((s) => [s.schluessel, s.titel]));
  const gruppen = spaltenGruppen(w);
  const sichtbar = gruppen.fest.length + gruppen.sichtbar.length;

  return (
    <Sheet
      title={`Spalten – ${modus === 'person' ? 'je Person' : 'je Anmeldung'}`}
      onClose={onClose}
      links={
        <FensterKnopf art="hell" onClick={() => setW(vorgabeWahl(e, modus))}>
          Wie zu Beginn
        </FensterKnopf>
      }
      knoepfe={<FensterKnopf onClick={() => onUebernehmen(w)}>Übernehmen</FensterKnopf>}
    >
      <p className={a.unterTitel}>
        Das Häkchen zeigt eine Spalte, die Stecknadel heftet sie links an – mehrere sind möglich, in
        der Reihenfolge des Anheftens. Am Handy bleibt nur die erste stehen.{' '}
        {darf
          ? 'Gilt für alle im Team.'
          : 'Du darfst die Veranstaltung nicht bearbeiten – die Wahl gilt nur hier, bis die Seite neu lädt.'}
      </p>
      {GRUPPEN.filter((g) => gruppen[g.k].length > 0).map((g) => (
        <section key={g.k} className={a.teil} aria-label={g.titel}>
          <h3>{g.titel}</h3>
          {gruppen[g.k].map((k, i, liste) => {
            const name = titel.get(k) ?? k;
            const fest = g.k === 'fest';
            const an = g.k !== 'aus';
            return (
              <div key={k} className={f.zeile}>
                <label className={f.wahl}>
                  <input
                    type="checkbox"
                    checked={an}
                    // Angeheftet heißt sichtbar – erst die Nadel lösen. Die letzte sichtbare Spalte bleibt.
                    disabled={fest || (an && sichtbar <= 1)}
                    onChange={() => setW(spalteZeigen(w, k))}
                  />
                  <span>{name}</span>
                </label>
                {fest && <span className={f.nummer}>{i + 1}.</span>}
                <ZeilenKnopf
                  label={`„${name}“ nach oben`}
                  title="Nach oben"
                  disabled={!an || i === 0}
                  onClick={() => setW(spalteVerschieben(w, k, -1))}
                >
                  <Icon name="chev-up" size={16} />
                </ZeilenKnopf>
                <ZeilenKnopf
                  label={`„${name}“ nach unten`}
                  title="Nach unten"
                  disabled={!an || i === liste.length - 1}
                  onClick={() => setW(spalteVerschieben(w, k, 1))}
                >
                  <Icon name="chev-down" size={16} />
                </ZeilenKnopf>
                <ZeilenKnopf
                  label={fest ? `„${name}“ nicht mehr anheften` : `„${name}“ anheften`}
                  title={fest ? 'Nicht mehr anheften' : 'Anheften – bleibt links stehen'}
                  an={fest}
                  onClick={() => setW(spalteAnheften(w, k))}
                >
                  <Icon name="nadel" size={16} />
                </ZeilenKnopf>
              </div>
            );
          })}
        </section>
      ))}
    </Sheet>
  );
}
