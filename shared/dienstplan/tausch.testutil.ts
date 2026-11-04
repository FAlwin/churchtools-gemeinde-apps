import type { TauschPort } from './tausch';

/**
 * **ChurchTools nachgebaut, wie am 04.11.2026 gemessen** (Tausch, E7-3) – für Kern- und Oberflächen-Tests. Spike (19)
 * hat Gesang (9) am Termin 166 offen (Platz 954), Alwin (1) Gesang am Termin 163 zugesagt (1026).
 */
export const SPIKE = 19;
export const ALWIN = 1;
export const GESANG = 9;
const TERMINE: Record<number, { name: string; startDate: string }> = {
  163: { name: 'Gottesdienst', startDate: '2026-11-15T09:00:00Z' },
  166: { name: 'Messung', startDate: '2027-01-10T09:00:00Z' },
  170: { name: 'Gottesdienst', startDate: '2027-02-07T09:00:00Z' },
};

interface Platz {
  id: number;
  eventId: number;
  serviceId: number;
  index: number;
  personId: number;
  isAccepted: boolean;
}
interface Anfrage {
  id: number;
  von: number;
  an: number;
  status: 'UNANSWERED' | 'DECLINED' | 'AGREED' | 'CANCELLED';
  isArchived: boolean;
}
const NAMEN: Record<number, string> = { 1: 'Alwin Friesen', 19: 'Spike Musiker', 7: 'Anna' };

/**
 * **ChurchTools nachgebaut, wie am 04.11.2026 gemessen:** Kandidaten = andere Einteilungen desselben Dienstes an
 * anderen Terminen (auch früheren); Eingang nur beim Partner, Ausgang je Einteilung; Annehmen tauscht mit neuen IDs (beide zugesagt);
 * Ablehnen `DECLINED`, Zurückziehen `CANCELLED` + archiviert.
 */
export function nachbau(
  opt: { ohneWirkung?: 'anfragen' | 'zurueckziehen' | 'annehmen'; antwortStatus?: string } = {},
) {
  let naechste = 1000;
  let naechsteAnfrage = 1;
  const plaetze: Platz[] = [
    { id: 954, eventId: 166, serviceId: GESANG, index: 1, personId: SPIKE, isAccepted: false },
    { id: 1026, eventId: 163, serviceId: GESANG, index: 1, personId: ALWIN, isAccepted: true },
  ];
  const anfragen: Anfrage[] = [];
  const aufrufe: string[] = [];
  const platz = (id: number) => plaetze.find((p) => p.id === id);
  const event = (id: number) => ({ id, ...TERMINE[id] });
  const roh = (a: Anfrage) => ({
    id: a.id,
    requestingServiceId: a.von,
    requestedServiceId: a.an,
    status: a.status,
    isArchived: a.isArchived,
    requestingEvent: event(platz(a.von)?.eventId ?? 0),
    requestedEvent: event(platz(a.an)?.eventId ?? 0),
    requestingPerson: { title: NAMEN[platz(a.von)?.personId ?? 0] },
    requestedPerson: { title: NAMEN[platz(a.an)?.personId ?? 0] },
  });
  const port: TauschPort = {
    async einteilungen(ich) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`GET einteilungen ${ich}`);
      return plaetze
        .filter((p) => p.personId === ich)
        .map((p) => ({ ...p, serviceName: 'Gesang', event: event(p.eventId) }));
    },
    async kandidaten(ich, _eventId, einteilung) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`GET kandidaten ${einteilung}`);
      const meins = platz(einteilung)!;
      return plaetze
        .filter(
          (p) =>
            p.serviceId === meins.serviceId &&
            p.personId !== ich &&
            TERMINE[p.eventId].startDate > '2026-11-04',
        )
        .map((p) => ({
          eventServiceId: p.id,
          eventTitle: TERMINE[p.eventId].name,
          eventDate: TERMINE[p.eventId].startDate,
          person: { id: p.personId, firstName: NAMEN[p.personId].split(' ')[0], lastName: '' },
        }));
    },
    async ausgang(_ich, _e, einteilung) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`GET ausgang ${einteilung}`);
      return anfragen.filter((a) => a.von === einteilung).map(roh);
    },
    async eingang(ich) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`GET eingang ${ich}`);
      return anfragen.filter((a) => platz(a.an)?.personId === ich && !a.isArchived).map(roh);
    },
    async anfragen(_ich, _e, einteilung, ziel) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`POST anfragen ${einteilung}→${ziel}`);
      const a: Anfrage = {
        id: naechsteAnfrage++,
        von: einteilung,
        an: ziel,
        status: 'UNANSWERED',
        isArchived: false,
      };
      if (opt.ohneWirkung !== 'anfragen') anfragen.push(a);
      return { data: { ...a, status: 'UNANSWERED' } };
    },
    async zurueckziehen(_ich, _e, _einteilung, id) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`DELETE zurueckziehen ${id}`);
      const a = anfragen.find((x) => x.id === id);
      if (a && opt.ohneWirkung !== 'zurueckziehen')
        Object.assign(a, { status: 'CANCELLED', isArchived: true });
    },
    async annehmen(_ich, id) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`PUT annehmen ${id}`);
      const a = anfragen.find((x) => x.id === id)!;
      if (opt.ohneWirkung !== 'annehmen') {
        const von = platz(a.von)!;
        const an = platz(a.an)!;
        // Getauscht, beide zugesagt, neue IDs (gemessen).
        [von.personId, an.personId] = [an.personId, von.personId];
        von.isAccepted = an.isAccepted = true;
        von.id = naechste++;
        an.id = naechste++;
        Object.assign(a, { status: 'AGREED', isArchived: true });
      }
      return { data: { id, status: opt.antwortStatus ?? 'AGREED' } };
    },
    async ablehnen(_ich, id) {
      await Promise.resolve(); // wie ChurchTools: die Antwort kommt nicht im selben Zug
      aufrufe.push(`DELETE ablehnen ${id}`);
      const a = anfragen.find((x) => x.id === id)!;
      a.status = 'DECLINED';
      return { data: { id, status: 'DECLINED' } };
    },
  };
  return { port, plaetze, anfragen, aufrufe };
}
