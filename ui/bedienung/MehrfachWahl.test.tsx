// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MehrfachWahl, type MehrfachGruppe } from './MehrfachWahl';

const lage = vi.hoisted(() => ({ handy: false }));
vi.mock('./useMedienAbfrage', async (orig) => ({
  ...(await orig<typeof import('./useMedienAbfrage')>()),
  useMedienAbfrage: () => lage.handy,
}));

afterEach(cleanup);

const GRUPPEN: MehrfachGruppe<number>[] = [
  { titel: 'Fahrzeug', optionen: [{ wert: 4, text: 'Bus' }] },
  {
    titel: 'Raum',
    optionen: [
      { wert: 2, text: 'Küche', name: 'Küche · Raum' },
      { wert: 1, text: 'Saal', zusatz: '(1)' },
    ],
  },
];

function Halter({ laedt }: { laedt?: string }) {
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set());
  return (
    <MehrfachWahl
      gruppen={GRUPPEN}
      gewaehlt={gewaehlt}
      titel="Ressourcen wählen"
      platzhalter="Ressourcen wählen …"
      laedt={laedt}
      onUmschalten={(w) =>
        setGewaehlt((alt) => {
          const neu = new Set(alt);
          if (!neu.delete(w)) neu.add(w);
          return neu;
        })
      }
    />
  );
}

const feld = () => screen.getByRole<HTMLButtonElement>('button', { name: /^Ressourcen wählen/ });

describe('MehrfachWahl (27.11.2026)', () => {
  it('Rechner: klappt unter dem Feld auf, mehrere Häkchen, das Feld nennt das Gewählte; die Liste bleibt offen', () => {
    lage.handy = false;
    render(<Halter />);
    expect(feld().textContent).toBe('Ressourcen wählen …');
    fireEvent.click(feld());
    const liste = screen.getByRole('dialog', { name: 'Ressourcen wählen' });
    expect([...liste.querySelectorAll('legend')].map((l) => l.textContent)).toEqual([
      'Fahrzeug',
      'Raum',
    ]);
    fireEvent.click(within(liste).getByRole('checkbox', { name: 'Küche · Raum' }));
    fireEvent.click(within(liste).getByRole('checkbox', { name: 'Bus' }));
    expect(feld().textContent).toBe('Bus, Küche');
    expect(feld().getAttribute('aria-label')).toBe('Ressourcen wählen (gewählt: Bus, Küche)');
    fireEvent.click(within(liste).getByRole('checkbox', { name: 'Bus' }));
    expect(feld().textContent).toBe('Küche');
    expect(screen.getByRole('dialog', { name: 'Ressourcen wählen' })).toBeTruthy();
    fireEvent.click(feld());
    expect(screen.queryByRole('dialog', { name: 'Ressourcen wählen' })).toBeNull();
  });

  it('Handy: die Liste kommt als Fenster, „Fertig“ schließt es', () => {
    lage.handy = true;
    render(<Halter />);
    fireEvent.click(feld());
    const fenster = screen.getByRole('dialog', { name: 'Ressourcen wählen' });
    fireEvent.click(within(fenster).getByRole('checkbox', { name: /^Saal/ }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog', { name: 'Ressourcen wählen' })).toBeNull();
    expect(feld().textContent).toBe('Saal');
  });

  it('solange geladen wird: gesperrt, mit dem Ladetext', () => {
    lage.handy = false;
    render(<Halter laedt="wird geladen …" />);
    expect(feld().disabled).toBe(true);
    expect(feld().textContent).toBe('wird geladen …');
  });
});
