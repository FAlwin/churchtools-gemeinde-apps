import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { datumText } from '@shared/ct/datum';
import { kannEtwasKosten } from '@shared/anmeldung/preis';
import { loeschDatum } from '@shared/anmeldung/termin';
import { LoeschdatumVorbei, ablaeufeNachholen } from './ablaeufe';
import { anmeldungenIn, einstellungenVon } from './einrichten';
import { Fehler } from './Bearbeiten';
import { SofortLoeschenFrage } from './SofortLoeschenFrage';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';

/**
 * **„Mails und Löschen einrichten?“** (A9-5, F1/F2, Alwin 05.11.2026) – für Veranstaltungen, die vor A9-1 freigegeben
 * wurden: Bisher schickt ChurchTools seine Standard-Mail, und gelöscht wird nie. Ein Baustein für die Karte „Mails“ und
 * die Startseite. Schon Angemeldete bekommen keine neue Mail; liegt das Löschdatum zurück, fragt erst „Sofort löschen?“.
 */
export function EinrichtenFenster({
  id,
  onClose,
  onEingerichtet,
}: {
  id: number;
  onClose: () => void;
  onEingerichtet: (text: string) => void;
}) {
  const [stand, setStand] = useState<{
    anzahl: number;
    kostet: boolean;
    datum: string | null;
    erinnerung: boolean;
  } | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sofort, setSofort] = useState<LoeschdatumVorbei | null>(null);

  useEffect(() => {
    let aktuell = true;
    Promise.all([einstellungenVon(id), anmeldungenIn(id)]).then(
      ([e, anzahl]) =>
        aktuell &&
        setStand({
          anzahl,
          kostet: kannEtwasKosten(e.preis),
          datum: loeschDatum(e),
          erinnerung: !!e.erinnerungTage?.length,
        }),
      (x: unknown) => aktuell && setFehler(fehlerMeldung(x).text),
    );
    return () => {
      aktuell = false;
    };
  }, [id]);

  async function los(loeschenBestaetigt = false) {
    setArbeitet(true);
    setFehler(null);
    setSofort(null);
    try {
      await ablaeufeNachholen(id, { loeschenBestaetigt });
      onEingerichtet('Mails und Löschen eingerichtet.');
      return;
    } catch (x) {
      if (x instanceof LoeschdatumVorbei) setSofort(x);
      else setFehler(fehlerMeldung(x).text);
    }
    setArbeitet(false);
  }

  if (sofort)
    return (
      <SofortLoeschenFrage
        frage={sofort}
        wann="Beim Einrichten"
        knopf="Trotzdem einrichten"
        arbeitet={arbeitet}
        onWeiter={() => void los(true)}
        onZurueck={() => setSofort(null)}
        onClose={onClose}
      />
    );

  const gilt = stand?.erinnerung
    ? 'gelten die Erinnerung und das Löschdatum'
    : 'gilt das Löschdatum';
  return (
    <Sheet
      title="Mails und Löschen einrichten?"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf disabled={arbeitet || stand === null} onClick={() => void los()}>
          {arbeitet ? 'Wird eingerichtet …' : 'Jetzt einrichten'}
        </FensterKnopf>
      }
    >
      {stand === null && !fehler && <p className={f.hinweis}>Wird geladen …</p>}
      {stand && (
        <>
          <p>
            Ab jetzt schickt ChurchTools die Bestätigung
            {stand.kostet ? ' mit Betrag, Bankdaten und Link' : ' mit Link'} – seine Standard-Mail
            geht aus.
          </p>
          <p>
            {stand.anzahl === 0
              ? stand.datum
                ? `Gelöscht wird am ${datumText(stand.datum)}.`
                : 'Ohne Termin wird nicht gelöscht.'
              : `${
                  stand.anzahl === 1
                    ? 'Die eine schon angemeldete Person bekommt'
                    : `Die ${stand.anzahl} schon Angemeldeten bekommen`
                } keine neue Mail${
                  stand.datum
                    ? `, für sie ${gilt} (${datumText(stand.datum)}).`
                    : '. Ohne Termin wird nicht gelöscht.'
                }`}
          </p>
        </>
      )}
      <Fehler text={fehler} />
    </Sheet>
  );
}
