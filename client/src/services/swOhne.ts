/**
 * Ersatz für `virtual:pwa-register/react` in der ChurchTools-Extension (#335).
 *
 * Unter `/ccm/<Kürzel>/` liefert ChurchTools die Seite aus – ein eigener Service Worker ist dort
 * bestenfalls fragil (Plan §6). Der Extension-Build bindet deshalb kein PWA-Plugin ein und lenkt
 * diesen Import hierher (`vite.config.ts`): Es gibt nie ein Update zu melden.
 */
import { useState } from 'react';

interface Optionen {
  onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void;
}

export function useRegisterSW(_optionen?: Optionen): {
  needRefresh: [boolean, (v: boolean) => void];
  offlineReady: [boolean, (v: boolean) => void];
  updateServiceWorker: (reload?: boolean) => Promise<void>;
} {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: () => Promise.resolve() };
}
