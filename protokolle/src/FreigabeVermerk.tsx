import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { freigabeVermerk, zurueckText, type KopfMitVerlauf } from '@shared/protokolle/freigabe';
import { Marke } from './Marke';
import styles from './Freigabe.module.scss';

const tag = (iso: string, zeitzone: string) => tagPunkt(tagAusIso(iso, zeitzone));

/**
 * **„freigegeben am … von …“** (S6-1) – die Marke im Kopf, aus `freigabeVermerk`. Ältere Freigaben ohne Verlauf stehen ohne
 * Namen da. Eine Stelle für Lesen und Schreiben.
 */
export function FreigabeMarke({ kopf, zeitzone }: { kopf: KopfMitVerlauf; zeitzone: string }) {
  const f = freigabeVermerk(kopf).freigabe;
  return (
    <Marke art="gut">
      freigegeben{f ? ` am ${tag(f.am, zeitzone)}` : ''}
      {f?.name ? ` von ${f.name}` : ''}
    </Marke>
  );
}

/** **„Freigabe zurückgenommen am … von …“** über einem Entwurf, dessen letzte Freigabe zurückgenommen wurde. */
export function ZurueckVermerk({
  kopf,
  zeitzone,
}: {
  kopf: KopfMitVerlauf | null;
  zeitzone: string;
}) {
  const z = freigabeVermerk(kopf).zurueck;
  if (!z) return null;
  return <p className={styles.vermerk}>{zurueckText(z, (iso) => tag(iso, zeitzone))}</p>;
}
