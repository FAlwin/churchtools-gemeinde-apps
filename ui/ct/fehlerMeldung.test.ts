import { describe, expect, it } from 'vitest';
import { ApiError, NichtUebernommen, Unklar } from './fehler';
import { ChurchToolsBremst } from './verbindung';
import { fehlerMeldung } from './fehlerMeldung';

/** Jeder Zweig einzeln – abgemeldet, vorübergehend und „ChurchTools hat Nein gesagt“ sind drei Dinge. */
describe('fehlerMeldung', () => {
  it('401 = abgemeldet: neu laden, KEIN „Erneut versuchen“', () => {
    const m = fehlerMeldung(new ApiError(401, 'Session abgelaufen'));
    expect(m.text).toContain('nicht mehr angemeldet');
    expect(m.nochmal).toBe(false);
  });

  it('5xx = vorübergehend: „antwortet gerade nicht“, mit „Erneut versuchen“', () => {
    expect(fehlerMeldung(new ApiError(502, 'x'))).toEqual({
      text: 'ChurchTools antwortet gerade nicht. Bitte versuch es gleich noch einmal.',
      nochmal: true,
    });
  });

  it('nicht übernommen (502 nach dem Nachlesen) sagt, WAS fehlt – nicht „antwortet gerade nicht“', () => {
    expect(fehlerMeldung(new NichtUebernommen('die Rechte der Rollen'))).toEqual({
      text: 'ChurchTools hat die Rechte der Rollen nicht übernommen. Bitte noch einmal versuchen.',
      nochmal: true,
    });
  });

  it('unklar (S5-2): die eigene Meldung, ohne „noch einmal versuchen“', () => {
    expect(fehlerMeldung(new Unklar('Bitte im Kalender nachsehen.'))).toEqual({
      text: 'Bitte im Kalender nachsehen.',
      nochmal: false,
    });
  });

  it('504 (Zeitüberschreitung) und gebremst sind vorübergehend', () => {
    expect(fehlerMeldung(new ApiError(504, 'x')).text).toContain('antwortet gerade nicht');
    expect(fehlerMeldung(new ChurchToolsBremst(3000)).text).toContain('antwortet gerade nicht');
  });

  it('keine Antwort (Netz) ist vorübergehend – nicht „kein Recht“', () => {
    const m = fehlerMeldung(new TypeError('Failed to fetch'));
    expect(m.text).toContain('antwortet gerade nicht');
    expect(m.nochmal).toBe(true);
  });

  it('403 = ChurchTools sagt Nein: dessen Meldung, nicht „antwortet nicht“', () => {
    expect(fehlerMeldung(new ApiError(403, 'Dafür fehlt dir das Recht.'))).toEqual({
      text: 'Dafür fehlt dir das Recht.',
      nochmal: true,
    });
  });
});
