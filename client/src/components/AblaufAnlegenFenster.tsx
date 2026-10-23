import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Service } from '@shared/types/index';
import { kopieVorschlaege, vorlagenFuer } from '@shared/ct/ablaufVorschlaege';
import {
  AblaufAnlegenFenster as Fenster,
  type KopieVorschlag,
} from '@ui/ablauf/AblaufAnlegenFenster';
import { NeuAufsetzen } from '@ui/ablauf/NeuAufsetzen';
import { useAblaufAnlegen, useAblaufNeuAufsetzen, useAblaufVorlagen } from '../hooks/useServices';
import { schluessel } from '../hooks/abfrageSchluessel';
import { liedAnzahl } from '../utils/songFilter';

interface Props {
  /** Die Veranstaltung ohne Ablauf. */
  termin: Service;
  /** Termine MIT Ablauf (die normale Liste) – daraus kommen die Vorschläge für „Wie eine frühere". */
  mitAblauf: Service[];
  onClose: () => void;
  /** Nach dem Anlegen – der Aufrufer öffnet den neuen Ablauf. */
  onAngelegt: (termin: Service) => void;
}

const KEINE_VORSCHLAEGE = 'Keine frühere Veranstaltung mit Ablauf in der Terminliste.';
const KALENDER_UNBEKANNT =
  'Der Kalender dieser Veranstaltung ist unbekannt. Bitte die Liste neu laden.';

/**
 * **Ablauf anlegen** in der Musik-App (13.10.2026) – die Hülle um den gemeinsamen Baustein
 * (`ui/ablauf/AblaufAnlegenFenster`, seit E6-5a): Vorlagen und Anlegen über die Abfragen der App, „Wie eine frühere"
 * aus der Terminliste (mit Liedanzahl).
 */
export function AblaufAnlegenFenster({ termin, mitAblauf, onClose, onAngelegt }: Props) {
  const vorlagenQuery = useAblaufVorlagen(true);
  const anlegen = useAblaufAnlegen();

  async function onAnlegen(quelle: Parameters<typeof anlegen.mutateAsync>[0]['quelle']) {
    if (termin.kalenderId === undefined) throw new Error(KALENDER_UNBEKANNT);
    await anlegen.mutateAsync({ eventId: termin.id, kalenderId: termin.kalenderId, quelle });
    onAngelegt(termin);
  }

  return (
    <Fenster
      fuer={terminZeile(termin)}
      vorlagen={{
        liste: vorlagenFuer(vorlagenQuery.data ?? [], termin.kalenderId),
        laedt: vorlagenQuery.isLoading,
        fehler: vorlagenQuery.isError,
      }}
      vorschlaege={vorschlaegeFuer(termin, mitAblauf)}
      keineVorschlaege={KEINE_VORSCHLAEGE}
      onAnlegen={onAnlegen}
      onClose={onClose}
    />
  );
}

/**
 * **Ablauf neu aufsetzen** in der Musik-App (E6-5b, #691) – die Hülle um `ui/ablauf/NeuAufsetzen`: dieselben Vorlagen
 * und Vorschläge wie beim Anlegen. Die Vorschläge kommen aus der schon geladenen Terminliste.
 */
export function AblaufNeuAufsetzen({ termin, onClose }: { termin: Service; onClose: () => void }) {
  const vorlagenQuery = useAblaufVorlagen(true);
  const mitAblauf = useQueryClient().getQueryData<Service[]>(schluessel.termine()) ?? [];
  const n = useAblaufNeuAufsetzen(termin.id);

  return (
    <NeuAufsetzen
      fuer={terminZeile(termin)}
      vorlagen={{
        liste: vorlagenFuer(vorlagenQuery.data ?? [], termin.kalenderId),
        laedt: vorlagenQuery.isLoading,
        fehler: vorlagenQuery.isError,
      }}
      vorschlaege={vorschlaegeFuer(termin, mitAblauf)}
      keineVorschlaege={KEINE_VORSCHLAEGE}
      bestandLesen={n.bestandLesen}
      neuAufsetzen={(quelle, gesehen, nurDieser) =>
        n.neuAufsetzen(termin.kalenderId ?? null, quelle, gesehen, nurDieser)
      }
      neuLaden={n.neuLaden}
      onClose={onClose}
    />
  );
}

/** In Stücken wie vor E6-5a – als ein Text verschob sich die Laufweite um „30.“ minimal (Fotovergleich). */
function terminZeile(termin: Service): ReactNode {
  return (
    <>
      {termin.name} · {termin.weekday.slice(0, 2)} {termin.day}. {termin.month} · {termin.time}
    </>
  );
}

function vorschlaegeFuer(termin: Service, mitAblauf: Service[]): KopieVorschlag[] {
  return kopieVorschlaege(termin, mitAblauf).map((s) => ({
    id: s.id,
    titel: `${s.day}. ${s.month} · ${s.name}`,
    meta: s.songCount > 0 ? liedAnzahl(s.songCount) : 'ohne Lieder',
  }));
}
