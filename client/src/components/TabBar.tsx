import type { IconName } from '@ui/icons/icons';
import { ReiterLeiste } from '@ui/bedienung/ReiterLeiste';
import { scrolleZumAnfang } from '../hooks/useZumAnfang';

export type TabId = 'termine' | 'lieder' | 'verfuegbarkeit' | 'mehr';

const TAB_META: Record<TabId, { label: string; icon: IconName }> = {
  termine: { label: 'Termine', icon: 'calendar' },
  lieder: { label: 'Lieder', icon: 'music' },
  // Abwesenheiten (#177): nur für aktive Mitglieder der gewählten Musikteam-Gruppen sichtbar. Die
  // Tab-ID bleibt `verfuegbarkeit` (gespeicherter Tab, Rechte-Name); die Beschriftung heißt seit dem
  // 19.09.2026 „Abwesenheiten" mit dem Symbol, das ChurchTools selbst dafür nutzt.
  verfuegbarkeit: { label: 'Abwesenheiten', icon: 'user-slash' },
  mehr: { label: 'Mehr', icon: 'cog-fill' },
};

interface TabBarProps {
  active: TabId;
  /** Sichtbare Tabs (rechteabhängig zusammengestellt). */
  tabs: TabId[];
  /** Ausgegraute Tabs (z. B. Liedersammlung ohne Netz) – bleiben tippbar, der Aufrufer erklärt warum. */
  dimmed?: TabId[];
  onChange: (tab: TabId) => void;
}

/**
 * Untere Navigationsleiste der Musik-App: ihre Reiter in der gemeinsamen `ReiterLeiste` (ui/bedienung,
 * auch im Dienstplaner). Tippt man den schon aktiven Reiter, geht es nach oben – wie in iOS-Apps. Der
 * Tipp auf die Statusleiste erreicht eine Web-App nicht (siehe `Screen.tsx`), dies ist der Ersatz dafür.
 */
export function TabBar({ active, tabs, dimmed = [], onChange }: TabBarProps) {
  return (
    <ReiterLeiste
      reiter={tabs.map((id) => ({ id, ...TAB_META[id] }))}
      aktiv={active}
      gedimmt={dimmed}
      onWechsel={onChange}
      onErneut={scrolleZumAnfang}
      tour="tabbar"
    />
  );
}
