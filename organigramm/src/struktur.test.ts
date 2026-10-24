import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ladeAktivStatus, ladeUmbauStatus, strukturZugriff as z, umbauZugriff } from './struktur';

vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
}));
const anfrage = vi.mocked(ctAnfrage);
const daten = vi.mocked(ctDaten);
const alleSeiten = vi.mocked(ctAlleSeiten);

beforeEach(() => {
  anfrage.mockReset();
  daten.mockReset();
  alleSeiten.mockReset();
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

describe('umbauZugriff (O7-3) – wie am 24.10.2026 gemessen', () => {
  it('anlegen ohne Obergruppe: ein Bereich – `parentGroupId` fehlt ganz', async () => {
    anfrage.mockResolvedValueOnce({ data: { id: 230 } });
    expect(await z.anlegen({ name: 'Gemeinschaft', typId: 2, statusId: 1, elternId: null })).toBe(
      230,
    );
    expect(JSON.parse(anfrage.mock.calls[0][1]?.body as string)).toEqual({
      name: 'Gemeinschaft',
      groupTypeId: 2,
      groupStatusId: 1,
    });
  });

  it('gruppe: Name und Status; 404 → null, ein vorübergehender Fehler wirft weiter', async () => {
    daten.mockResolvedValueOnce({ name: 'Technik', information: { groupStatusId: 3 } });
    expect(await umbauZugriff.gruppe(7)).toEqual({ name: 'Technik', statusId: 3 });
    expect(daten).toHaveBeenCalledWith('/groups/7');
    daten.mockRejectedValueOnce(new ApiError(404, 'weg'));
    expect(await umbauZugriff.gruppe(7)).toBeNull();
    daten.mockRejectedValueOnce(new ApiError(503, 'antwortet nicht'));
    await expect(umbauZugriff.gruppe(7)).rejects.toMatchObject({ status: 503 });
    daten.mockResolvedValueOnce(null);
    await expect(umbauZugriff.gruppe(7)).rejects.toMatchObject({ status: 502 });
  });

  it('aendern = PATCH nur mit den genannten Feldern', async () => {
    anfrage.mockResolvedValue(null);
    await umbauZugriff.aendern(7, { name: 'Medien' });
    await umbauZugriff.aendern(7, { statusId: 3 });
    expect(
      anfrage.mock.calls.map(([p, i]) => [p, i?.method, JSON.parse(i?.body as string)]),
    ).toEqual([
      ['/groups/7', 'PATCH', { name: 'Medien' }],
      ['/groups/7', 'PATCH', { groupStatusId: 3 }],
    ]);
  });

  it('ladeUmbauStatus: aktiv und archiviert über die Namen, archivierte Gruppen eigens geladen', async () => {
    daten.mockResolvedValue({
      groupStatuses: [
        { id: 1, name: 'active' },
        { id: 3, name: 'archived' },
      ],
    });
    alleSeiten.mockResolvedValue([
      { id: 50, name: 'Sommerfest' },
      { id: 63, name: 'Workshop' },
    ]);
    expect(await ladeUmbauStatus()).toEqual({
      aktiv: 1,
      archiviert: 3,
      archivierteGruppen: new Map([
        [50, 'Sommerfest'],
        [63, 'Workshop'],
      ]),
    });
    expect(alleSeiten).toHaveBeenCalledWith('/groups?group_status_ids[]=3');

    // ohne „archived“ in den Stammdaten: unbekannt – nicht „keine archiviert“
    daten.mockResolvedValue({ groupStatuses: [{ id: 1, name: 'active' }] });
    alleSeiten.mockClear();
    expect(await ladeUmbauStatus()).toEqual({
      aktiv: 1,
      archiviert: null,
      archivierteGruppen: null,
    });
    expect(alleSeiten).not.toHaveBeenCalled();
  });
});
