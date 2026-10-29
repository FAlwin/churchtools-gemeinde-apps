import { useMemo, useRef } from 'react';
import { Icon } from '@ui/icons/icons';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { anmeldungenAus, listenZahlen } from '@shared/anmeldung/liste';
import { wartenTrotzPlatz } from '@shared/anmeldung/nachpruefung';
import { euroText } from '@shared/anmeldung/preis';
import { tagAusIso } from '@shared/ct/zeit';
import { tageBis } from '@shared/ct/datum';
import type { GeladenerStand } from './mitglieder';
import type { MitgliederZustand, ListenFilter } from './AnmeldungenReiter';
import { NAECHSTER, naechsterSchritt, type Schritt, type SchrittId } from './schritte';
import { anzahlText, datumText, restText } from './anzeige';
import e from './Einstieg.module.scss';

/**
 * **Vor der Freigabe: die Schritte** (U1, Variante D) – erledigte mit Haken, der nächste blau, darunter ein Satz und
 * ein Knopf dafür. Ohne Recht zum Einrichten nur die Leiste.
 */
export function SchrittLeiste({
  schritte,
  darf,
  onSchritt,
}: {
  schritte: Schritt[];
  darf: boolean;
  onSchritt: (id: SchrittId) => void;
}) {
  const jetzt = naechsterSchritt(schritte);
  const n = NAECHSTER[jetzt.id];
  return (
    <section className={e.karte} aria-label="Nächster Schritt">
      <ol className={e.schritte}>
        {schritte.map((s, i) => (
          <li
            key={s.id}
            className={s.fertig ? e.fertig : s === jetzt ? e.jetzt : undefined}
            aria-current={s === jetzt ? 'step' : undefined}
          >
            <span className={e.punkt}>{s.fertig ? <Icon name="check" size={14} /> : i + 1}</span>
            <span>
              <b>{s.titel}</b>
              <small>{s.text}</small>
            </span>
          </li>
        ))}
      </ol>
      {/* Ohne Recht sagt der Hinweis über der Seite schon, wer einrichtet – hier nicht noch einmal. */}
      {darf && (
        <div className={e.naechst}>
          <span>
            <b>Nächster Schritt:</b> {n.satz}
          </span>
          <FensterKnopf onClick={() => onSchritt(jetzt.id)}>{n.knopf}</FensterKnopf>
        </div>
      )}
    </section>
  );
}

function Kachel({
  titel,
  wert,
  unter,
  hervor = false,
  onClick,
}: {
  titel: string;
  wert: string;
  unter: string;
  /** Braucht Aufmerksamkeit (blau umrandet) – nur, wenn wirklich etwas zu tun ist, sonst wird es übersehen. */
  hervor?: boolean;
  onClick?: () => void;
}) {
  const inhalt = (
    <>
      <span>{titel}</span>
      <b>{wert}</b>
      <small>{unter}</small>
    </>
  );
  const cls = `${e.kachel}${hervor ? ' ' + e.hervor : ''}`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {inhalt}
    </button>
  ) : (
    <div className={cls}>{inhalt}</div>
  );
}

/**
 * **Nach der Freigabe: die Kennzahlen** (U1, Variante D) – Plätze, Warteliste, Zahlung offen, Anmeldeschluss. Ein
 * Klick führt in die passende Ansicht der Anmeldungen. Hervorgehoben wird nur die Warteliste, wenn trotz freiem Platz
 * jemand wartet (ChurchTools lässt niemanden von selbst nachrücken): offene Zahlungen sind kurz nach der Anmeldung der
 * Normalfall – eine Kachel, die immer leuchtet, sähe niemand mehr. Gezählt wird mit `listenZahlen` wie in der Liste.
 */
export function Kennzahlen({
  einstellungen,
  zustand,
  stichtag,
  maxPlaetze,
  anmeldeschluss,
  heute,
  zeitzone,
  onAnsicht,
  onAnmeldung,
}: {
  einstellungen: OeffentlicheEinstellungen;
  zustand: MitgliederZustand | null;
  stichtag: string;
  maxPlaetze: number | null;
  /** Anmeldeschluss aus ChurchTools (UTC), `null` = keiner. */
  anmeldeschluss: string | null;
  heute: string;
  zeitzone: string;
  onAnsicht: (f: ListenFilter) => void;
  /** Fenster „Anmeldung“ – nur, wer einrichten darf. */
  onAnmeldung?: () => void;
}) {
  // Beim Neuladen bleibt der letzte Stand stehen, wie in der Liste – sonst flackern die Zahlen.
  const letzter = useRef<GeladenerStand | null>(null);
  if (zustand?.art === 'fertig') letzter.current = zustand.stand;
  const stand = zustand?.art === 'fertig' ? zustand.stand : letzter.current;
  const z = useMemo(
    () =>
      stand ? listenZahlen(einstellungen, anmeldungenAus(einstellungen, stand, stichtag)) : null,
    [einstellungen, stand, stichtag],
  );
  if (zustand?.art === 'verboten') return null;
  // Scheitert das Laden, steht der Fehler bei der Liste – hier dann nur der Strich, nicht „Wird geladen …“.
  const laedt = !z && zustand?.art !== 'fehler';

  const frei = z && maxPlaetze !== null ? maxPlaetze - z.belegt : null;
  const nachruecken =
    !!z && wartenTrotzPlatz({ belegt: z.belegt, wartend: z.wartend, max: maxPlaetze });
  const schluss = (() => {
    if (!anmeldeschluss) return { wert: 'keiner', unter: 'Anmeldung bleibt offen' };
    const tag = tagAusIso(anmeldeschluss, zeitzone);
    const rest = tageBis(heute, tag);
    return { wert: datumText(tag), unter: rest < 0 ? 'vorbei' : restText(rest) };
  })();
  const ohne = '–';

  return (
    <section className={e.kacheln} aria-label="Kennzahlen">
      <Kachel
        titel="Plätze"
        wert={!z ? ohne : maxPlaetze === null ? String(z.belegt) : `${z.belegt} von ${maxPlaetze}`}
        unter={
          z ? anzahlText(z.anmeldungen, 'Anmeldung', 'Anmeldungen') : laedt ? 'Wird geladen …' : ''
        }
        onClick={() => onAnsicht('alle')}
      />
      <Kachel
        titel="Warteliste"
        wert={z ? String(z.wartend) : ohne}
        unter={
          !z
            ? ''
            : nachruecken
              ? `${frei === null ? 'Platz' : anzahlText(frei, 'Platz', 'Plätze')} frei – nachrücken lassen`
              : frei === null
                ? 'unbegrenzt'
                : frei > 0
                  ? `${anzahlText(frei, 'Platz', 'Plätze')} frei`
                  : 'kein Platz frei'
        }
        hervor={nachruecken}
        onClick={() => onAnsicht('warte')}
      />
      {(!z || z.kostet) && (
        <Kachel
          titel="Zahlung offen"
          wert={z ? euroText(z.offenCent) : ohne}
          unter={
            z
              ? `${anzahlText(z.offen, 'Anmeldung', 'Anmeldungen')} · ${euroText(z.eingegangenCent)} da`
              : ''
          }
          onClick={() => onAnsicht('offen')}
        />
      )}
      <Kachel
        titel="Anmeldeschluss"
        wert={schluss.wert}
        unter={schluss.unter}
        onClick={onAnmeldung}
      />
    </section>
  );
}
