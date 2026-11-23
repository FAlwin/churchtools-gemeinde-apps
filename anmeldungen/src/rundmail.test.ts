import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { UnklarObVerschickt, platzhalterAus, rundmailSenden, vorschauLaden } from './rundmail';

/**
 * Rundmail (A7-5): Platzhalter, Vorschau und `rundmailSenden`. Das Senden selbst (Zweige, Nachlesen) steht seit W3b-3 im
 * gemeinsamen Baustein und wird in `ui/ct/mailSenden.test.ts` geprüft.
 */
vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctAltAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAnfrage: vi.fn(),
}));
const ct = vi.mocked(V);

beforeEach(() => {
  vi.clearAllMocks();
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

describe('Senden mit den Worten der Anmeldungen', () => {
  const AN = [{ personId: 10, email: 'friesen.alwin+a7n@ecg-donrath.de' }];
  beforeEach(() => {
    ct.ctAltAnfrage.mockResolvedValue(null);
    ct.ctDaten.mockResolvedValue([]);
  });

  it('die bisherige Meldung bei verweigertem Senden, auf Wunsch die des Aufrufers', async () => {
    await rundmailSenden(165, AN, 'Test', '<p>Hallo</p>');
    expect(ct.ctAltAnfrage.mock.calls[0][2]).toEqual({
      verweigert: 'Mails über ChurchTools schicken darfst du hier nicht.',
    });
    await rundmailSenden(165, AN, 'Test', '<p>Hallo</p>', 'Eigene Meldung.');
    expect(ct.ctAltAnfrage.mock.calls[1][2]).toEqual({ verweigert: 'Eigene Meldung.' });
  });

  it('„unklar“ spricht von einer Familie – wie bisher, und es ist DIESELBE Klasse wie im Baustein', async () => {
    ct.ctAltAnfrage.mockRejectedValue(new ApiError(504, 'Zeitgrenze'));
    const e = await rundmailSenden(165, AN, 'Test', '').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(UnklarObVerschickt);
    expect((e as Error).message).toBe(
      'ChurchTools hat beim Senden nicht geantwortet – ob die Mails rausgingen, ist unklar. Bitte erst nachsehen (z. B. bei einer Familie nachfragen), bevor du noch einmal sendest.',
    );
  });
});
