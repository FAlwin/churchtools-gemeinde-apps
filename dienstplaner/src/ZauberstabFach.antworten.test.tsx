// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import type { EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { antwortBereinigt, type Zusage } from '@shared/dienstplan/verfuegbarkeit';
import type { AntwortenLader } from './ladeAntworten';
import { ZauberstabFach, type Wahl, type ZauberZeile } from './ZauberstabFach';
import { ladeWerKann } from './ladeWerKann';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));
const laden = vi.mocked(ladeWerKann);
afterEach(() => {
  cleanup();
  laden.mockReset();
});

/** E5c-4: Der Zauberstab im Fenster – Ja vor Vielleicht, Antwort als Text, Fehler beim Laden der Antworten sagt es. */
const TON = 6;
const GESANG = 9;
const TECHNIK = 3;
const TERMIN = 9;
const k = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { domainIdentifier: String(id), title: name },
  score: 0,
  ...o,
});
const antw = (a: Zusage, extra: { notiz?: string; dienste?: number[] } = {}) => ({
  [TERMIN]: antwortBereinigt({ a, tag: '2026-10-25', ...extra }),
});
const DATEN: PersonenAntworten = {
  jePerson: new Map([
    [2, antw('ja')], // Ben: schlechtere Punkte, aber Ja
    [3, antw('vielleicht', { notiz: 'nur bis 12 Uhr' })],
    [4, antw('ja', { dienste: [GESANG] })], // David: nur für Gesang
  ]),
  sichtbar: new Set([TECHNIK]),
};
const ZEILE: ZauberZeile = {
  schluessel: `${TERMIN}|${TON}|-`,
  terminId: TERMIN,
  serviceId: TON,
  tag: '2026-10-25',
  schonDa: [],
  dienst: 'Ton',
  nr: 1,
  von: 1,
  kopf: 'So, 25.10. · Gottesdienst · 09:00 Uhr',
  monatName: 'Oktober',
  index: null,
  gruppeId: TECHNIK,
  gesehen: { art: 'frei' },
  stift: false,
};
const ok: EntwurfErgebnis = { ok: true, entwurf: null };
const zeige = (lader?: AntwortenLader) =>
  render(
    <ZauberstabFach
      titel="Automatische Planung · Technik"
      unter="So, 25.10."
      zeilen={[ZEILE]}
      eingeplant={[]}
      mitEntwurf={0}
      uebernehmen={(wahlen: Wahl[], melde) => {
        wahlen.forEach((_, i) => melde(i, ok));
        return Promise.resolve();
      }}
      onClose={() => {}}
      gruppe={{ id: TECHNIK, name: 'Technik' }}
      antworten={
        lader ? { lader, dienstName: (id) => (id === GESANG ? 'Gesang' : undefined) } : undefined
      }
    />,
  );
const auswahl = () => screen.getByRole<HTMLSelectElement>('combobox');
const optionen = () => [...auswahl().options].map((o) => o.textContent);

describe('ZauberstabFach mit Antworten (E5c-4)', () => {
  it('schlägt den Ja-Sager vor, obwohl ein anderer mehr Punkte hat; die Antwort steht hinter dem Namen', async () => {
    laden.mockResolvedValue([
      k(1, 'Anna', { score: 0 }),
      k(2, 'Ben', { score: -40 }),
      k(3, 'Clara', { score: -5 }),
    ]);
    const lader = vi.fn<AntwortenLader>(() => Promise.resolve(DATEN));
    zeige(lader);
    await screen.findByText('1 Vorschlag');
    expect(lader).toHaveBeenCalledWith([TECHNIK]);
    expect(auswahl().selectedOptions[0].textContent).toBe('Ben (0×) – Ja');
    expect(optionen()).toEqual([
      '— frei lassen —',
      'Ben (0×) – Ja',
      'Clara (0×) – Vielleicht – nur bis 12 Uhr',
      'Anna (0×)',
    ]);
  });

  it('„nur andere Dienste“: unter „Passt eher nicht“ mit Grund und Antwort', async () => {
    laden.mockResolvedValue([k(1, 'Anna'), k(4, 'David', { score: 50 })]);
    zeige(() => Promise.resolve(DATEN));
    await screen.findByText('1 Vorschlag');
    expect(auswahl().selectedOptions[0].textContent).toBe('Anna (0×)');
    expect(optionen()).toContain(
      'David – Antwort gilt nicht für diesen Dienst: Ja – nur für Gesang',
    );
  });

  it('Antworten scheitern: Vorschläge wie bisher (nur Punkte) und ein Hinweis – kein Abbruch', async () => {
    laden.mockResolvedValue([k(1, 'Anna', { score: 0 }), k(2, 'Ben', { score: -40 })]);
    zeige(() => Promise.reject(new ApiError(503, 'x')));
    await screen.findByText('1 Vorschlag');
    expect(auswahl().selectedOptions[0].textContent).toBe('Anna (0×)');
    expect(screen.getByText(/Antworten aus „Wann kann ich\?“ gerade nicht geladen/)).toBeTruthy();
  });

  it('ohne Lader: wie bisher, kein Hinweis', async () => {
    laden.mockResolvedValue([k(1, 'Anna', { score: 0 }), k(2, 'Ben', { score: -40 })]);
    zeige();
    await screen.findByText('1 Vorschlag');
    expect(auswahl().selectedOptions[0].textContent).toBe('Anna (0×)');
    expect(screen.queryByText(/gerade nicht geladen/)).toBeNull();
  });

  it('Antworten dieser Gruppe nicht sichtbar: wie bisher, kein Hinweis', async () => {
    laden.mockResolvedValue([k(1, 'Anna', { score: 0 }), k(2, 'Ben', { score: -40 })]);
    zeige(() => Promise.resolve({ jePerson: new Map(), sichtbar: new Set() }));
    await screen.findByText('1 Vorschlag');
    expect(auswahl().selectedOptions[0].textContent).toBe('Anna (0×)');
    expect(screen.queryByText(/gerade nicht geladen/)).toBeNull();
  });
});
