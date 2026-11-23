import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import { buchungenNachlesen, ladeRessourcen } from './buchungenLesen';

/** Ressourcen laden und Buchungen nachlesen (W15-2) gegen die nachgestellte Instanz. */
let ct: Nachbau;
beforeEach(() => {
  ct = nachbauStarten();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('ladeRessourcen', () => {
  it('Typen aus `nameTranslated`, nur die buchbaren, nach Typ sortiert', async () => {
    ct.ressourcenTypen = [
      { id: 10, nameTranslated: 'Raum' },
      { id: 11, nameTranslated: 'Gegenstand' },
    ];
    ct.ressourcen = [
      { id: 1, name: 'Saal', resourceTypeId: 10, quantity: 1, isAutoAccept: false },
      { id: 5, name: 'Stühle', resourceTypeId: 11, quantity: 80 },
      { id: 9, name: 'Nicht für mich', resourceTypeId: 10 },
    ];
    expect(await ladeRessourcen(new Set([1, 5]))).toEqual([
      { id: 5, name: 'Stühle', typId: 11, typ: 'Gegenstand', anzahl: 80 },
      { id: 1, name: 'Saal', typId: 10, typ: 'Raum', anzahl: 1 },
    ]);
  });
});

describe('buchungenNachlesen', () => {
  const frage = { termin: 700, ressourcen: [1, 5], von: '2027-12-23', bis: '2027-12-25' };

  it('je Ressource einzeln gelesen; nur eine Buchung zu DIESEM Termin zählt', async () => {
    ct.buchungen = [
      { resourceId: 1, appointmentId: 700, statusId: 1, quantity: undefined },
      { resourceId: 5, appointmentId: 701, statusId: 1, quantity: undefined },
    ];
    expect(await buchungenNachlesen(frage)).toEqual({ fehlend: [5], unklar: false });
  });

  it('alle da: nichts fehlt', async () => {
    ct.buchungen = [
      { resourceId: 1, appointmentId: 700, statusId: 1, quantity: undefined },
      { resourceId: 5, appointmentId: 700, statusId: 1, quantity: undefined },
    ];
    expect(await buchungenNachlesen(frage)).toEqual({ fehlend: [], unklar: false });
  });

  it('veraltete Form `base` (ohne `booking`) wird noch erkannt', async () => {
    ct.buchungenAlteForm = true;
    ct.buchungen = [
      { resourceId: 1, appointmentId: 700, statusId: 1, quantity: undefined },
      { resourceId: 5, appointmentId: 700, statusId: 1, quantity: undefined },
    ];
    expect(await buchungenNachlesen(frage)).toEqual({ fehlend: [], unklar: false });
  });

  it('Lesefehler: unklar – wirft nicht und behauptet nicht, es fehle etwas', async () => {
    ct.buchungenLesenFehler = true;
    expect(await buchungenNachlesen(frage)).toEqual({ fehlend: [], unklar: true });
  });
});
