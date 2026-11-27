import { useMemo, type ReactNode } from 'react';
import type { Eintrag } from '@shared/protokolle/termine';
import {
  begrenzeLauf,
  buchungUmschalten,
  gemeinsamerStatus,
  LAUF_VORSCHLAEGE,
  NACHLAUF_MAX,
  STATUS_AUSWAHL,
  statusFuer,
  ressourceText,
  statusFuerAlle,
  VORLAUF_MAX,
  type Buchung,
  type BuchungsStatus,
  type Ressource,
} from '@shared/protokolle/terminRessourcen';
import { nachlaufZeit, vorlaufZeit } from '@shared/protokolle/terminRessourcenZeit';
import { MehrfachWahl, type MehrfachGruppe } from '@ui/bedienung/MehrfachWahl';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { Reihe } from './TerminFormular';
import formular from './TerminFormular.module.scss';
import styles from './TerminRessourcen.module.scss';

/**
 * Zahl + „min“ + Auswahl „Vorschlag“ – wie Vorlauf/Nachlauf im ChurchTools-Dialog. Frei tippbar. Die Auswahl steht danach
 * wieder auf „Vorschlag“, der gewählte Wert landet im Zahlenfeld. Bis 27.11.2026 war sie ein leerer Pfeil ohne Text –
 * Alwin: nicht intuitiv, nach der Wahl „kommt da nichts“.
 */
function LaufFeld({
  name,
  wert,
  max,
  onAendern,
  deaktiviert,
}: {
  name: string;
  wert: number;
  max: number;
  onAendern: (minuten: number) => void;
  deaktiviert: boolean;
}) {
  return (
    <span className={styles.lauf}>
      <input
        type="number"
        min={0}
        max={max}
        inputMode="numeric"
        className={`${formular.eingabe} ${styles.minuten}`}
        aria-label={name}
        value={wert}
        disabled={deaktiviert}
        onChange={(ev) => onAendern(begrenzeLauf(Number(ev.target.value), max))}
      />
      <span className={styles.einheit}>min</span>
      <select
        className={`${formular.eingabe} ${styles.vorschlag}`}
        aria-label={`${name}: Vorschlag wählen`}
        value=""
        disabled={deaktiviert}
        onChange={(ev) => {
          if (ev.target.value !== '') onAendern(Number(ev.target.value));
        }}
      >
        <option value="">Vorschlag</option>
        {LAUF_VORSCHLAEGE.filter((v) => v <= max).map((v) => (
          <option key={v} value={v}>
            {v} min
          </option>
        ))}
      </select>
    </span>
  );
}

/** Das Symbol zum Status: gelb = wartet, grün = bestätigt, rot = abgelehnt. */
function StatusSymbol({ status }: { status: BuchungsStatus }) {
  return (
    <span
      className={`${styles.symbol} ${status === 1 ? styles.wartet : status === 2 ? styles.ok : styles.nein}`}
      aria-hidden="true"
    >
      <Icon name={status === 1 ? 'clock' : status === 2 ? 'check' : 'x'} size={16} stroke={2.4} />
    </span>
  );
}

const statusLabel = (s: BuchungsStatus) => STATUS_AUSWAHL.find((x) => x.id === s)?.label ?? '';

interface Props {
  e: Eintrag;
  onAendern: (neu: Eintrag) => void;
  /** Die Ressourcen, die die Person buchen darf. */
  ressourcen: readonly Ressource[];
  laedt: boolean;
  fehler: Fehlermeldung | null;
  onNeu: () => void;
  /** Ressourcen, bei denen sie den Status setzen darf – bei den anderen steht „Wartet auf Bestätigung“ fest. */
  verwaltbar: ReadonlySet<number>;
  deaktiviert: boolean;
}

/**
 * **Der Reiter „Ressourcen“ des ChurchTools-Dialogs „Termin erstellen“** (W15-2): oben **Vorlauf** und **Nachlauf** als Vorgabe
 * (mit der errechneten Uhrzeit), dann die **Ressourcen** zum Anhaken (`MehrfachWahl`, mehrere auf einmal) und die Tabelle **Vorhandene Buchungen** – je Zeile
 * eigener Vorlauf und Nachlauf, Status (nur mit Recht wählbar) und ✕. Bei Ressourcen mit mehr als einem Stück (Stühle) kommt
 * die **Anzahl** dazu. Die Regeln stehen in `@shared/protokolle/terminRessourcen`.
 */
export function TerminRessourcen(p: Props) {
  const { e, deaktiviert: aus } = p;
  const nachId = useMemo(() => new Map(p.ressourcen.map((r) => [r.id, r])), [p.ressourcen]);
  const gebucht = useMemo(() => new Set(e.buchungen.map((b) => b.ressource)), [e.buchungen]);
  // Die Ressourcen nach Typ – die Reihenfolge kommt sortiert aus `ressourcenAus`.
  const gruppen = useMemo(() => {
    const m = new Map<string, MehrfachGruppe<number>>();
    for (const r of p.ressourcen) {
      const g = m.get(r.typ) ?? { titel: r.typ, optionen: [] };
      m.set(r.typ, {
        ...g,
        optionen: [
          ...g.optionen,
          {
            wert: r.id,
            text: r.name,
            name: ressourceText(r),
            zusatz: r.anzahl > 1 ? `(${r.anzahl})` : undefined,
          },
        ],
      });
    }
    return [...m.values()];
  }, [p.ressourcen]);
  // „Status für alle“ nur, wenn es mehr als eine Buchung gibt und mindestens eine davon verwaltbar ist.
  const mitStatusFuerAlle =
    e.buchungen.length > 1 && e.buchungen.some((b) => p.verwaltbar.has(b.ressource));
  const fuerAlle = gemeinsamerStatus(e.buchungen, p.verwaltbar);

  const aendern = (ressource: number, teil: Partial<Buchung>) =>
    p.onAendern({
      ...e,
      buchungen: e.buchungen.map((b) => (b.ressource === ressource ? { ...b, ...teil } : b)),
    });

  const zeile = (b: Buchung): ReactNode => {
    const r = nachId.get(b.ressource);
    const name = r?.name ?? `Ressource ${b.ressource}`;
    const darfStatus = p.verwaltbar.has(b.ressource);
    const status = statusFuer(b.status, darfStatus);
    return (
      <tr key={b.ressource}>
        <td data-label="Ressource" className={styles.name}>
          <span>{name}</span>
          {r && r.anzahl > 1 && (
            <label className={styles.menge}>
              <span>Anzahl</span>
              <input
                type="number"
                min={1}
                max={r.anzahl}
                inputMode="numeric"
                className={`${formular.eingabe} ${styles.mengeFeld}`}
                aria-label={`Anzahl ${name}`}
                value={b.menge}
                disabled={aus}
                onChange={(ev) =>
                  aendern(b.ressource, {
                    menge: Math.min(
                      r.anzahl,
                      Math.max(1, Math.floor(Number(ev.target.value)) || 1),
                    ),
                  })
                }
              />
              <span>von {r.anzahl}</span>
            </label>
          )}
        </td>
        <td data-label="Vorlauf">
          <LaufFeld
            name={`Vorlauf ${name}`}
            wert={b.vorlauf}
            max={VORLAUF_MAX}
            deaktiviert={aus}
            onAendern={(v) => aendern(b.ressource, { vorlauf: v })}
          />
        </td>
        <td data-label="Nachlauf">
          <LaufFeld
            name={`Nachlauf ${name}`}
            wert={b.nachlauf}
            max={NACHLAUF_MAX}
            deaktiviert={aus}
            onAendern={(v) => aendern(b.ressource, { nachlauf: v })}
          />
        </td>
        <td data-label="Status">
          <span className={styles.status}>
            <StatusSymbol status={status} />
            {darfStatus ? (
              <select
                className={`${formular.eingabe} ${styles.statusWahl}`}
                aria-label={`Status ${name}`}
                value={status}
                disabled={aus}
                onChange={(ev) =>
                  aendern(b.ressource, { status: statusFuer(Number(ev.target.value), true) })
                }
              >
                {STATUS_AUSWAHL.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <span>{statusLabel(status)}</span>
            )}
          </span>
        </td>
        <td className={styles.weg}>
          <ZeilenKnopf
            label={`Buchung ${name} entfernen`}
            disabled={aus}
            onClick={() =>
              p.onAendern({
                ...e,
                buchungen: e.buchungen.filter((x) => x.ressource !== b.ressource),
              })
            }
          >
            <Icon name="x" size={14} stroke={2.4} />
          </ZeilenKnopf>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.ressourcen}>
      <Reihe label="Vorlauf" gruppe>
        <LaufFeld
          name="Vorlauf"
          wert={e.vorlauf}
          max={VORLAUF_MAX}
          deaktiviert={aus}
          onAendern={(v) => p.onAendern({ ...e, vorlauf: v })}
        />
        <span className={styles.zeit}>{vorlaufZeit(e, e.vorlauf)}</span>
      </Reihe>
      <Reihe label="Nachlauf" gruppe>
        <LaufFeld
          name="Nachlauf"
          wert={e.nachlauf}
          max={NACHLAUF_MAX}
          deaktiviert={aus}
          onAendern={(v) => p.onAendern({ ...e, nachlauf: v })}
        />
        <span className={styles.zeit}>{nachlaufZeit(e, e.nachlauf)}</span>
      </Reihe>
      <Reihe label="Ressourcen" gruppe>
        <MehrfachWahl
          gruppen={gruppen}
          gewaehlt={gebucht}
          titel="Ressourcen wählen"
          platzhalter="Ressourcen wählen …"
          laedt={p.laedt ? 'wird geladen …' : undefined}
          deaktiviert={aus}
          feldKlasse={formular.eingabe}
          onUmschalten={(id) => {
            const r = nachId.get(id);
            if (r)
              p.onAendern({
                ...e,
                buchungen: buchungUmschalten(e.buchungen, r, {
                  vorlauf: e.vorlauf,
                  nachlauf: e.nachlauf,
                }),
              });
          }}
        />
      </Reihe>
      {p.fehler && (
        <p className={styles.leise} role="alert">
          {p.fehler.text} <TextKnopf onClick={p.onNeu}>Noch einmal versuchen</TextKnopf>
        </p>
      )}
      <h3 className={styles.titel}>Vorhandene Buchungen</h3>
      {mitStatusFuerAlle && (
        <label className={styles.fuerAlle}>
          <span>Status für alle</span>
          <select
            className={`${formular.eingabe} ${styles.statusWahl}`}
            value={fuerAlle ?? ''}
            disabled={aus}
            onChange={(ev) => {
              const neu = Number(ev.target.value);
              if (neu === 1 || neu === 2 || neu === 3)
                p.onAendern({ ...e, buchungen: statusFuerAlle(e.buchungen, neu, p.verwaltbar) });
            }}
          >
            {fuerAlle === null && <option value="">Verschieden</option>}
            {STATUS_AUSWAHL.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {e.buchungen.length ? (
        <table className={styles.tabelle}>
          <thead>
            <tr>
              <th scope="col">Ressource</th>
              <th scope="col">Vorlauf (min)</th>
              <th scope="col">Nachlauf (min)</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className={styles.nurVorleser}>Entfernen</span>
              </th>
            </tr>
          </thead>
          <tbody>{e.buchungen.map(zeile)}</tbody>
        </table>
      ) : (
        <p className={styles.leise}>Noch keine Ressource gebucht.</p>
      )}
    </div>
  );
}
