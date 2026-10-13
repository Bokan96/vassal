import { useId } from 'react';
import type { HouseArms } from '../houses.ts';

const SHIELD = 'M3 2 H37 V19 C37 31 29 39.5 20 44 C11 39.5 3 31 3 19 Z';

function Charge({ arms }: { arms: HouseArms }) {
  const m = arms.metal;
  switch (arms.charge) {
    case 'chevron':
      return <path d="M2 34 L20 14 L38 34" fill="none" stroke={m} strokeWidth="7" />;
    case 'fess':
      return <rect x="0" y="16" width="40" height="10" fill={m} />;
    case 'bend':
      return <path d="M0 0 L40 46" stroke={m} strokeWidth="9" />;
    case 'cross':
      return (
        <>
          <rect x="15.5" y="0" width="9" height="46" fill={m} />
          <rect x="0" y="15" width="40" height="9" fill={m} />
        </>
      );
    case 'saltire':
      return <path d="M0 0 L40 46 M40 0 L0 46" stroke={m} strokeWidth="7" />;
    case 'pale':
      return <rect x="15" y="0" width="10" height="46" fill={m} />;
    case 'chief':
      return <rect x="0" y="0" width="40" height="13" fill={m} />;
    case 'pall':
      return <path d="M0 0 L20 20 L40 0 M20 20 L20 46" fill="none" stroke={m} strokeWidth="7" />;
    case 'lozenge':
      return <path d="M20 9 L30 22 L20 35 L10 22 Z" fill={m} />;
  }
}

export function Shield({ arms }: { arms: HouseArms }) {
  const clip = useId();
  return (
    <svg className="shield" viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="40" height="46" fill={arms.field} />
        <Charge arms={arms} />
        <path d="M3 2 H37 V12 C25 9 15 9 3 12 Z" fill="#fff" opacity="0.12" />
      </g>
      <path d={SHIELD} fill="none" stroke="var(--gold)" strokeWidth="1.6" />
    </svg>
  );
}
