import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { UnklarObVerschickt, platzhalterAus, rundmailSenden, vorschauLaden } from './rundmail';

/**
 * Rundmail senden (A7-5) gegen ein nachgestelltes ChurchTools – wie am 22.10.2026 gemessen: `sendEMailToPersonIds`
 * antwortet `success`, das Protokoll schreibt je Mail „Speichere Mail an <Adresse> von … - <Betreff>“.
 */
vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctAltAnfrage: vi.fn(),
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
  ct.ctAltAnfrage.mockResolvedValue(null);
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
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: 1 });
  });

  it('Protokoll nicht lesbar (Recht, Aussetzer) → verschickt, aber unbestätigt – kein Fehler', async () => {
    ct.ctDaten.mockRejectedValue(new ApiError(403, 'verboten'));
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: null });
    ct.ctDaten.mockRejectedValue(new ApiError(504, 'Zeit'));
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: null });
  });

  it('abgelehnt oder gebremst → sicher nicht verschickt, Fehler kommt an, kein Nachlesen', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new V.AltFehler(502, 'Keine Empfänger', 'abgelehnt'));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toMatchObject({
      status: 422,
      message: 'ChurchTools hat die Mails nicht angenommen: Keine Empfänger',
    });
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(403, 'verboten'));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toMatchObject({ status: 403 });
    ct.ctAltAnfrage.mockRejectedValue(new V.ChurchToolsBremst(5000));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(V.ChurchToolsBremst);
    expect(ct.ctDaten).not.toHaveBeenCalled();
  });

  it('keine Antwort beim Senden: steht es im Protokoll → verschickt; sonst „unklar“ statt „noch einmal“', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(504, 'Zeitgrenze'));
    await expect(rundmailSenden(165, AN, 'Test', '')).resolves.toEqual({ bestaetigt: 2 });
    ct.ctDaten.mockResolvedValue([]);
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
    ct.ctAltAnfrage.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
    // Unlesbare Antwort (z. B. eine HTML-Seite) – ob es lief, weiß niemand.
    ct.ctAltAnfrage.mockRejectedValue(new V.AltFehler(502, 'unlesbar', 'unlesbar'));
    await expect(rundmailSenden(165, AN, 'Test', '')).rejects.toBeInstanceOf(UnklarObVerschickt);
  });

  it('niemand ausgewählt → nichts geschickt', async () => {
    await expect(rundmailSenden(165, [], 'Test', '')).rejects.toMatchObject({ status: 422 });
    expect(ct.ctAltAnfrage).not.toHaveBeenCalled();
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

describe('Vorschau', () => {
  it('Antwort direkt (gemessen: {subject, html}) oder in data – beides gilt', async () => {
    ct.ctAnfrage.mockResolvedValue({ subject: 'Test CF3JFR', html: '<p>Hallo</p>' });
    await expect(vorschauLaden(165, 140, 'Test', '<p>x</p>')).resolves.toEqual({
      betreff: 'Test CF3JFR',
      html: '<p>Hallo</p>',
    });
    expect(JSON.parse(String(ct.ctAnfrage.mock.calls[0][1]!.body))).toEqual({
      content: ['<p>x</p>'],
      subject: 'Test',
      personId: 140,
      groupId: 165,
    });
    ct.ctAnfrage.mockResolvedValue({ data: { subject: 'B', html: '<p>h</p>' } });
    await expect(vorschauLaden(165, 140, 'Test', '')).resolves.toEqual({
      betreff: 'B',
      html: '<p>h</p>',
    });
  });
});
