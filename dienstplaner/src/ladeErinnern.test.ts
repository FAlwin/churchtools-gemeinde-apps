import { beforeEach, describe, expect, it, vi } from 'vitest';

const anfrage = vi.hoisted(() => vi.fn());
vi.mock('@ui/ct/verbindung', async (orig) => ({
  ...(await orig<typeof import('@ui/ct/verbindung')>()),
  ctAnfrage: anfrage,
  ctBasis: () => 'https://ct.test',
}));

import { abfrageLink, ctMailSenden, erinnernLink } from './ladeErinnern';
import { adresseFuer } from './reiter';

/**
 * E5c-5: der Anschluss an ChurchTools. Nichts geht raus – `ctAnfrage` ist ein Spion. Geprüft: Weg, Methode und Rumpf von
 * `POST /events/send` und dass der Knopf in der Mail auf „Verfügbarkeit“ der Erweiterung zeigt.
 */
beforeEach(() => anfrage.mockReset());

describe('ctMailSenden', () => {
  it('POST /events/send mit dem Auftrag als JSON; Rumpf der Antwort wird durchgereicht, Fehler fliegen weiter', async () => {
    const auftrag = {
      eventIds: [20],
      recipients: [5],
      subject: 'Betreff',
      body: '<p>Hallo</p>',
      sendCopyToMe: false,
      appendAgendaButton: false as const,
      files: [] as [],
    };
    anfrage.mockResolvedValueOnce({ data: { sentRecipientIds: [5] } });
    await expect(ctMailSenden(auftrag)).resolves.toEqual({ data: { sentRecipientIds: [5] } });
    expect(anfrage).toHaveBeenCalledWith('/events/send', {
      method: 'POST',
      body: JSON.stringify(auftrag),
      verweigert: 'ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.',
    });
    anfrage.mockRejectedValueOnce(new Error('weg'));
    await expect(ctMailSenden(auftrag)).rejects.toThrow('weg');
  });
});

describe('erinnernLink', () => {
  it('die volle Adresse: Instanz + Kürzel der Erweiterung + Adresse des Reiters „Verfügbarkeit“', () => {
    expect(adresseFuer('abwesenheiten')).toBe('#/abwesenheiten');
    expect(erinnernLink()).toBe('https://ct.test/ccm/dienstplaner/#/abwesenheiten');
  });
});

describe('abfrageLink', () => {
  it('führt auf „Verfügbarkeit“ mit der Abfrage der Dienstgruppe', () => {
    expect(abfrageLink(4)).toBe('https://ct.test/ccm/dienstplaner/#/abwesenheiten?abfrage=4');
  });
});
