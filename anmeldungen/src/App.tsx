import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { tagAusIso } from '@shared/ct/zeit';
import { ladeStart } from './start';
import { ladeUebersicht } from './veranstaltungen';
import { anlegenMoeglich, istGruppenAdmin } from './einrichten';
import { datumText } from './anzeige';
import { Startseite } from './Startseite';
import { VeranstaltungSeite, type Reiter } from './VeranstaltungSeite';
import { NeueVeranstaltung } from './NeueVeranstaltung';
import { ArchivSeite } from './ArchivSeite';
import { GemeindeFenster } from './GemeindeFenster';
import { ErstEinrichten } from './ErstEinrichten';
import { formularAdresse } from './gemeinde';
import { RueckgaengigLeiste, type Aenderung } from './Rueckgaengig';
import { fehlerZustand, type Zustand } from './zustand';
import {
  ErweiterungsRahmen,
  ErweiterungsSeite,
  type SeitenZustand,
} from '@ui/erweiterung/ErweiterungsSeite';
import s from './Startseite.module.scss';

/**
 * Die Anmeldungen in ChurchTools: Wer angemeldet ist, seine Gruppen (#474, A1), deren Veranstaltungen
 * (#480, A2) und das Anlegen und Einrichten (#486, A3). Erst Person und Gruppen, dann Veranstaltungen und
 * Anlege-Rechte – scheitert eines vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 *
 * Welche Seite offen ist, steht in der Adresse (`#/v/91` = Veranstaltung 91, `#/archiv` = Archiv), damit
 * Neuladen und der Zurück-Knopf des Browsers funktionieren.
 *
 * Über jeder Seite steht nach einer Änderung die Leiste „Rückgängig“ (A4-Nachtrag) – auch nach einem
 * Seitenwechsel, denn nach dem Archivieren geht es zur Übersicht.
 */
type Ansicht =
  | { art: 'start' }
  | { art: 'veranstaltung'; id: number; reiter: Reiter }
  | { art: 'archiv' };

function ansichtAusAdresse(): Ansicht {
  // `#/v/91` = Reiter „Veranstaltung“, `#/v/91/formular` (A5), `#/v/91/anmeldungen` (A7). `…/gestaltung` war bis
  // zum Umbau am 13.10.2026 ein eigener Reiter – alte Lesezeichen landen im Baukasten, der die Gestaltung enthält.
  const m = /^#\/v\/(\d+)(?:\/(formular|gestaltung|anmeldungen))?$/.exec(window.location.hash);
  if (m)
    return {
      art: 'veranstaltung',
      id: Number(m[1]),
      reiter: m[2] === 'anmeldungen' ? 'anmeldungen' : m[2] ? 'formular' : 'veranstaltung',
    };
  if (window.location.hash === '#/archiv') return { art: 'archiv' };
  return { art: 'start' };
}

export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [ansicht, setAnsicht] = useState<Ansicht>(ansichtAusAdresse);
  const [neu, setNeu] = useState(false);
  const [einstellungen, setEinstellungen] = useState(false);
  const [aenderung, setAenderungRoh] = useState<(Aenderung & { nr: number }) | null>(null);
  // Jede Änderung bekommt eine neue Leiste – auch wenn der Text gleich lautet („Preise gespeichert.“).
  const setAenderung = (a: Aenderung | null) =>
    setAenderungRoh((alt) => (a ? { ...a, nr: (alt?.nr ?? 0) + 1 } : null));
  /** Zählt hoch, wenn die offene Seite neu laden soll (nach „Rückgängig“). */
  const [stand, setStand] = useState(0);
  const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const heute = tagAusIso(new Date().toISOString(), zeitzone);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart()
      .then(async (start) => {
        const teamIds = start.gruppen.map((g) => g.id);
        // Erst die Gruppenart: Die Übersicht erkennt daran Veranstaltungen, deren Einstellungen in
        // ChurchTools überschrieben wurden, und repariert sie (A5).
        const anlegen = await anlegenMoeglich(teamIds);
        const [uebersicht, admin, formular] = await Promise.all([
          ladeUebersicht(start.gruppen, new Date(), anlegen.artId),
          istGruppenAdmin(),
          formularAdresse(),
        ]);
        return { start, uebersicht, anlegen, admin, formular };
      })
      .then(
        (d) => setZustand({ art: 'fertig', ...d }),
        (e: unknown) => setZustand(fehlerZustand(e)),
      );
  }, []);

  useEffect(laden, [laden]);

  useEffect(() => {
    const folgen = () => setAnsicht(ansichtAusAdresse());
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);

  const oeffnen = (id: number) => {
    window.location.hash = `#/v/${id}`;
  };
  const zurUebersicht = () => {
    window.location.hash = '';
    laden();
  };

  const fertig = zustand.art === 'fertig' ? zustand : null;

  const leiste = aenderung && (
    <RueckgaengigLeiste
      key={aenderung.nr}
      aenderung={aenderung}
      onSchliessen={() => setAenderung(null)}
      onRueckgaengig={() => {
        // Die App merkt sich, dass zurückgenommen ist: Die Übersicht lädt gleich neu und baut die Leiste
        // dabei neu auf – sonst böte sie danach wieder „Rückgängig“ an (Durchklicken 13.10.2026).
        setAenderung({ text: 'Rückgängig gemacht.', rueckgaengig: null });
        if (ansicht.art === 'start') laden();
        else setStand((x) => x + 1);
      }}
    />
  );

  if (ansicht.art === 'veranstaltung') {
    return (
      <ErweiterungsRahmen>
        {leiste}
        <VeranstaltungSeite
          key={`${ansicht.id}-${stand}`}
          id={ansicht.id}
          reiter={ansicht.reiter}
          onReiter={(r) => {
            window.location.hash =
              r === 'veranstaltung' ? `#/v/${ansicht.id}` : `#/v/${ansicht.id}/${r}`;
          }}
          gemeinde={fertig?.start.gemeinde ?? null}
          formularAdresse={fertig?.formular ?? null}
          zeitzone={zeitzone}
          teams={fertig?.start.gruppen ?? []}
          onZurueck={zurUebersicht}
          onGeaendert={(a, weg) => {
            setAenderung(a);
            if (weg) zurUebersicht();
          }}
        />
      </ErweiterungsRahmen>
    );
  }

  if (ansicht.art === 'archiv') {
    return (
      <ErweiterungsRahmen>
        {leiste}
        {fertig?.anlegen.artId ? (
          <ArchivSeite
            key={stand}
            artId={fertig.anlegen.artId}
            onZurueck={zurUebersicht}
            onGeaendert={setAenderung}
          />
        ) : (
          <p>Wird geladen …</p>
        )}
      </ErweiterungsRahmen>
    );
  }

  const anlegeTeams = fertig
    ? fertig.start.gruppen.filter((g) => fertig.anlegen.teamIds.includes(g.id))
    : [];

  // Der Rahmen (Kopf, Laden, Fehlerkasten, Fuß) ist für alle Erweiterungen derselbe (`ui/erweiterung`).
  const seite: SeitenZustand =
    zustand.art === 'fertig'
      ? { art: 'fertig', vorname: zustand.start.vorname, gemeinde: zustand.start.gemeinde }
      : zustand.art === 'fehler'
        ? { art: 'fehler', fehler: { text: zustand.text, nochmal: zustand.nochmal } }
        : { art: 'laedt' };

  return (
    <ErweiterungsSeite
      app="Anmeldungen"
      zustand={seite}
      nebenGruss={datumText(heute)}
      onNochmal={laden}
      kopfAktion={
        <>
          {fertig?.admin && (
            <button type="button" className={s.neu} onClick={() => setEinstellungen(true)}>
              <Icon name="zahnrad" size={16} />
              Einstellungen
            </button>
          )}
          {anlegeTeams.length > 0 && fertig?.formular && (
            <button type="button" className={s.neu} onClick={() => setNeu(true)}>
              <Icon name="plus" size={18} />
              Neue Veranstaltung
            </button>
          )}
        </>
      }
      hinweis={
        fertig?.anlegen.artId === null &&
        'In dieser Gemeinde fehlt die Gruppenart „Anmeldung“ – ohne sie lassen sich keine Veranstaltungen anlegen. Wie man sie einrichtet, steht in der Anleitung der Erweiterung.'
      }
    >
      {leiste}
      {fertig && !fertig.formular && (
        <ErstEinrichten admin={fertig.admin} onEinstellungen={() => setEinstellungen(true)} />
      )}
      {fertig?.formular && (
        <Startseite
          start={fertig.start}
          uebersicht={fertig.uebersicht}
          heute={heute}
          zeitzone={zeitzone}
          onOeffnen={oeffnen}
          admin={fertig.admin}
          onArchiv={
            fertig.anlegen.artId !== null
              ? () => {
                  window.location.hash = '#/archiv';
                }
              : undefined
          }
        />
      )}

      {einstellungen && (
        <GemeindeFenster
          onClose={() => setEinstellungen(false)}
          onGespeichert={(text) => {
            setEinstellungen(false);
            setAenderung({ text, rueckgaengig: null });
            // Die Adresse der Formular-Seite schaltet die Erweiterung frei – also neu laden.
            laden();
          }}
        />
      )}
      {neu && fertig && fertig.anlegen.artId !== null && (
        <NeueVeranstaltung
          teams={anlegeTeams}
          artId={fertig.anlegen.artId}
          onClose={() => setNeu(false)}
          onFertig={(id) => {
            setNeu(false);
            oeffnen(id);
          }}
        />
      )}
    </ErweiterungsSeite>
  );
}
