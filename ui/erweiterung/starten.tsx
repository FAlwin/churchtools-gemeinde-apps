import React, { type ComponentType } from 'react';
import ReactDOM from 'react-dom/client';
import { verbindungEinrichten } from '../ct/verbindung';
import { folgeChurchToolsThema } from '../design/thema';
import { untenNachfuehren } from '../fenster/appHeight';
import { zoomBeimTippenAus } from '../fenster/tippZoom';

export interface ErweiterungsStart {
  /** Die App der Erweiterung. */
  App: ComponentType;
  /** Was die App sagt, wenn ChurchTools ein Recht verweigert – je Erweiterung genauer als die allgemeine Meldung. */
  keinRecht: string;
  /**
   * Nur beim Entwickeln: `?demo` spielt ChurchTools nach, damit die Seite ohne Instanz zu sehen ist. Die App übergibt
   * `import.meta.env.DEV ? () => import('./demo') : undefined` – so fällt `demo.ts` aus der gebauten Erweiterung
   * heraus (Vite ersetzt `DEV` beim Bauen durch `false`).
   */
  demo?: () => Promise<{ demoStarten(fall: string): void }>;
}

/**
 * **Start jeder ChurchTools-Erweiterung** (#845) – vorher stand derselbe Ablauf in vier `main.tsx`, nur Kommentar und
 * Rechte-Text unterschieden sich. Was hier steht, gilt für alle:
 *
 * - Klasse `ct-extension`: legt die App in den Bereich unter der ChurchTools-Leiste (`ui/design/_grundregeln.scss`).
 * - `untenNachfuehren`: Platz für den Home-Strich messen (`--home-strich`). In der ChurchTools-App vom Home-Bildschirm
 *   meldet iOS ihn nicht (29.10.2026) – sonst läge die Reiterleiste am Handy unter dem Strich.
 * - `folgeChurchToolsThema`: hell oder dunkel wie ChurchTools (#563, `docs/entwicklung/dunkelmodus.md`).
 * - `zoomBeimTippenAus`: am iPhone beim Antippen eines Felds nicht hineinzoomen (`ui/fenster/tippZoom.ts`).
 * - `verbindungEinrichten`: die Rechte-Meldung der Erweiterung.
 */
export async function erweiterungStarten({
  App,
  keinRecht,
  demo,
}: ErweiterungsStart): Promise<void> {
  document.documentElement.classList.add('ct-extension');
  untenNachfuehren();
  folgeChurchToolsThema();
  zoomBeimTippenAus();
  verbindungEinrichten({ keinRecht });

  const suche = new URLSearchParams(location.search);
  if (demo && suche.has('demo')) (await demo()).demoStarten(suche.get('demo') ?? '');

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
