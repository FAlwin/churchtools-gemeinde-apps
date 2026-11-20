import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { darfEigenesHtml } from '@shared/website/zugang';
import type { Reiter } from '@ui/bedienung/ReiterLeiste';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Aussehen } from './Aussehen';
import { EinstellungenFenster } from './EinstellungenFenster';
import { EinstellungenProvider } from './EinstellungenQuelle';
import { Einrichtung } from './Einrichtung';
import { Hinweis, Leise } from './Hinweis';
import { Seiten } from './Seiten';
import { neueId } from './ids';
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
 * - sonst der Rahmen mit den Reitern **Seiten | Aussehen | Freigaben** (Freigaben kommt in einem späteren Schritt) und ganz rechts
 * **Einstellungen** (W3a-3b, ein Fenster).
 *
 * Reiter oben am Computer, unten am Handy – wie im Dienstplaner. Scheitert das Laden vorübergehend, gibt es „Erneut
 * versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [aktiv, setAktiv] = useState<ReiterId>('seiten');
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  /** Zählt gelungene Speicherungen der Einstellungen – „Seiten“ liest daraufhin die Einstellungen neu (W3a-3c). */
  const [einstellungenStand, setEinstellungenStand] = useState(0);
  const handy = useMedienAbfrage(HANDY_BREITE);
  /** Dieses Fenster – zwei Fenster derselben Person sperren sich gegenseitig (`shared/ct/sperre.ts`). */
  const fenster = useRef(neueId());
  const ich = useMemo(
    () => ({
      person: start?.ichId ?? 0,
      name: start?.name || start?.vorname || '',
      fenster: fenster.current,
    }),
    [start],
  );

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

  const bereiche = editor ? { reiter: REITER, aktiv, onWechsel: setAktiv } : undefined;

  return (
    <ErweiterungsSeite
      app="Website"
      zustand={zustand}
      onNochmal={laden}
      bereiche={bereiche}
      handy={handy}
      gruss={!editor}
      // „Einstellungen“ ist der letzte Reiter (E24) und öffnet ein Fenster – nur, wer die Website bearbeiten darf.
      einstellungen={
        editor && entwuerfe !== null
          ? { onOeffnen: () => setEinstellungenOffen(true), offen: einstellungenOffen }
          : undefined
      }
    >
      {start && !editor && <Zugangsseite start={start} onEingerichtet={laden} />}
      {editor && entwuerfe !== null && aktiv === 'seiten' && (
        <Seiten
          ort={{ modul: editor.modul, kategorie: entwuerfe }}
          gemeinde={editor.gemeinde}
          ich={ich}
          rechte={{ html: darfEigenesHtml(editor.zugang) }}
          einstellungenStand={einstellungenStand}
        />
      )}
      {/* EIN Zustand für die Einheit „einstellungen“: Aussehen und das Fenster teilen ihn (`EinstellungenQuelle`). Er steht
          nur, solange einer von beiden offen ist – danach ist die Sperre frei. */}
      {editor && entwuerfe !== null && (aktiv === 'aussehen' || einstellungenOffen) && (
        <EinstellungenProvider
          ort={{ modul: editor.modul, kategorie: entwuerfe }}
          gemeinde={editor.gemeinde}
          ich={ich}
          onGespeichert={() => setEinstellungenStand((n) => n + 1)}
        >
          {aktiv === 'aussehen' && <Aussehen />}
          {einstellungenOffen && (
            <EinstellungenFenster onSchliessen={() => setEinstellungenOffen(false)} />
          )}
        </EinstellungenProvider>
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
