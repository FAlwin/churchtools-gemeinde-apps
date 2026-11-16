import { lazy, Suspense } from 'react';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import type { ProtokollTeilenProps } from './ProtokollTeilenFenster';

/** Was Sitzungsansicht und Editor fürs Teilen von außen brauchen – fehlt es, gibt es keinen Knopf. */
export interface TeilenRahmen {
  gemeinde: string | null;
  ich: { person: number; name: string };
  /** Beginn der nächsten Sitzung (ISO) – `null`, wenn keine festgelegt ist. */
  naechste: string | null;
}

/** „Protokoll teilen“ (S6-3b) erst beim Antippen laden – es bringt jsPDF und pdf.js mit (wie im Dienstplaner). */
const Fenster = lazy(() =>
  import('./ProtokollTeilenFenster').then((m) => ({ default: m.ProtokollTeilenFenster })),
);

/** Das Fenster „Protokoll teilen“ – nachgeladen; Sitzungsansicht und Editor zeigen es gleich. */
export function ProtokollTeilen(props: ProtokollTeilenProps) {
  return (
    <Suspense fallback={null}>
      <Fenster {...props} />
    </Suspense>
  );
}

/** Der Knopf „Teilen / PDF“ oben in der Sitzung – in Sitzungsansicht und Editor derselbe. */
export function TeilenKnopf({ onClick }: { onClick: () => void }) {
  return (
    <KopfKnopf
      label="Teilen / PDF"
      title="Teilen / PDF – das Protokoll als PDF teilen oder herunterladen"
      symbol={<Icon name="share" size={16} />}
      onClick={onClick}
    />
  );
}
