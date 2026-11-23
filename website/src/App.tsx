import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { freigabeListe, freigabeZaehler } from '@shared/website/freigabe';
import { darfAussehenUndMenue, darfEigenesHtml, darfFreigeben } from '@shared/website/zugang';
import type { Reiter } from '@ui/bedienung/ReiterLeiste';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Aussehen } from './Aussehen';
import { EinstellungenFenster } from './EinstellungenFenster';
import { EinstellungenProvider } from './EinstellungenQuelle';
import { Einrichtung } from './Einrichtung';
import { Freigaben } from './Freigaben';
import { Hinweis, Leise } from './Hinweis';
import { RechteHinweis } from './RechteHinweis';
import { Seiten } from './Seiten';
import { ladeFreigaben } from './daten';
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
 * - eingerichtet, aber ohne Rechte an der Website (weder Admin noch Leitung/Redakteur nach den Rechten in ChurchTools) → Hinweis,
 *   wer die Website bearbeiten darf;
 * - sonst der Rahmen mit den Reitern **Seiten | Aussehen | Freigaben** und ganz rechts
 * **Einstellungen** (W3a-3b, ein Fenster). **Redakteure** (W3b-1) sehen nur „Seiten“ und „Freigaben“ – kein Aussehen, keine
 * Einstellungen (E-W22); Admins, die Rechte setzen dürfen, haben im Fenster „Einstellungen“ den Bereich „Wer darf was“.
 *
 * Reiter oben am Computer, unten am Handy – wie im Dienstplaner. Scheitert das Laden vorübergehend, gibt es „Erneut
 * versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [aktiv, setAktiv] = useState<ReiterId>('seiten');
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  /** Zählt, wie oft das Fenster „Einstellungen“ geschlossen wurde – die Prüfung der Rechte liest danach neu. */
  const [rechtePruefung, setRechtePruefung] = useState(0);
  /** Zählt gelungene Speicherungen der Einstellungen – „Seiten“ liest daraufhin die Einstellungen neu (W3a-3c). */
  const [einstellungenStand, setEinstellungenStand] = useState(0);
  /** Zählt Statuswechsel und Veröffentlichungen (W3b-2) – der Zähler am Reiter „Freigaben“ und dessen Liste lesen daraufhin neu. */
  const [freigabeStand, setFreigabeStand] = useState(0);
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

  // Aussehen und Einstellungen ändern die ganze Website (eigenes CSS wird unverändert übernommen) – nur Leitung und Admin (E-W22).
  const leitungsebene = darfAussehenUndMenue(editor?.zugang ?? null);
  const reiter = leitungsebene ? REITER : REITER.filter((r) => r.id !== 'aussehen');
  const reiterAktiv: ReiterId = !leitungsebene && aktiv === 'aussehen' ? 'seiten' : aktiv;
  const kategorien =
    editor?.einrichtung && entwuerfe !== null && editor.einrichtung.veroeffentlicht !== null
      ? { entwuerfe, veroeffentlicht: editor.einrichtung.veroeffentlicht }
      : null;
  const freigabeKategorien = editor && kategorien ? { modul: editor.modul, ...kategorien } : null;
  /** Die Website-Gruppe – an ihre Leitung gehen die Mails im Freigabe-Weg (W3b-3). Mit `kategorien` immer da. */
  const gruppe = editor?.einrichtung?.gruppe ?? null;
  // Entwurf und Online-Stand zusammen: für die Liste „Freigaben“ **und** den Zähler am Reiter. Neu gelesen wird beim Wechsel des
  // Reiters (so sieht man, was andere inzwischen eingereicht haben) und nach jeder Handlung (`freigabeStand`); die bisherigen
  // Daten bleiben stehen, bis neue da sind (vorübergehend ist nicht leer).
  const fModul = freigabeKategorien?.modul;
  const fEntwuerfe = freigabeKategorien?.entwuerfe;
  const fVeroeffentlicht = freigabeKategorien?.veroeffentlicht;
  const freigaben = useLaden(
    () =>
      fModul !== undefined && fEntwuerfe !== undefined && fVeroeffentlicht !== undefined
        ? ladeFreigaben({ modul: fModul, entwuerfe: fEntwuerfe, veroeffentlicht: fVeroeffentlicht })
        : null,
    // `freigabeStand` und `reiterAktiv` kommen im Aufruf nicht vor – sie sind nur der Anstoß zum Neulesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fModul, fEntwuerfe, fVeroeffentlicht, freigabeStand, reiterAktiv],
    { behalten: true },
  );
  const freigabeDaten = freigaben.stand.art === 'fertig' ? freigaben.stand.daten : null;
  const zaehler =
    editor?.zugang && freigabeDaten
      ? freigabeZaehler(
          freigabeListe(freigabeDaten.entwurf, freigabeDaten.online, editor.zugang, ich.person),
          editor.zugang,
        )
      : 0;
  const reiterMitZaehler = reiter.map((r) =>
    r.id === 'freigaben' && zaehler > 0
      ? {
          ...r,
          zaehler,
          zaehlerName: `Freigaben, ${zaehler} ${darfFreigeben(editor?.zugang ?? null) ? 'offen' : 'zurückgegeben'}`,
        }
      : r,
  );
  const bereiche = editor
    ? { reiter: reiterMitZaehler, aktiv: reiterAktiv, onWechsel: setAktiv }
    : undefined;
  const werDarfWas =
    editor?.darfRechteSetzen && editor.einrichtung && kategorien
      ? { gruppe: editor.einrichtung.gruppe, kategorien }
      : undefined;
  const schliesseEinstellungen = () => {
    setEinstellungenOffen(false);
    setRechtePruefung((n) => n + 1);
  };

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
        editor && entwuerfe !== null && leitungsebene
          ? { onOeffnen: () => setEinstellungenOffen(true), offen: einstellungenOffen }
          : undefined
      }
    >
      {start && !editor && <Zugangsseite start={start} onEingerichtet={laden} />}
      {werDarfWas && kategorien && (
        <RechteHinweis
          key={rechtePruefung}
          gruppe={werDarfWas.gruppe}
          gruppenName={editor?.einrichtung?.name ?? 'Website'}
          kategorien={kategorien}
          onOeffnen={() => setEinstellungenOffen(true)}
        />
      )}
      {editor && entwuerfe !== null && reiterAktiv === 'seiten' && (
        <Seiten
          ort={{ modul: editor.modul, kategorie: entwuerfe }}
          gemeinde={editor.gemeinde}
          ich={ich}
          rechte={{ html: darfEigenesHtml(editor.zugang), menue: leitungsebene }}
          einstellungenStand={einstellungenStand}
          freigabe={
            editor.zugang && kategorien && gruppe !== null
              ? {
                  zugang: editor.zugang,
                  veroeffentlicht: kategorien.veroeffentlicht,
                  gruppe,
                  onGeaendert: () => setFreigabeStand((n) => n + 1),
                }
              : undefined
          }
        />
      )}
      {/* EIN Zustand für die Einheit „einstellungen“: Aussehen und das Fenster teilen ihn (`EinstellungenQuelle`). Er steht
          nur, solange einer von beiden offen ist – danach ist die Sperre frei. */}
      {editor &&
        entwuerfe !== null &&
        leitungsebene &&
        (reiterAktiv === 'aussehen' || einstellungenOffen) && (
          <EinstellungenProvider
            ort={{ modul: editor.modul, kategorie: entwuerfe }}
            gemeinde={editor.gemeinde}
            ich={ich}
            onGespeichert={() => setEinstellungenStand((n) => n + 1)}
          >
            {reiterAktiv === 'aussehen' && <Aussehen />}
            {einstellungenOffen && (
              <EinstellungenFenster
                onSchliessen={schliesseEinstellungen}
                werDarfWas={werDarfWas}
                mail={{ modul: editor.modul, kategorie: entwuerfe }}
              />
            )}
          </EinstellungenProvider>
        )}
      {editor && editor.zugang && reiterAktiv === 'freigaben' && (
        <>
          {freigaben.stand.art === 'laedt' && <Leise>Die Freigaben werden geladen …</Leise>}
          {freigaben.stand.art === 'fehler' && (
            <FehlerKasten fehler={freigaben.stand.fehler} onNochmal={freigaben.neu} />
          )}
          {freigaben.stand.art === 'fertig' && freigaben.stand.neuFehler && (
            <FehlerKasten fehler={freigaben.stand.neuFehler} onNochmal={freigaben.neu} />
          )}
          {freigabeKategorien && freigabeDaten && gruppe !== null && (
            <Freigaben
              kategorien={freigabeKategorien}
              daten={freigabeDaten}
              zugang={editor.zugang}
              ich={ich}
              gemeinde={editor.gemeinde}
              gruppe={gruppe}
              onGeaendert={() => setFreigabeStand((n) => n + 1)}
            />
          )}
        </>
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
        {start.leitungOhneRechte ? (
          <>
            <p>Die Rechte für die Website sind noch nicht eingerichtet.</p>
            <Leise>
              Das macht ein Admin unter Einstellungen → „Wer darf was“. Danach kannst du die Website
              bearbeiten.
            </Leise>
          </>
        ) : (
          <>
            <p>
              Die Website bearbeiten dürfen die Admins und alle, die in der Gruppe „
              {start.einrichtung?.name ?? 'Website'}“ eine Rolle mit Zugriff auf die Website haben.
            </p>
            <Leise>Wenn du mitarbeiten möchtest, sprich bitte die Leitung dieser Gruppe an.</Leise>
          </>
        )}
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
