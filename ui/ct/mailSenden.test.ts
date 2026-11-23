import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from './verbindung';
import { ApiError } from './fehler';
import { UnklarObVerschickt, mailSenden } from './mailSenden';

/**
 * Mails senden (A7-5, seit W3b-3 der gemeinsame Baustein) gegen ein nachgestelltes ChurchTools – wie am 22.10.2026
 * gemessen: `sendEMailToPersonIds` antwortet `success`, das Protokoll schreibt je Mail
 * „Speichere Mail an <Adresse> von … - <Betreff>“. **Diese Tests sind die der früheren `rundmailSenden`, Erwartungen
 * unverändert** – dazu die neuen Fälle (Empfänger ohne Adresse, Meldung bei „unklar“).
 */
vi.mock('./verbindung', async (original) => ({
  ...(await original<typeof import('./verbindung')>()),
  ctAltAnfrage: vi.fn(),
  ctDaten: vi.fn(),
}));
const ct = vi.mocked(V);

const AN = [
  { personId: 10, email: 'friesen.alwin+a7n@ecg-donrath.de' },
  { personId: 20, email: 'Friesen.Alwin+a7h@ecg-donrath.de' },
];
const jetzt = () => new Date().toISOString();
const eintrag = (mail: string, date = jetzt()) => ({
  date,
  message: `Speichere Mail an ${mail} von Alwin Friesen <friesen.alwin@ecg-donrath.de> - Test`,
});

beforeEach(() => {
  vi.clearAllMocks();
  ct.ctAltAnfrage.mockResolvedValue(null);
  ct.ctDaten.mockResolvedValue([
    eintrag('friesen.alwin+a7n@ecg-donrath.de'),
    eintrag('friesen.alwin+a7h@ecg-donrath.de'),
    // Älter als das Senden – zählt nicht.
    eintrag('friesen.alwin+a7n@ecg-donrath.de', '2026-10-01T10:00:00Z'),
  ]);
});

describe('Meldung bei verweigertem Senden', () => {
  it('ohne Angabe die bisherige Meldung, mit Angabe die des Aufrufers (Nachweise sagen es anders)', async () => {
    await mailSenden(165, AN, 'Test', '<p>Hallo</p>');
    expect(ct.ctAltAnfrage.mock.calls[0][2]).toEqual({
      verweigert: 'Mails über ChurchTools schicken darfst du hier nicht.',
    });
    ct.ctAltAnfrage.mockClear();
    await mailSenden(165, AN, 'Test', '<p>Hallo</p>', { verweigert: 'Eigene Meldung.' });
    expect(ct.ctAltAnfrage.mock.calls[0][2]).toEqual({ verweigert: 'Eigene Meldung.' });
  });
});

describe('Senden', () => {
  it('eine Anfrage mit allen Personen und der Gruppe; im Protokoll nachgelesen (Groß-/Kleinschreibung egal)', async () => {
    await expect(mailSenden(165, AN, 'Test', '<p>Hallo</p>')).resolves.toEqual({
      bestaetigt: 2,
    });
    expect(ct.ctAltAnfrage).toHaveBeenCalledWith('sendEMailToPersonIds', {}, expect.anything(), {
      modul: 'churchhome',
      json: {
        ids: '10,20',
        betreff: 'Test',
        inhalt: '<p>Hallo</p>',
        attachments: '',
        domain_id: null,
        group_id: 165,
        template_id: null,
      },
    });
  });

  it('eine Adresse steht nur mit einem alten Eintrag im Protokoll → zählt nicht', async () => {
    ct.ctDaten.mockResolvedValue([
      eintrag('friesen.alwin+a7n@ecg-donrath.de'),
      eintrag('friesen.alwin+a7h@ecg-donrath.de', '2026-10-01T10:00:00Z'),
    ]);
    await expect(mailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: 1 });
  });

  it('Protokoll nicht lesbar (Recht, Aussetzer) → verschickt, aber unbestätigt – kein Fehler', async () => {
    ct.ctDaten.mockRejectedValue(new ApiError(403, 'verboten'));
    await expect(mailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: null });
    ct.ctDaten.mockRejectedValue(new ApiError(504, 'Zeit'));
    await expect(mailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: null });
  });

  it('abgelehnt oder gebremst → sicher nicht verschickt, Fehler kommt an, kein Nachlesen', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new V.AltFehler(502, 'Keine Empfänger', 'abgelehnt'));
    await expect(mailSenden(165, AN, 'Test', '')).rejects.toMatchObject({
      status: 422,
      message: 'ChurchTools hat die Mails nicht angenommen: Keine Empfänger',
    });
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(403, 'verboten'));
    await expect(mailSenden(165, AN, 'Test', '')).rejects.toMatchObject({ status: 403 });
    ct.ctAltAnfrage.mockRejectedValue(new V.ChurchToolsBremst(5000));
    await expect(mailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(V.ChurchToolsBremst);
    expect(ct.ctDaten).not.toHaveBeenCalled();
  });

  it('keine Antwort beim Senden: steht es im Protokoll → verschickt; sonst „unklar“ statt „noch einmal“', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(504, 'Zeitgrenze'));
    await expect(mailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: 2 });
    ct.ctDaten.mockResolvedValue([]);
    await expect(mailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
    ct.ctAltAnfrage.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(mailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
    // Unlesbare Antwort (z. B. eine HTML-Seite) – ob es lief, weiß niemand.
    ct.ctAltAnfrage.mockRejectedValue(new V.AltFehler(502, 'unlesbar', 'unlesbar'));
    await expect(mailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
  });

  it('niemand ausgewählt → nichts geschickt', async () => {
    await expect(mailSenden(165, [], 'Test', '')).rejects.toMatchObject({ status: 422 });
    expect(ct.ctAltAnfrage).not.toHaveBeenCalled();
  });
});

describe('Empfänger ohne Adresse (Website: Redakteure sehen die Adressen der Leitung evtl. nicht)', () => {
  it('ohne jede Adresse: gesendet, aber nicht nachprüfbar (null) – das Protokoll wird gar nicht gefragt', async () => {
    await expect(mailSenden(165, [{ personId: 10 }, { personId: 20 }], 'T', '')).resolves.toEqual({
      bestaetigt: null,
    });
    expect(ct.ctAltAnfrage).toHaveBeenCalledTimes(1);
    expect(ct.ctDaten).not.toHaveBeenCalled();
  });

  it('nur ein Teil mit Adresse: gezählt werden nur die mit Adresse', async () => {
    await expect(
      mailSenden(
        165,
        [{ personId: 10, email: 'friesen.alwin+a7n@ecg-donrath.de' }, { personId: 20 }],
        'T',
        '',
      ),
    ).resolves.toEqual({ bestaetigt: 1 });
  });

  it('ohne Adresse und ohne Antwort beim Senden: es bleibt „unklar“ (nichts nachzulesen, nichts wiederholt)', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(504, 'Zeitgrenze'));
    await expect(mailSenden(165, [{ personId: 10 }], 'T', '')).rejects.toBeInstanceOf(
      UnklarObVerschickt,
    );
    expect(ct.ctAltAnfrage).toHaveBeenCalledTimes(1);
  });
});

describe('Meldung bei „unklar“', () => {
  it('ohne Angabe die neutrale, mit Angabe die des Aufrufers', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(504, 'Zeitgrenze'));
    ct.ctDaten.mockResolvedValue([]);
    await expect(mailSenden(165, AN, 'T', '')).rejects.toMatchObject({
      message: expect.stringContaining('ob die Mails rausgingen, ist unklar') as unknown as string,
    });
    await expect(mailSenden(165, AN, 'T', '', { unklar: 'Eigene Meldung.' })).rejects.toMatchObject(
      {
        message: 'Eigene Meldung.',
      },
    );
  });
});
