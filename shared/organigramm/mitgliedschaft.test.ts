import { describe, expect, it } from 'vitest';
import {
  aufnehmen,
  aufnehmenZurueck,
  beenden,
  beendenZurueck,
  rolleAendern,
  type MitgliedZugriff,
  type Mitgliedschaft,
} from './mitgliedschaft';

/**
 * Ein nachgebautes ChurchTools – wie gemessen (O6, 28.10.2026): Anlegen scheitert, wenn es die Mitgliedschaft schon
 * gibt (403); Ändern setzt nur die geschickten Felder und scheitert ohne Mitgliedschaft (404); DELETE löscht.
 */
function nachbau(start: Record<number, Mitgliedschaft> = {}) {
  const m = new Map(Object.entries(start).map(([k, v]) => [Number(k), { ...v }]));
  const log: string[] = [];
  const panne = { ohneWirkung: false };
  const z: MitgliedZugriff = {
    lesen: (_g, p) => Promise.resolve(m.has(p) ? { ...m.get(p)! } : null),
    anlegen: (_g, p, f) => {
      log.push(`anlegen ${p} ${JSON.stringify(f)}`);
      if (m.has(p)) return Promise.reject(new Error('403 schon in der Gruppe'));
      if (panne.ohneWirkung) return Promise.resolve();
      m.set(p, {
        rolleId: (f.groupTypeRoleId as number | undefined) ?? null,
        status: (f.groupMemberStatus as string | undefined) ?? 'active',
        ende: (f.memberEndDate as string | undefined) ?? null,
      });
      return Promise.resolve();
    },
    aendern: (_g, p, f) => {
      log.push(`aendern ${p} ${JSON.stringify(f)}`);
      const alt = m.get(p);
      if (!alt) return Promise.reject(new Error('404 nicht in der Gruppe'));
      if (panne.ohneWirkung) return Promise.resolve();
      m.set(p, {
        rolleId: 'groupTypeRoleId' in f ? (f.groupTypeRoleId as number | null) : alt.rolleId,
        status: 'groupMemberStatus' in f ? (f.groupMemberStatus as string | null) : alt.status,
        ende: 'memberEndDate' in f ? (f.memberEndDate as string | null) : alt.ende,
      });
      return Promise.resolve();
    },
    entfernen: (_g, p) => {
      log.push(`entfernen ${p}`);
      if (!panne.ohneWirkung) m.delete(p);
      return Promise.resolve();
    },
    nichtUebernommen: (was) => new Error(`nicht übernommen: ${was}`),
  };
  return { z, m, log, panne };
}
const aktiv = (rolleId: number, ende: string | null = null): Mitgliedschaft => ({
  rolleId,
  status: 'active',
  ende,
});

describe('aufnehmen (O6)', () => {
  it('neue Person: angelegt mit Rolle, aktiv, ohne Ende – vorher war nichts', async () => {
    const n = nachbau();
    expect(await aufnehmen(n.z, 210, 66, 15)).toBeNull();
    expect(n.m.get(66)).toEqual(aktiv(15));
    expect(n.log).toEqual(['anlegen 66 {"groupTypeRoleId":15,"groupMemberStatus":"active"}']);
  });

  it('wer früher dabei war (mit Enddatum), wird geändert, nicht neu angelegt – das Ende wird geleert', async () => {
    const n = nachbau({ 66: aktiv(15, '2025-01-01') });
    expect(await aufnehmen(n.z, 210, 66, 16)).toEqual(aktiv(15, '2025-01-01'));
    expect(n.m.get(66)).toEqual(aktiv(16));
    expect(n.log).toEqual([
      'aendern 66 {"groupTypeRoleId":16,"groupMemberStatus":"active","memberEndDate":null}',
    ]);
  });

  it('„aufgenommen“ gemeldet, aber nicht da → nicht übernommen', async () => {
    const n = nachbau();
    n.panne.ohneWirkung = true;
    await expect(aufnehmen(n.z, 210, 66, 15)).rejects.toThrow(/die Aufnahme/);
  });

  it('Rückgängig: nie dabei gewesen → löschen; früher dabei → alter Stand zurück', async () => {
    const neu = nachbau();
    const vorher = await aufnehmen(neu.z, 210, 66, 15);
    await aufnehmenZurueck(neu.z, 210, 66, vorher);
    expect(neu.m.has(66)).toBe(false);
    expect(neu.log.at(-1)).toBe('entfernen 66');

    const frueher = nachbau({ 66: aktiv(15, '2025-01-01') });
    const v2 = await aufnehmen(frueher.z, 210, 66, 16);
    await aufnehmenZurueck(frueher.z, 210, 66, v2);
    expect(frueher.m.get(66)).toEqual(aktiv(15, '2025-01-01'));
    expect(frueher.log.some((l) => l.startsWith('entfernen'))).toBe(false);
    expect(frueher.log.some((l) => l.startsWith('anlegen'))).toBe(false);
  });

  it('Rückgängig ohne Wirkung → nicht übernommen', async () => {
    const n = nachbau();
    await aufnehmen(n.z, 210, 66, 15);
    n.panne.ohneWirkung = true;
    await expect(aufnehmenZurueck(n.z, 210, 66, null)).rejects.toThrow(/das Entfernen/);
    const f = nachbau({ 66: aktiv(15, '2025-01-01') });
    const v = await aufnehmen(f.z, 210, 66, 16);
    f.panne.ohneWirkung = true;
    await expect(aufnehmenZurueck(f.z, 210, 66, v)).rejects.toThrow(/den alten Stand/);
  });
});

describe('rolleAendern / beenden', () => {
  it('Rolle: nur die Rolle wird geschickt, nachgelesen', async () => {
    const n = nachbau({ 66: aktiv(15) });
    await rolleAendern(n.z, 210, 66, 16);
    expect(n.log).toEqual(['aendern 66 {"groupTypeRoleId":16}']);
    expect(n.m.get(66)).toEqual(aktiv(16));
  });

  it('Rolle ohne Wirkung → nicht übernommen', async () => {
    const n = nachbau({ 66: aktiv(15) });
    n.panne.ohneWirkung = true;
    await expect(rolleAendern(n.z, 210, 66, 16)).rejects.toThrow(/die neue Rolle/);
  });

  it('Austragen = beenden mit Enddatum heute – NICHT löschen; Rückgängig leert das Ende', async () => {
    const n = nachbau({ 66: aktiv(16) });
    await beenden(n.z, 210, 66, '2026-10-23');
    expect(n.m.get(66)).toEqual(aktiv(16, '2026-10-23'));
    expect(n.log.some((l) => l.startsWith('entfernen'))).toBe(false);
    await beendenZurueck(n.z, 210, 66);
    expect(n.m.get(66)).toEqual(aktiv(16));
    expect(n.log).toEqual([
      'aendern 66 {"memberEndDate":"2026-10-23"}',
      'aendern 66 {"memberEndDate":null}',
    ]);
  });

  it('beenden / zurücknehmen ohne Wirkung → nicht übernommen', async () => {
    const n = nachbau({ 66: aktiv(16) });
    n.panne.ohneWirkung = true;
    await expect(beenden(n.z, 210, 66, '2026-10-23')).rejects.toThrow(/Ende der Mitgliedschaft/);
    const b = nachbau({ 66: aktiv(16, '2026-10-23') });
    b.panne.ohneWirkung = true;
    await expect(beendenZurueck(b.z, 210, 66)).rejects.toThrow(/Zurücknehmen des Endes/);
  });
});
