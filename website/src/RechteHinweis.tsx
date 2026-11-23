import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useLaden } from '@ui/ct/useLaden';
import type { Kategorien } from '@shared/website/rechte';
import { Hinweis, Leise } from './Hinweis';
import { pruefeRechte } from './rechte';

/**
 * **Prüfung beim Start – nur für Admins, die Rechte setzen dürfen** (Bauplan Website W3b-1, Muster der Protokolle): Haben die
 * Rollen der Gruppe nicht die Rechte, die ihre Stufe verspricht (oder gar keine), oder gibt es eine Untergruppe, die noch nicht
 * eingerichtet ist bzw. deren Rechte abweichen (W3b-4a), erscheint ein ruhiger Hinweis mit dem Weg zu „Wer darf was“. Ist alles in Ordnung, oder lässt sich das nicht lesen, erscheint nichts (ein Hinweis soll nie wegen eines
 * Aussetzers kommen). Wird das Fenster „Einstellungen“ geschlossen, setzt die App den `key` neu – dann wird frisch gelesen.
 */
export function RechteHinweis({
  gruppe,
  gruppenName,
  kategorien,
  onOeffnen,
}: {
  gruppe: number;
  gruppenName: string;
  kategorien: Kategorien;
  onOeffnen: () => void;
}) {
  // Die Nummern einzeln (nicht das Objekt): `kategorien` ist bei jedem Zeichnen ein neues Objekt – das lüde sonst endlos neu.
  const { entwuerfe, veroeffentlicht } = kategorien;
  const g = useLaden(
    () => pruefeRechte(gruppe, { entwuerfe, veroeffentlicht }),
    [gruppe, entwuerfe, veroeffentlicht],
  );
  const hinweis = g.stand.art === 'fertig' ? g.stand.daten : null;
  if (!hinweis) return null;
  return (
    <Hinweis titel="Rechte der Website">
      {hinweis.art === 'nichts' && (
        <p>
          Für die Rollen der Gruppe „{gruppenName}“ sind noch keine Rechte an der Website
          eingerichtet. Solange das so ist, kann nur ein Admin sie bearbeiten.
        </p>
      )}
      {hinweis.art === 'abweicht' && (
        <p>
          Bei {hinweis.rollen.length === 1 ? 'dieser Rolle' : 'diesen Rollen'} stimmen die Rechte in
          ChurchTools nicht mit der Stufe überein: {hinweis.rollen.join(', ')}.
        </p>
      )}
      {(hinweis.untergruppen ?? []).map((u) => (
        <p key={u.name}>
          {u.art === 'nicht-eingerichtet' ? (
            <>Die Untergruppe „{u.name}“ ist noch nicht eingerichtet.</>
          ) : (
            <>
              In der Untergruppe „{u.name}“ weichen die Rechte ab: {u.rollen.join(', ')}.
            </>
          )}
        </p>
      ))}
      <Leise>Unter Einstellungen → „Wer darf was“ lässt sich das mit einem Klick richten.</Leise>
      <div>
        <FensterKnopf art="zweit" onClick={onOeffnen}>
          Wer darf was
        </FensterKnopf>
      </div>
    </Hinweis>
  );
}
