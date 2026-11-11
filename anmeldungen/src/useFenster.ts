import { useEffect, useRef, useState } from 'react';
import type { Absage, ListenAnmeldung } from '@shared/anmeldung/liste';
import { mailAnbieten } from './anzeige';
import type { FensterMeldung, FensterModus } from './AnmeldungAnsehen';
import type { VonHandFertig } from './VonHandFenster';

/**
 * **Welche Fenster im Reiter „Anmeldungen“ offen sind** (#845, Scheibe 4c-3: aus `AnmeldungenReiter` herausgezogen,
 * unverändert) – die Anmeldung (mit Rückfrage und der letzten Änderung samt „Rückgängig“), „Von Hand“, Zurückholen,
 * Rundmail und Druckliste. `fensterX` ist die Anmeldung im Fenster: auch dann noch, wenn sie nach einer Absage aus der
 * Liste fiel, solange „Rückgängig“ ansteht.
 */
export function useFenster({
  liste,
  darf,
  mitBestaetigung,
  startRundmail,
  onGespeichert,
}: {
  liste: ListenAnmeldung[];
  darf: boolean;
  mitBestaetigung: boolean;
  startRundmail: boolean;
  onGespeichert: () => void;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  // Die letzte Änderung im offenen Fenster – mit dem Fenster weg.
  const [meldung, setMeldung] = useState<FensterMeldung | null>(null);
  const [startModus, setStartModus] = useState<FensterModus>(null);
  // „Von Hand“ (A7-4a) – mit `dazu` zu einer bestehenden Anmeldung (A7-4b). Das Fenster der Anmeldung ist so lange zu
  // (kein Fenster im Fenster).
  const [vonHand, setVonHand] = useState<{ dazu: ListenAnmeldung | null } | null>(null);
  // Zurückholen (A7-4c) – `von`: die Anmeldung, in die „‹“ und „Abbrechen“ zurückführen; `vonHand`: dorthin, wenn es
  // aus „Anmeldung von Hand“ aufging (02.11.2026).
  const [zurueck, setZurueck] = useState<{
    b: Absage;
    von: string | null;
    vonHand?: { dazu: ListenAnmeldung | null };
  } | null>(null);
  const [rundmail, setRundmail] = useState(false);
  const rundmailGewuenscht = useRef(startRundmail);
  const [druck, setDruck] = useState(false);
  const oeffnen = (k: string | null, modus: FensterModus = null) => {
    setOffen(k);
    setStartModus(modus);
    setMeldung(null);
  };
  /** Aus „Person dazu“ zurück in die Anmeldung (oder, ohne sie, einfach zu). */
  const zurDazuAnmeldung = (dazu: ListenAnmeldung | null) => {
    if (dazu) oeffnen(dazu.schluessel);
    setVonHand(null);
  };
  // Hat die letzte Person einer Anmeldung abgesagt, ist sie aus der Liste weg – das Fenster bleibt für „Rückgängig“.
  const zuletztOffen = useRef<ListenAnmeldung | null>(null);

  // K1 (V6): Wie der Knopf „Rundmail“ – erst, wenn es jemanden gibt, an den sie gehen kann; dann genau einmal.
  useEffect(() => {
    if (!rundmailGewuenscht.current || !darf || liste.length === 0) return;
    rundmailGewuenscht.current = false;
    setRundmail(true);
  }, [darf, liste.length]);

  const ausgewaehlt = offen ? liste.find((x) => x.schluessel === offen) : undefined;
  if (ausgewaehlt) zuletztOffen.current = ausgewaehlt;
  // Weg aus der Liste (letzte Person abgesagt), aber eben geändert → das Fenster bleibt mit „Rückgängig“ stehen.
  const fensterX =
    ausgewaehlt ??
    (offen && meldung && zuletztOffen.current?.schluessel === offen ? zuletztOffen.current : null);

  /** Nach „Von Hand“, „Person dazu“ und „Zurückholen“: Die Anmeldung öffnet sich, sobald sie geladen ist. */
  const fertig = (x: VonHandFertig) => {
    setOffen(x.nr);
    setStartModus(null);
    setMeldung({
      aenderung: x.aenderung,
      mail: mailAnbieten('eintragen', mitBestaetigung, x.mail),
      hinweis: x.hinweis,
    });
    onGespeichert();
  };

  return {
    meldung,
    setMeldung,
    startModus,
    setStartModus,
    vonHand,
    setVonHand,
    zurueck,
    setZurueck,
    rundmail,
    setRundmail,
    druck,
    setDruck,
    oeffnen,
    zurDazuAnmeldung,
    fertig,
    ausgewaehlt,
    fensterX,
  };
}
