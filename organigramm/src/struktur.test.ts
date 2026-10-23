import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ladeAktivStatus, strukturZugriff as z } from './struktur';

vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
const anfrage = vi.mocked(ctAnfrage);
const daten = vi.mocked(ctDaten);

beforeEach(() => {
  anfrage.mockReset();
  daten.mockReset();
});

describe('strukturZugriff (O5) – wie an der Test-Instanz gemessen', () => {
  it('Obergruppen aus `domainIdentifier` (Text)', async () => {
    daten.mockResolvedValue([{ domainIdentifier: '10' }, { domainIdentifier: '47' }, {}]);
    expect(await z.obergruppen(7)).toEqual([10, 47]);
    expect(daten).toHaveBeenCalledWith('/groups/7/parents');
  });

  it('Obergruppen: keine Liste → Fehler, nicht „keine Obergruppe“', async () => {
    daten.mockResolvedValue(null);
    await expect(z.obergruppen(7)).rejects.toMatchObject({ status: 502 });
  });

  it('setzen = PUT; „bereits gesetzt“ (400 already) ist erledigt, jeder andere 400 nicht', async () => {
    anfrage.mockResolvedValue(null);
    await z.setzen(7, 10);
    expect(anfrage).toHaveBeenCalledWith(
      '/groups/7/parents/10',
      expect.objectContaining({ method: 'PUT' }),
    );

    anfrage.mockRejectedValueOnce(
      new ApiError(400, 'Die Gruppe ist bereits als Obergruppe gesetzt.', {
        messageKey: 'group.reference.already.exists',
      }),
    );
    await expect(z.setzen(7, 10)).resolves.toBeUndefined();

    anfrage.mockRejectedValueOnce(
      new ApiError(400, 'zyklische Abhängigkeit', { messageKey: 'group.hierarchy.cycle' }),
    );
    await expect(z.setzen(7, 12)).rejects.toThrow(/zyklische/);
  });

  it('lösen = DELETE', async () => {
    anfrage.mockResolvedValue(null);
    await z.loesen(7, 10);
    expect(anfrage).toHaveBeenCalledWith(
      '/groups/7/parents/10',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('anlegen: Name, Typ, Status, Obergruppe in einem Aufruf; ohne ID in der Antwort → nicht übernommen', async () => {
    anfrage.mockResolvedValueOnce({ data: { id: 201 } });
    expect(await z.anlegen({ name: 'Kamera', typId: 2, statusId: 1, elternId: 7 })).toBe(201);
    const [pfad, init] = anfrage.mock.calls[0];
    expect(pfad).toBe('/groups');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Kamera',
      groupTypeId: 2,
      groupStatusId: 1,
      parentGroupId: 7,
    });

    anfrage.mockResolvedValueOnce({ data: {} });
    await expect(
      z.anlegen({ name: 'X', typId: 2, statusId: 1, elternId: 7 }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('gibtEs: nur 404 heißt „nein“ – ein vorübergehender Fehler wirft weiter', async () => {
    daten.mockResolvedValueOnce({ id: 7 });
    expect(await z.gibtEs(7)).toBe(true);
    daten.mockRejectedValueOnce(new ApiError(404, 'weg'));
    expect(await z.gibtEs(7)).toBe(false);
    daten.mockRejectedValueOnce(new ApiError(503, 'antwortet nicht'));
    await expect(z.gibtEs(7)).rejects.toMatchObject({ status: 503 });
  });

  it('löschen = DELETE /groups/{id}', async () => {
    anfrage.mockResolvedValue(null);
    await z.loeschen(201);
    expect(anfrage).toHaveBeenCalledWith(
      '/groups/201',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('ladeAktivStatus', () => {
  it('aus den Stammdaten über `active`', async () => {
    daten.mockResolvedValue({
      groupStatuses: [
        { id: 2, name: 'pending' },
        { id: 1, name: 'active' },
      ],
    });
    expect(await ladeAktivStatus(4)).toBe(1);
    expect(daten).toHaveBeenCalledWith('/person/masterdata');
  });

  it('ohne Status-Liste → Status der Obergruppe', async () => {
    daten.mockResolvedValue({});
    expect(await ladeAktivStatus(4)).toBe(4);
  });
});
