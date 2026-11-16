import { lazy, Suspense } from 'react';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import type { KiFuellenProps } from './KiFuellenFenster';

/**
 * „Mit KI füllen“ (S8-2) erst beim Antippen laden – das Fenster bringt `fflate` (Word lesen), `docxText` und die
 * Regeln `ki.ts` mit; sie sollen nicht im Haupt-Bundle liegen (wie „Protokoll teilen“, `ProtokollTeilen.tsx`).
 */
const Fenster = lazy(() =>
  import('./KiFuellenFenster').then((m) => ({ default: m.KiFuellenFenster })),
);

/** Das Fenster „Mit KI füllen“ – nachgeladen. */
export function KiFuellen(props: KiFuellenProps) {
  return (
    <Suspense fallback={null}>
      <Fenster {...props} />
    </Suspense>
  );
}

/** Der Knopf „Mit KI füllen“ im Kopf des Editors – nur im Entwurf, nur wer schreiben darf. */
export function KiKnopf({ onClick }: { onClick: () => void }) {
  return (
    <KopfKnopf
      label="Mit KI füllen"
      title="Mit KI füllen – aus einem Transkript Stichpunkte, Beschlüsse, To-Dos und Termine ins Protokoll"
      symbol={<Icon name="funke" size={16} />}
      onClick={onClick}
    />
  );
}
