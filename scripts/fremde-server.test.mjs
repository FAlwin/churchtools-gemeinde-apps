import { describe, expect, it, vi } from 'vitest';
import { belegtAuf, fremdeAus, pruefeFremdeServer } from './fremde-server.mjs';

const WURZEL = '/Users/a/gemeinde-apps/arbeitskopien/e2e-ports';

/** `lsof` nachgestellt: je Port die PIDs, je PID der Ordner; ein freier Port endet wie `lsof` mit Status 1. */
function lsofMit(ports, ordner) {
  return (_befehl, args) => {
    const port = args.find((a) => a.startsWith('-iTCP:'));
    if (port) {
      const pids = ports[Number(port.slice('-iTCP:'.length))];
      if (!pids) throw Object.assign(new Error('frei'), { status: 1 });
      return pids.join('\n') + '\n';
    }
    const pid = args[args.indexOf('-p') + 1];
    return `p${pid}\nfcwd\nn${ordner[pid]}\n`;
  };
}

describe('fremde Dev-Server vor dem E2E-Lauf (06.11.2026)', () => {
  it('fremd ist, was außerhalb der Arbeitskopie läuft – auch ein Nachbar mit gleichem Anfang und ein unlesbarer Ordner', () => {
    expect(
      fremdeAus(
        [
          { port: 5281, ordner: `${WURZEL}/anmeldungen` },
          { port: 5173, ordner: WURZEL },
          { port: 5282, ordner: '/Users/a/gemeinde-apps/arbeitskopien/dienstplaner/dienstplaner' },
          { port: 5283, ordner: `${WURZEL}-alt/organigramm` },
          { port: 5284, ordner: null },
        ],
        WURZEL,
      ).map((b) => b.port),
    ).toEqual([5282, 5283, 5284]);
  });

  it('liest je Port, wer lauscht, und dessen Ordner; freie Ports fallen weg, doppelte PIDs zählen einmal', () => {
    const lsof = lsofMit({ 5281: ['11', '11'], 5282: ['12'] }, { 11: `${WURZEL}/x`, 12: '/tmp' });
    expect(belegtAuf([5281, 5282, 5283], lsof)).toEqual([
      { port: 5281, ordner: `${WURZEL}/x` },
      { port: 5282, ordner: '/tmp' },
    ]);
  });

  it('ohne `lsof` lässt es sich nicht prüfen: `null` – und der Lauf geht mit einer Warnung weiter', () => {
    const fehlt = () => {
      throw Object.assign(new Error('nicht da'), { code: 'ENOENT' });
    };
    expect(belegtAuf([5281], fehlt)).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => pruefeFremdeServer([5281], WURZEL, fehlt)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ungeprüft'));
  });

  it('eigene Server laufen weiter mit; ein fremder bricht ab – mit Port und Ordner in der Meldung', () => {
    const eigen = lsofMit({ 5281: ['11'] }, { 11: `${WURZEL}/anmeldungen` });
    expect(() => pruefeFremdeServer([5281, 5282], WURZEL, eigen)).not.toThrow();
    const fremd = lsofMit(
      { 5282: ['12'] },
      { 12: '/Users/a/gemeinde-apps/arbeitskopien/dienstplaner' },
    );
    expect(() => pruefeFremdeServer([5281, 5282], WURZEL, fremd)).toThrow(
      /Port 5282: \/Users\/a\/gemeinde-apps\/arbeitskopien\/dienstplaner/,
    );
  });
});
