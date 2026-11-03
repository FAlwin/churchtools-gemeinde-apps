/**
 * **Die Dateien am Termin im Browser** (Scheiben T2a/T2b): der Anschluss für `shared/ct/terminDateien.ts` – die
 * ausführliche Liste frisch aus ChurchTools (mit Größe, die die Terminliste nicht mitliefert), Hochladen mit
 * Fortschritt (`ctHochladen`) und Schreiben über den gemeinsamen Schreiber.
 */
import { ctDaten, ctHochladen } from '@ui/ct/verbindung';
import { browserSchreiber, schreibFehler } from '@ui/ct/schreiber';
import { NichtUebernommen } from '@ui/ct/fehler';
import {
  dateiHochladen,
  dateiLoeschen,
  dateienAusListe,
  dateiUmbenennen,
  DATEI_NICHT_ANGEKOMMEN,
  DATEIEN_VERWEIGERT,
  linkAnhaengen,
  type TerminDatei,
  type TerminDateienPort,
} from '@shared/ct/terminDateien';

export async function ladeDateien(eventId: number): Promise<TerminDatei[]> {
  return dateienAusListe(await ctDaten<unknown>(`/files/service/${eventId}`));
}

const HOCHLADEN = { verweigert: DATEIEN_VERWEIGERT, fehler: 'Hochladen fehlgeschlagen' } as const;

const port: TerminDateienPort = {
  liste: ladeDateien,
  async hochladen(eventId, datei, fortschritt) {
    const form = new FormData();
    form.append('files[]', datei.inhalt, datei.name);
    try {
      return await ctHochladen(`/files/service/${eventId}`, form, {
        verweigert: HOCHLADEN.verweigert,
        fortschritt,
      });
    } catch (e) {
      // Dieselben Zweige wie beim Schreiben: Recht, Bremse, Zeit bleiben, wie sie sind; der Rest wird „… fehlgeschlagen“.
      throw schreibFehler(e, { method: 'POST', ...HOCHLADEN });
    }
  },
  schreibe: (pfad, auftrag) => browserSchreiber.schreibe(pfad, auftrag),
  // „Nicht angekommen“ als eigene Klasse – sonst machte `fehlerMeldung` aus dem 502 „ChurchTools antwortet gerade nicht“.
  fehler: (status, meldung) =>
    meldung === DATEI_NICHT_ANGEKOMMEN
      ? new NichtUebernommen('die Datei')
      : browserSchreiber.fehler(status, meldung),
};

export const dateienAendern = {
  hochladen: (eventId: number, datei: File, fortschritt: (anteil: number) => void) =>
    dateiHochladen(
      port,
      eventId,
      { name: datei.name, size: datei.size, inhalt: datei },
      fortschritt,
    ),
  link: (eventId: number, name: string, url: string) => linkAnhaengen(port, eventId, { name, url }),
  umbenennen: (eventId: number, fileId: number, eingabe: string) =>
    dateiUmbenennen(port, eventId, fileId, eingabe),
  loeschen: (eventId: number, fileId: number) => dateiLoeschen(port, eventId, fileId),
};
