import { useMemo, useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { useLaden } from '@ui/ct/useLaden';
import { heuteImKalender } from '@shared/ct/zeit';
import { fremdeRegeln } from '@shared/organigramm/einrichtungPlan';
import { listeAuf } from '@shared/organigramm/einrichtungStand';
import {
  kuenftigeWechseljahre,
  offenesFenster,
  offenesFensterText,
} from '@shared/organigramm/einrichtungVorschau';
import { uebergaenge, wechseljahre } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { istLeitung } from '@shared/organigramm/mitglieder';
import { FertigAnsicht, Schritte } from './EinrichtenFertig';
import { FremdHinweise } from './FremdHinweise';
import { Hinweis } from './KjHinweis';
import { ladeRegelnDerStufen } from './ladeEinrichten';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';
import type { Start } from './start';
import { useSchreibLauf } from './useSchreibLauf';
import { WerTabelle } from './WerTabelle';
import { werTeil } from './werTeil';
import kj from './KinderJugend.module.scss';
import styles from './Einrichten.module.scss';

const SCHRITTE = ['Vorschau', 'Fertig'] as const;

/**
 * **„Wechseltage nachtragen“** (Bauplan O9-5d, Entwurf `o9-5-einrichten-v1`) – ein kurzes Fenster: Vorschau, dann Fertig.
 * Schreibt **nur die Regeln** aller Stufen und Wechsel-Gruppen, jetzt mit allen künftigen Jahren aus dem Ferienkalender.
 * Gruppen, Routinen, Status und die Einrichtung bleiben unberührt; die Ausnahmen („zu löschen“) auch – die Regeln fassen
 * sie nie an. Gibt es in einer Stufe fremde Regeln, geht es nicht weiter (das Schreiben würde sie ersetzen).
 *
 * `regelBis`: bis wohin die Regeln heute reichen (`undefined`: nicht bekannt – dann gelten alle Jahre als neu).
 */
export function NachtragenFenster({
  start,
  einrichtung,
  regelBis,
  onSchliessen,
  onGeschrieben,
}: {
  start: Start;
  einrichtung: Einrichtung;
  regelBis?: number;
  onSchliessen: () => void;
  onGeschrieben: () => void;
}) {
  const heute = useMemo(() => heuteImKalender(), []);
  const e = einrichtung.einstellung;
  const [schritt, setSchritt] = useState<1 | 2>(1);

  const ferien = useLaden(() => ladeFerien(e, heute), [e, heute]);
  const kinder = useLaden(
    () =>
      ladeKjDaten({ ...einrichtung, wechselGruppen: [] }, (rolleId) =>
        istLeitung(start.rollen, rolleId),
      ),
    [einrichtung, start.rollen],
  );
  const regeln = useLaden(() => ladeRegelnDerStufen(e.stufen.map((s) => s.gruppeId)), [e]);

  const jahre = useMemo(
    () =>
      ferien.stand.art === 'fertig' && ferien.stand.daten.art === 'da'
        ? kuenftigeWechseljahre(wechseljahre(ferien.stand.daten.ferien, e), heute)
        : [],
    [ferien.stand, e, heute],
  );
  const neu = useMemo(
    () => jahre.filter((j) => regelBis === undefined || j.jahr > regelBis),
    [jahre, regelBis],
  );
  const wer = useMemo(
    () => werTeil({ ferien, kinder, einstellung: e, jahre, kalender: e.ferienkalender }),
    [ferien, kinder, e, jahre],
  );
  const fremd = useMemo(
    () =>
      regeln.stand.art === 'fertig'
        ? fremdeRegeln(e.stufen, regeln.stand.daten)
        : regeln.stand.art === 'fehler'
          ? fremdeRegeln(e.stufen, new Map())
          : null,
    [regeln.stand, e],
  );
  const offen = useMemo(
    () => (wer.art === 'da' ? offenesFenster(wer.daten, heute) : null),
    [wer, heute],
  );

  const { stand, starten, geschrieben } = useSchreibLauf({
    art: 'nachtragen',
    soll: null,
    ausgang: null,
    von: { personId: start.ichId, name: start.vorname },
  });
  const laeuft = stand?.art === 'laeuft';
  const schliessen = () => {
    onSchliessen();
    if (geschrieben()) onGeschrieben();
  };
  const schreiben = () => {
    setSchritt(2);
    void starten();
  };
  const bereit = wer.art === 'da' && fremd?.art === 'frei' && neu.length > 0;

  const gruppenZahl = e.stufen.length + uebergaenge(e).length;
  const jahreText = listeAuf(neu.map((j) => String(j.jahr)));
  const label =
    neu.length === 0
      ? 'Nachtragen'
      : neu.length === 1
        ? `${neu[0].jahr} nachtragen`
        : `${neu[0].jahr}–${neu[neu.length - 1].jahr} nachtragen`;
  const nochNichtFertig =
    stand?.art === 'vorbei' && (stand.lauf.art === 'gestoppt' || !stand.lauf.ok);
  const nurGestoppt = stand?.art === 'vorbei' && stand.lauf.art === 'gestoppt';

  return (
    <Sheet
      title="Wechseltage nachtragen"
      onClose={schliessen}
      onHintergrund={schritt === 2 ? () => {} : schliessen}
      beschaeftigt={laeuft}
      cancelLabel={schritt === 2 ? null : undefined}
      breit
      zurueck={schritt === 2 && nurGestoppt ? () => setSchritt(1) : undefined}
      knoepfe={
        schritt === 1 ? (
          <FensterKnopf disabled={!bereit} onClick={schreiben}>
            {label}
          </FensterKnopf>
        ) : laeuft || !stand ? (
          <FensterKnopf disabled>Es wird geschrieben …</FensterKnopf>
        ) : nochNichtFertig ? (
          <>
            <FensterKnopf art="zweit" onClick={schliessen}>
              Später
            </FensterKnopf>
            <FensterKnopf onClick={schreiben}>Nochmal versuchen</FensterKnopf>
          </>
        ) : (
          <FensterKnopf onClick={schliessen}>Fertig</FensterKnopf>
        )
      }
    >
      <Schritte namen={SCHRITTE} schritt={schritt} />
      {schritt === 1 ? (
        <div className={styles.stapel}>
          {offen && (
            <Hinweis gelb>
              <b>{offenesFensterText(offen)}</b>
            </Hinweis>
          )}
          <p>
            Im Kalender „{e.ferienkalender}“ stehen neue Sommerferien. Diese Wechseltage kommen
            dazu:
          </p>
          <WerTabelle wer={wer} jahre={jahre} ab={regelBis} mitNamen={false} />
          <div className={styles.unter}>Das schreibt die Erweiterung in ChurchTools</div>
          <ul className={`${styles.anlage} ${kj.karte}`} aria-label="Das schreibt die Erweiterung">
            <li>
              <span className={`${kj.chip} ${kj.blau}`}>ergänzen</span>
              <span className={styles.anlageMitte}>
                <b>
                  {neu.length > 0
                    ? `Regeln in ${gruppenZahl} Gruppen um ${jahreText}`
                    : `Regeln in ${gruppenZahl} Gruppen`}
                </b>
                <span>Vorhandene Jahre und Ausnahmen bleiben, wie sie sind.</span>
              </span>
            </li>
          </ul>
          {neu.length === 0 && ferien.stand.art === 'fertig' && (
            <Hinweis gelb>
              <b>Im Ferienkalender stehen keine neuen Sommerferien.</b> Es gibt nichts nachzutragen.
            </Hinweis>
          )}
          <FremdHinweise fremd={fremd} was="Das Schreiben" neu={regeln.neu} />
        </div>
      ) : stand ? (
        <FertigAnsicht stand={stand} mitLeseRechten={false} />
      ) : null}
    </Sheet>
  );
}
