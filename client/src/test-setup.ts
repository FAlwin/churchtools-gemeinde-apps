import { afterEach, vi } from 'vitest';

/**
 * Der Dienstplaner lädt den Tausch beim Öffnen übers Netz (`useTausch` → `tauschPort`). In Tests soll nie etwas ins Netz: Der
 * Abruf scheiterte, und das `console.warn` kam teils erst nach dem Schließen der Testumgebung (EnvironmentTeardownError,
 * CI auf main rot). Für alle Tests offline; ein eigenes `vi.mock` in der Testdatei ersetzt das (`MeineTeilen.test.tsx`).
 */
vi.mock('../../dienstplaner/src/tauschPort', async () => ({
  tauschPort: (await import('../../dienstplaner/src/tauschOffline.testutil')).tauschPortOffline,
}));

/**
 * Nach jedem Test die gerenderten Komponenten und Hooks abbauen (#314).
 *
 * Testing Library räumt nur von selbst auf, wenn Vitest mit `globals: true` läuft – das tut dieses
 * Projekt bewusst nicht. Ohne diese Datei blieb **jeder** in einem Test montierte Hook danach am
 * Leben: Seine Ereignis-Listener hingen weiter am `window`, und ein `dispatchEvent` in einem
 * späteren Test löste sie alle mit aus.
 *
 * Gefunden beim Schreiben von `useChartSync.test.ts`: Der Test „meldet Listener beim Verlassen
 * wieder ab" zählte **acht** Aufrufe statt einem – einen je Hook aus den vorherigen Tests derselben
 * Datei. Der Code war richtig, die Umgebung nicht. Umgekehrt wäre es schlimmer gewesen: Ein Test,
 * der mitzählt, was fremde Hooks tun, kann auch dann grün sein, wenn der eigene gar nichts tut.
 *
 * Bewusst nur in jsdom: Die reinen Logik-Tests laufen in der Node-Umgebung, dort gibt es kein
 * `document` und Testing Library ließe sich nicht einmal laden.
 */
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
