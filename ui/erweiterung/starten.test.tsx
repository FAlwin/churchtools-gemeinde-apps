// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { fehlerAus } from '../ct/verbindung';
import { erweiterungStarten } from './starten';

/**
 * **Der gemeinsame Start der Erweiterungen** (#845). Geprüft wird, was vorher in jeder `main.tsx` stand: Klasse
 * `ct-extension`, die App im `#root`, und `?demo` nur, wenn die App eine Demo mitgibt.
 */
function App() {
  return <p>App läuft</p>;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  document.documentElement.className = '';
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

async function starte(demo?: () => Promise<{ demoStarten(fall: string): void }>) {
  await act(() => erweiterungStarten({ App, keinRecht: 'kein Recht', demo }));
}

describe('erweiterungStarten', () => {
  it('legt die Klasse an und zeigt die App', async () => {
    await starte();
    expect(document.documentElement.classList.contains('ct-extension')).toBe(true);
    expect(document.getElementById('root')!.textContent).toBe('App läuft');
  });

  it('stellt die Rechte-Meldung der Erweiterung ein', async () => {
    await starte();
    const verbot = {
      message: 'Keine ausreichende Berechtigung.',
      messageKey: 'error.forbidden.view',
    };
    const antwort = new Response(JSON.stringify(verbot), { status: 403 });
    expect((await fehlerAus(antwort, verbot)).message).toBe('kein Recht');
  });

  it('?demo startet die Demo der App – mit dem Fall aus der Adresse, vor der App', async () => {
    window.history.replaceState(null, '', '/?demo=leer');
    const reihenfolge: string[] = [];
    const demoStarten = vi.fn((fall: string) => {
      reihenfolge.push(`demo ${fall} ${document.getElementById('root')!.textContent}`);
    });
    await starte(() => Promise.resolve({ demoStarten }));
    expect(demoStarten).toHaveBeenCalledOnce();
    expect(reihenfolge).toEqual(['demo leer ']);
    expect(document.getElementById('root')!.textContent).toBe('App läuft');
  });

  it('ohne ?demo wird die Demo nicht einmal geladen', async () => {
    const laden = vi.fn(() => Promise.resolve({ demoStarten: vi.fn() }));
    await starte(laden);
    expect(laden).not.toHaveBeenCalled();
  });

  it('ohne Demo (gebaute Erweiterung) bleibt ?demo wirkungslos', async () => {
    window.history.replaceState(null, '', '/?demo');
    await starte(undefined);
    expect(document.getElementById('root')!.textContent).toBe('App läuft');
  });
});
