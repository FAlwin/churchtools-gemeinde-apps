import { useState } from 'react';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { anzahlFehlerText, mitnehmenText, plaetzeText } from './plaetzeTexte';
import type { PlaetzeZeile } from './PlaetzeFach';

/**
 * **Die Plätze eines Dienstes ändern – eine Stelle für das Gruppen-Fach (`PlaetzeFach`) und das Fenster eines einzelnen
 * Dienstes in „Personen“ (`PlatzFenster`, P2c).** Jeder Tipp wird sofort gespeichert und nachgelesen (`aendern` →
 * `anzahlAendern`); die Zahl im Fenster ist, was ChurchTools nachgelesen hat – bei einem Fehlschlag, was jetzt dasteht
 * (damit der nächste Tipp vom richtigen Stand ausgeht); gingen Entwürfe bei einer Änderung nicht mit, steht das als Meldung
 * da (`mitnehmenText`). `gesperrt`: von außen gesperrt (z. B. läuft eine Vorlage).
 */
export function useAnzahlSetzen({
  zeilen,
  aendern,
  onGespeichert,
  gesperrt = false,
}: {
  zeilen: readonly PlaetzeZeile[];
  aendern: (z: PlaetzeZeile, gesehen: number, neu: number) => Promise<AnzahlErgebnis>;
  onGespeichert: (text: string) => void;
  gesperrt?: boolean;
}) {
  const [anzahl, setAnzahl] = useState(() => new Map(zeilen.map((z) => [z.serviceId, z.anzahl])));
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const beschaeftigt = laeuft !== null || gesperrt;

  /** Einen Dienst auf `neu` Plätze stellen. */
  const setze = async (z: PlaetzeZeile, neu: number) => {
    if (beschaeftigt) return;
    const gesehen = anzahl.get(z.serviceId) ?? z.anzahl;
    setLaeuft(z.serviceId);
    setMeldung(null);
    const r = await aendern(z, gesehen, neu);
    setLaeuft(null);
    if (r.ok) {
      setAnzahl((alt) => new Map(alt).set(z.serviceId, r.anzahl));
      setGeaendert(true);
      onGespeichert(`${z.name}: jetzt ${plaetzeText(r.anzahl)}.`);
      // Die Zahl gilt – gingen Entwürfe aber nicht mit, steht das daneben (und der Aufrufer lädt neu).
      const offen = mitnehmenText(r);
      if (offen) setMeldung(`${z.name}: ${offen}`);
      return;
    }
    // Was jetzt dasteht, gilt – damit der nächste Tipp vom richtigen Stand ausgeht.
    if (r.jetzt !== undefined) {
      const jetzt = r.jetzt;
      setAnzahl((alt) => new Map(alt).set(z.serviceId, jetzt));
      if (jetzt !== gesehen) setGeaendert(true);
    }
    setMeldung(`${z.name}: ${anzahlFehlerText(r)}`);
  };

  return {
    anzahl,
    setAnzahl,
    laeuft,
    geaendert,
    setGeaendert,
    meldung,
    setMeldung,
    beschaeftigt,
    setze,
  };
}
