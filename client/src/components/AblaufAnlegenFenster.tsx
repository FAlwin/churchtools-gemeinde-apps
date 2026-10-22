import type { Service } from '@shared/types/index';
import { kopieVorschlaege, vorlagenFuer } from '@shared/ct/ablaufVorschlaege';
import { AblaufAnlegenFenster as Fenster } from '@ui/ablauf/AblaufAnlegenFenster';
import { useAblaufAnlegen, useAblaufVorlagen } from '../hooks/useServices';
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

/**
 * **Ablauf anlegen** in der Musik-App (13.10.2026) – die Hülle um den gemeinsamen Baustein
 * (`ui/ablauf/AblaufAnlegenFenster`, seit E6-5a): Vorlagen und Anlegen über die Abfragen der App, „Wie eine frühere"
 * aus der Terminliste (mit Liedanzahl).
 */
export function AblaufAnlegenFenster({ termin, mitAblauf, onClose, onAngelegt }: Props) {
  const vorlagenQuery = useAblaufVorlagen(true);
  const anlegen = useAblaufAnlegen();

  async function onAnlegen(quelle: Parameters<typeof anlegen.mutateAsync>[0]['quelle']) {
    if (termin.kalenderId === undefined) {
      throw new Error(
        'Der Kalender dieser Veranstaltung ist unbekannt. Bitte die Liste neu laden.',
      );
    }
    await anlegen.mutateAsync({ eventId: termin.id, kalenderId: termin.kalenderId, quelle });
    onAngelegt(termin);
  }

  return (
    <Fenster
      // In Stücken wie vor E6-5a – als ein Text verschob sich die Laufweite um „30.“ minimal (Fotovergleich).
      fuer={
        <>
          {termin.name} · {termin.weekday.slice(0, 2)} {termin.day}. {termin.month} · {termin.time}
        </>
      }
      vorlagen={{
        liste: vorlagenFuer(vorlagenQuery.data ?? [], termin.kalenderId),
        laedt: vorlagenQuery.isLoading,
        fehler: vorlagenQuery.isError,
      }}
      vorschlaege={kopieVorschlaege(termin, mitAblauf).map((s) => ({
        id: s.id,
        titel: `${s.day}. ${s.month} · ${s.name}`,
        meta: s.songCount > 0 ? liedAnzahl(s.songCount) : 'ohne Lieder',
      }))}
      keineVorschlaege="Keine frühere Veranstaltung mit Ablauf in der Terminliste."
      onAnlegen={onAnlegen}
      onClose={onClose}
    />
  );
}
