import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BodyPortal } from './BodyPortal';

/** Das Merkmal der einen Fenster-Ebene in `#root` – nur hier vergeben. */
const EBENE_ATTRIBUT = 'data-fenster-ebene';

/** Die Fenster-Ebene unmittelbar in `#root` – angelegt beim ersten Fenster, außerhalb dessen, was React verwaltet. */
function ebeneIn(wurzel: HTMLElement): HTMLElement {
  const da = wurzel.querySelector<HTMLElement>(`:scope > [${EBENE_ATTRIBUT}]`);
  if (da) return da;
  const neu = document.createElement('div');
  neu.setAttribute(EBENE_ATTRIBUT, '');
  wurzel.appendChild(neu);
  return neu;
}

/**
 * **Hier wird jedes Fenster gezeichnet: ganz oben in der App, nie im Inhalt** (Alwin am iPhone, 20.11.2026: „das jeweilige
 * Modal soll ganz oben liegen“ – in „Wann kann ich?“ lag das schwebende Plus ÜBER dem offenen Fenster).
 *
 * **Ursache:** `Sheet` und `ConfirmDialog` hingen dort im DOM, wo die Seite sie aufrief – und ihr `z-index: 100`
 * zählt nur innerhalb des nächsten Stapels darüber. In „Wann kann ich?“ steckte das Fenster in der klebenden Leiste
 * (`position: sticky; z-index: 2`): Die Leiste ist ein eigener Stapel mit Ebene 2, das Fenster samt seinen 100 darunter
 * eingesperrt – das Plus (Ebene 3, Geschwister der Seite) lag darüber. Jede Zeile mit `z-index`, `transform`, `opacity` oder
 * `filter` über einem Fenster sperrt es so ein (so lag das Blatt in der Musik-App hinter der Reiterleiste, `Screen`).
 *
 * **Lösung an der Wurzel:** Das Fenster kommt per Portal als Kind direkt unter `#root` – dort gibt es keinen Stapel mehr
 * zwischen ihm und dem Plus, der Reiterleiste oder den Leisten der Seiten, und `--ebene-fenster` (`_variables.scss`) liegt
 * über allem, was die App zeichnet. **Nicht `body`:** In der Erweiterung ist `#root` der Bereich unter der Leiste von
 * ChurchTools (`transform` macht ihn zum Bezug für `position: fixed`); an `body` gehängt, deckte das Fenster auch diese Leiste.
 * Ohne `#root` (Tests, andere Seiten) fällt es auf `body` zurück (`BodyPortal`, mit Bereichs-Attribut).
 */
export function FensterEbene({ children }: { children: ReactNode }) {
  const wurzel = document.getElementById('root');
  if (!wurzel) return <BodyPortal>{children}</BodyPortal>;
  return createPortal(children, ebeneIn(wurzel));
}
