import { describe, expect, it } from 'vitest';
import {
  ausgangAus,
  eingangAus,
  einteilungenAus,
  einteilungSchluessel,
  kandidatenAus,
  kandidatenFuer,
  tauschAblehnen,
  tauschAnfragen,
  tauschAnnehmen,
  tauschZurueckziehen,
} from './tausch';
import { ALWIN, GESANG, nachbau, SPIKE } from './tausch.testutil';

const SPIKE_166 = einteilungSchluessel({ eventId: 166, serviceId: GESANG, index: 1 });
const ALWIN_163 = einteilungSchluessel({ eventId: 163, serviceId: GESANG, index: 1 });

describe('Lesen', () => {
  it('einteilungenAus: gültige eigene Einteilungen mit Termin, Dienst und Zusage', () => {
    expect(
      einteilungenAus([
        {
          id: 954,
          serviceId: 9,
          serviceName: 'Gesang',
          index: 1,
          isAccepted: false,
          event: { id: 166, name: 'M', startDate: 'x' },
        },
        { id: 1, serviceId: 9, isValid: false, event: { id: 1 } },
        { id: 2 },
      ]),
    ).toEqual([
      {
        id: 954,
        eventId: 166,
        termin: 'M',
        beginn: 'x',
        serviceId: 9,
        index: 1,
        dienst: 'Gesang',
        zugesagt: false,
      },
    ]);
  });

  it('kandidatenAus: nach Beginn sortiert, Name aus Vor- und Nachname', () => {
    expect(
      kandidatenAus([
        {
          eventServiceId: 2,
          eventTitle: 'B',
          eventDate: '2027-02-01',
          person: { id: 7, firstName: 'Anna', lastName: 'K' },
        },
        {
          eventServiceId: 1,
          eventTitle: 'A',
          eventDate: '2026-12-01',
          person: { id: 1, firstName: 'Alwin', lastName: '' },
        },
        { eventTitle: 'ohne ID' },
      ]).map((k) => [k.einteilung, k.name]),
    ).toEqual([
      [1, 'Alwin'],
      [2, 'Anna K'],
    ]);
  });

  it('ausgangAus: die jüngste zählt – offen oder abgelehnt; zurückgezogen, angenommen, archiviert = nichts', () => {
    const a = (id: number, status: string, isArchived = false) => ({
      id,
      status,
      isArchived,
      requestedPerson: { title: 'Anna' },
    });
    expect(ausgangAus([a(1, 'DECLINED'), a(2, 'UNANSWERED')])).toMatchObject({
      art: 'offen',
      id: 2,
      name: 'Anna',
    });
    expect(ausgangAus([a(3, 'DECLINED'), a(2, 'UNANSWERED')])).toMatchObject({
      art: 'abgelehnt',
      id: 3,
    });
    expect(ausgangAus([a(4, 'CANCELLED', true), a(3, 'DECLINED')])).toBeNull();
    expect(ausgangAus([a(5, 'AGREED', true)])).toBeNull();
    expect(ausgangAus([])).toBeNull();
  });

  it('eingangAus: nur unbeantwortete, mit dem, was ich bekäme und abgäbe', () => {
    expect(
      eingangAus([
        { id: 3, status: 'DECLINED', requestedServiceId: 1 },
        {
          id: 6,
          status: 'UNANSWERED',
          requestedServiceId: 1026,
          requestingPerson: { title: 'Spike Musiker' },
          requestingEvent: { id: 166, name: 'Messung', startDate: '2027-01-10' },
          requestedEvent: { id: 163, name: 'Gottesdienst', startDate: '2026-11-15' },
        },
      ]),
    ).toEqual([
      {
        id: 6,
        von: 'Spike Musiker',
        bekomme: { eventId: 166, termin: 'Messung', beginn: '2027-01-10' },
        gebe: { einteilung: 1026, eventId: 163, termin: 'Gottesdienst', beginn: '2026-11-15' },
      },
    ]);
  });
});

describe('Tausch anfragen', () => {
  it('Kandidaten über die frische Einteilung – auch für eine offene Anfrage', async () => {
    const ct = nachbau();
    expect((await kandidatenFuer(ct.port, SPIKE, SPIKE_166))?.map((k) => k.name)).toEqual([
      'Alwin',
    ]);
    expect(ct.aufrufe).toEqual([`GET einteilungen ${SPIKE}`, 'GET kandidaten 954']);
  });

  it('fragt an und liest nach; eine zweite Anfrage am selben Dienst wird nicht geschickt', async () => {
    const ct = nachbau();
    expect(await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026)).toEqual({ ok: true });
    expect(await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026)).toEqual({
      ok: false,
      grund: 'schon-angefragt',
    });
    expect(ct.aufrufe.filter((a) => a.startsWith('POST'))).toEqual(['POST anfragen 954→1026']);
  });

  it('nach einer Ablehnung darf man wieder fragen', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    await tauschAblehnen(ct.port, ALWIN, 1);
    expect(await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026)).toEqual({ ok: true });
  });

  it('die ID der eigenen Einteilung hat sich geändert (z. B. nach dem Zusagen) – gefragt wird mit der neuen', async () => {
    const ct = nachbau();
    ct.plaetze[0].id = 1029;
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(ct.aufrufe).toContain('POST anfragen 1029→1026');
  });

  it('die eigene Einteilung gibt es nicht mehr → `weg`, nichts geschrieben', async () => {
    const ct = nachbau();
    ct.plaetze[0].personId = 7;
    expect(await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026)).toEqual({
      ok: false,
      grund: 'weg',
    });
    expect(ct.aufrufe.some((a) => a.startsWith('POST'))).toBe(false);
  });

  it('ChurchTools meldet Erfolg, das Nachlesen zeigt keine Anfrage → `unklar` (nicht wiederholen)', async () => {
    const ct = nachbau({ ohneWirkung: 'anfragen' });
    expect(await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026)).toEqual({
      ok: false,
      grund: 'unklar',
    });
    expect(ct.aufrufe.filter((a) => a.startsWith('POST'))).toHaveLength(1);
  });

  it('ein Aussetzer beim Lesen wirft – nichts wird geschrieben', async () => {
    const ct = nachbau();
    ct.port.ausgang = () => Promise.reject(Object.assign(new Error('503'), { status: 503 }));
    await expect(tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026)).rejects.toMatchObject({
      status: 503,
    });
    expect(ct.aufrufe.some((a) => a.startsWith('POST'))).toBe(false);
  });
});

describe('Zurückziehen', () => {
  it('zieht eine offene Anfrage zurück und liest nach', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(await tauschZurueckziehen(ct.port, SPIKE, SPIKE_166, 1)).toEqual({ ok: true });
    expect(ct.anfragen[0].status).toBe('CANCELLED');
  });

  it('schon beantwortet → `beantwortet`, nichts geschrieben', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    await tauschAblehnen(ct.port, ALWIN, 1);
    expect(await tauschZurueckziehen(ct.port, SPIKE, SPIKE_166, 1)).toEqual({
      ok: false,
      grund: 'beantwortet',
    });
    expect(ct.aufrufe.some((a) => a.startsWith('DELETE zurueckziehen'))).toBe(false);
  });

  it('204 ohne Wirkung → `unklar` (das 204 allein beweist nichts)', async () => {
    const ct = nachbau({ ohneWirkung: 'zurueckziehen' });
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(await tauschZurueckziehen(ct.port, SPIKE, SPIKE_166, 1)).toEqual({
      ok: false,
      grund: 'unklar',
    });
  });
});

describe('Annehmen und Ablehnen', () => {
  it('annehmen tauscht – nachgelesen: ich habe jetzt den Termin der anderen Person, zugesagt', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(await tauschAnnehmen(ct.port, ALWIN, 1)).toEqual({ ok: true });
    expect(ct.plaetze.find((p) => p.eventId === 166)).toMatchObject({
      personId: ALWIN,
      isAccepted: true,
    });
    expect(ct.plaetze.find((p) => p.eventId === 163)).toMatchObject({
      personId: SPIKE,
      isAccepted: true,
    });
  });

  it('schon beantwortet → `beantwortet`, kein PUT', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    await tauschZurueckziehen(ct.port, SPIKE, SPIKE_166, 1);
    expect(await tauschAnnehmen(ct.port, ALWIN, 1)).toEqual({ ok: false, grund: 'beantwortet' });
    expect(ct.aufrufe.some((a) => a.startsWith('PUT'))).toBe(false);
  });

  it('„AGREED“ gemeldet, aber nicht getauscht → `unklar` (das Erfolgssignal allein zählt nicht)', async () => {
    const ct = nachbau({ ohneWirkung: 'annehmen' });
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(await tauschAnnehmen(ct.port, ALWIN, 1)).toEqual({ ok: false, grund: 'unklar' });
  });

  it('ein anderer Status als „AGREED“ → `unklar`', async () => {
    const ct = nachbau({ antwortStatus: 'UNANSWERED' });
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(await tauschAnnehmen(ct.port, ALWIN, 1)).toEqual({ ok: false, grund: 'unklar' });
  });

  it('ablehnen; danach steht die Anfrage nicht mehr im Eingang', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    expect(eingangAus(await ct.port.eingang(ALWIN))).toHaveLength(1);
    expect(await tauschAblehnen(ct.port, ALWIN, 1)).toEqual({ ok: true });
    expect(eingangAus(await ct.port.eingang(ALWIN))).toEqual([]);
    expect(await tauschAblehnen(ct.port, ALWIN, 1)).toEqual({ ok: false, grund: 'beantwortet' });
  });

  it('nach dem Tausch gibt es Alwins alte Einteilung nicht mehr – sein alter Schlüssel findet nichts', async () => {
    const ct = nachbau();
    await tauschAnfragen(ct.port, SPIKE, SPIKE_166, 1026);
    await tauschAnnehmen(ct.port, ALWIN, 1);
    expect(await kandidatenFuer(ct.port, ALWIN, ALWIN_163)).toBeNull();
  });
});
