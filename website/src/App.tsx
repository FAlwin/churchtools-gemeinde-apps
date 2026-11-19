import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Einrichtung } from './Einrichtung';
import { Hinweis, Leise } from './Hinweis';
import { Seiten } from './Seiten';
import { ladeStart, type Start } from './start';

type ReiterId = 'seiten' | 'aussehen' | 'freigaben';

const REITER: Reiter<ReiterId>[] = [
  { id: 'seiten', label: 'Seiten', icon: 'dokument' },
  { id: 'aussehen', label: 'Aussehen', icon: 'regler' },
  { id: 'freigaben', label: 'Freigaben', icon: 'check' },
];

/**
 * **Die Website in ChurchTools** (Bauplan Website W3a-1). Je nach Stand der Einrichtung und je nach Person:
 * - nicht eingerichtet, Admin → Einrichten (Gruppe wählen); sonst ein freundlicher Hinweis;
 * - eingerichtet, aber weder Admin noch Leitung der Gruppe → Hinweis, wer die Website bearbeiten darf;
 * - sonst der Rahmen mit den Reitern **Seiten | Aussehen | Freigaben** (die beiden letzten kommen in späteren Schritten).
 *
 * Reiter oben am Computer, unten am Handy – wie im Dienstplaner. Scheitert das Laden vorübergehend, gibt es „Erneut
 * versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [aktiv, setAktiv] = useState<ReiterId>('seiten');
  const handy = useMedienAbfrage(HANDY_BREITE);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then(
      (s) => {
        setStart(s);
        setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, []);

  useEffect(laden, [laden]);

  const editor = start?.stand === 'fertig' && start.zugang !== null ? start : null;
  const entwuerfe = editor?.einrichtung?.entwuerfe ?? null;

  const oben =
    editor && !handy ? (
      <Segment
        value={aktiv}
        options={REITER.map((r) => ({ value: r.id, label: r.label }))}
        onChange={setAktiv}
        ariaLabel="Bereiche"
        verbunden
      />
    ) : undefined;
  const unten =
    editor && handy ? (
      <ReiterLeiste reiter={REITER} aktiv={aktiv} onWechsel={setAktiv} />
    ) : undefined;

  return (
    <ErweiterungsSeite
      app="Website"
      zustand={zustand}
      onNochmal={laden}
      reiter={oben}
      unten={unten}
      gruss={!editor}
    >
      {start && !editor && <Zugangsseite start={start} onEingerichtet={laden} />}
      {editor && entwuerfe !== null && aktiv === 'seiten' && (
        <Seiten ort={{ modul: editor.modul, kategorie: entwuerfe }} gemeinde={editor.gemeinde} />
      )}
      {editor && aktiv === 'aussehen' && (
        <Hinweis titel="Aussehen">
          <Leise>
            Hier stellst du später Farben, Schriften und das Logo der Website ein. Das kommt in
            einem der nächsten Schritte.
          </Leise>
        </Hinweis>
      )}
      {editor && aktiv === 'freigaben' && (
        <Hinweis titel="Freigaben">
          <Leise>
            Hier gibst du später Seiten zur Veröffentlichung frei, und das Website-Team reicht
            Änderungen zur Prüfung ein. Das kommt in einem der nächsten Schritte.
          </Leise>
        </Hinweis>
      )}
    </ErweiterungsSeite>
  );
}

/** Was jemand sieht, der den Editor (noch) nicht bekommt. */
function Zugangsseite({ start, onEingerichtet }: { start: Start; onEingerichtet: () => void }) {
  if (start.stand === 'einrichten')
    return <Einrichtung start={start} onEingerichtet={onEingerichtet} />;
  if (start.stand === 'fertig')
    return (
      <Hinweis titel="Website">
        <p>
          Die Website bearbeiten dürfen die Admins und die Leitung der Gruppe „
          {start.einrichtung?.name ?? 'Website'}“.
        </p>
        <Leise>Wenn du mitarbeiten möchtest, sprich bitte die Leitung dieser Gruppe an.</Leise>
      </Hinweis>
    );
  return (
    <Hinweis titel="Website">
      <p>
        {start.stand === 'unvollstaendig'
          ? 'Die Website ist nur zum Teil eingerichtet. Bitte wende dich an einen Admin deiner Gemeinde.'
          : 'Die Website ist noch nicht eingerichtet, oder dir fehlt das Recht, sie zu sehen. Bitte wende dich an einen Admin deiner Gemeinde.'}
      </p>
    </Hinweis>
  );
}
