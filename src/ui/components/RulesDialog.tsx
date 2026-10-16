import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n.ts';
import { CombinationsTable } from './CombinationsBoard.tsx';

function RulesEn() {
  return (
    <>
      <p>
        Win the allegiance of <strong>any 5</strong> noble houses, or <strong>3 adjacent</strong>{' '}
        ones, by assigning people of influence (cards) to them.
      </p>
      <h3>Your turn</h3>
      <ol>
        <li>Play a card from your hand to a house on your side (at most 3 per house).</li>
        <li>Draw a card while the draw pile lasts.</li>
        <li>Houses are evaluated and claimed automatically.</li>
      </ol>
      <h3 className="rules__centered">Combinations</h3>
      <CombinationsTable />
      <p>
        Within the same level the higher combined rank wins (A = 1, J = 11, Q = 12, K = 13). Aces
        are low only: Q K A is not a sequence. If still tied, whoever completed their alliance first
        wins. Three of a Kind is a house rule added to the original game.
      </p>
      <h3>Claiming houses</h3>
      <ul>
        <li>When both alliances at a house are complete, the stronger one claims it.</li>
        <li>
          At the end of your turn you also claim any house where your complete alliance cannot be
          beaten by any cards not yet on the table. This proof happens automatically.
        </li>
        <li>Cards can still be played to a claimed house, but it no longer changes hands.</li>
      </ul>
      <h3>Jokers</h3>
      <p>
        Unless the game is played without wildcards, each player starts with one joker. It mirrors
        whatever card makes its alliance strongest, even a card already in play.
      </p>
    </>
  );
}

function RulesSr() {
  return (
    <>
      <p>
        Osvoji <strong>5 kuća</strong> (kolona) ili <strong>3 susedne kuće</strong> tako što im
        dodeljuješ jače kombinacije od protivnika.
      </p>
      <h3>Tvoj potez</h3>
      <ol>
        <li>Odigraj kartu na kuću sa svoje strane (najviše 3 karte po kući).</li>
        <li>Izvuci kartu iz špila.</li>
      </ol>
      <h3 className="rules__centered">Kombinacije</h3>
      <CombinationsTable />
      <p>
        Unutar istog nivoa pobeđuje veći zbir vrednosti (A = 1, J = 11, Q = 12, K = 13). As je samo
        najniža karta: Q K A nije niz. Ako je i dalje nerešeno, pobeđuje onaj ko je prvi završio
        savez. Tripleta je kućno pravilo dodato originalnoj igri.
      </p>
      <h3>Osvajanje kuća</h3>
      <ul>
        <li>Kada oba igrača popune istu kuću sa svojih 3 karata, jači igrač je osvaja.</li>
        <li>
          Na kraju svog poteza igrač takođe osvaja i svaku kuću gde dokazano ne može biti nadmašen.
          Ovaj dokaz se izvodi automatski.
        </li>
      </ul>
      <h3>Džokeri</h3>
      <p>
        Osim u igri bez džokera, svaki igrač počinje sa jednim džokerom. On postaje karta koja
        njegov savez čini najjačim, čak i karta koja je već u igri.
      </p>
    </>
  );
}

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog rules" onClose={onClose} aria-labelledby="rules-title">
      <header className="dialog__header">
        <h2 id="rules-title">{t.howToPlay}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t.closeRules}>
          ✕
        </button>
      </header>
      <div className="rules__body">{lang === 'sr' ? <RulesSr /> : <RulesEn />}</div>
    </dialog>
  );
}
