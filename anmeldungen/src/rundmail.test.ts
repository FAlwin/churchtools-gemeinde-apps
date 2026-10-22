import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { UnklarObVerschickt, platzhalterAus, rundmailSenden } from './rundmail';

/**
 * Rundmail senden (A7-5) gegen ein nachgestelltes ChurchTools – wie am 22.10.2026 gemessen: `sendEMailToPersonIds`
 * antwortet `success`, das Protokoll schreibt je Mail „Speichere Mail an <Adresse> von … - <Betreff>“.
 */
vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctAltAufruf: vi.fn(),
  ctDaten: vi.fn(),
  ctAnfrage: vi.fn(),
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
  ct.ctAltAufruf.mockResolvedValue(null);
  ct.ctDaten.mockResolvedValue([
    eintrag('friesen.alwin+a7n@ecg-donrath.de'),
    eintrag('friesen.alwin+a7h@ecg-donrath.de'),
    // Älter als das Senden – zählt nicht.
    eintrag('friesen.alwin+a7n@ecg-donrath.de', '2026-10-01T10:00:00Z'),
  ]);
});

describe('Senden', () => {
  it('eine Anfrage mit allen Personen und der Gruppe; im Protokoll nachgelesen (Groß-/Kleinschreibung egal)', async () => {
    await expect(rundmailSenden(165, AN, 'Test', '<p>Hallo</p>')).resolves.toEqual({
      bestaetigt: 2,
    });
    expect(ct.ctAltAufruf).toHaveBeenCalledWith('churchhome', 'sendEMailToPersonIds', {
      ids: '10,20',
      betreff: 'Test',
      inhalt: '<p>Hallo</p>',
      attachments: '',
      domain_id: null,
      group_id: 165,
      template_id: null,
    });
  });

  it('eine Adresse steht nur mit einem alten Eintrag im Protokoll → zählt nicht', async () => {
    ct.ctDaten.mockResolvedValue([
      eintrag('friesen.alwin+a7n@ecg-donrath.de'),
      eintrag('friesen.alwin+a7h@ecg-donrath.de', '2026-10-01T10:00:00Z'),
    ]);
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: 1 });
  });

  it('Protokoll nicht lesbar (Recht, Aussetzer) → verschickt, aber unbestätigt – kein Fehler', async () => {
    ct.ctDaten.mockRejectedValue(new ApiError(403, 'verboten'));
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: null });
    ct.ctDaten.mockRejectedValue(new ApiError(504, 'Zeit'));
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: null });
  });

  it('abgelehnt oder gebremst → sicher nicht verschickt, Fehler kommt an, kein Nachlesen', async () => {
    ct.ctAltAufruf.mockRejectedValue(new ApiError(422, 'ChurchTools hat abgelehnt: x'));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toMatchObject({ status: 422 });
    ct.ctAltAufruf.mockRejectedValue(new V.ChurchToolsBremst(5000));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(V.ChurchToolsBremst);
    expect(ct.ctDaten).not.toHaveBeenCalled();
  });

  it('keine Antwort beim Senden: steht es im Protokoll → verschickt; sonst „unklar“ statt „noch einmal“', async () => {
    ct.ctAltAufruf.mockRejectedValue(new ApiError(504, 'Zeitgrenze'));
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: 2 });
    ct.ctDaten.mockResolvedValue([]);
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
    ct.ctAltAufruf.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
  });

  it('niemand ausgewählt → nichts geschickt', async () => {
    await expect(rundmailSenden(165, [], 'Test', '')).rejects.toMatchObject({ status: 422 });
    expect(ct.ctAltAufruf).not.toHaveBeenCalled();
  });
});

describe('Platzhalter', () => {
  it('aus der verschachtelten Liste: Bezeichnung → Platzhalter', () => {
    const roh = [
      {
        label: 'Gruppe',
        children: [
          { label: 'Gruppenname', placeholder: '{{{group.name}}}' },
          {
            label: 'Felder',
            children: [
              { label: 'Betrag', placeholder: '{{{groupMemberField.betrag}}}' },
              { label: 'Anmelde-Nr.', placeholder: '{{{groupMemberField.anmelde-nr-}}}' },
            ],
          },
        ],
      },
    ];
    expect([...platzhalterAus(roh)]).toEqual([
      ['Gruppenname', '{{{group.name}}}'],
      ['Betrag', '{{{groupMemberField.betrag}}}'],
      ['Anmelde-Nr.', '{{{groupMemberField.anmelde-nr-}}}'],
    ]);
  });
});
