import React, { useEffect, useState } from 'react';

// Long lists on a phone. 59 member cards at ~400px each is fifteen screens of
// scrolling, and the challenge list and ballot archive grow the same way.
//
// Only RENDERING is capped. Search and filters always run over the full array,
// so nothing becomes unreachable — type a name and it is found whether or not
// its card has been revealed yet.
export interface Capped<T> {
  visible: T[];
  hidden: number;
  total: number;
  showMore: () => void;
  showAll: () => void;
}

// Call this with an explicit type argument — useCapped<Member>(list, key).
// Left to infer, both real callers resolved T to unknown and every field access
// on a visible item failed to typecheck, while a minimal reproduction inferred
// correctly. I could not pin down why, so the type argument is required by
// convention rather than by a signature trick I do not understand.
export function useCapped<T>(items: T[], resetKey: unknown, step = 12): Capped<T> {
  const [limit, setLimit] = useState(step);
  // A new search or filter starts from the top again; leaving the old limit in
  // place would show "showing 36 of 4" after narrowing.
  useEffect(() => { setLimit(step); }, [resetKey, step]);
  return {
    visible: items.slice(0, limit),
    hidden: Math.max(0, items.length - limit),
    total: items.length,
    showMore: () => setLimit(current => current + step),
    showAll: () => setLimit(Number.MAX_SAFE_INTEGER)
  };
}

export const ShowMore: React.FC<{
  hidden: number;
  total: number;
  step?: number;
  noun: string;
  onMore: () => void;
  onAll: () => void;
}> = ({ hidden, total, step = 12, noun, onMore, onAll }) => {
  if (!hidden) return null;
  const button = 'px-4 py-2.5 rounded-xl border border-[#0D4734]/25 text-sm font-bold bg-white hover:bg-[#EBF3EF]';
  return <div className="mt-5 flex flex-wrap items-center gap-3">
    <button className={button} onClick={onMore}>Show {Math.min(step, hidden)} more</button>
    <button className={button} onClick={onAll}>Show all {total}</button>
    <p role="status" className="text-sm text-stone-600">
      Showing {total - hidden} of {total} {noun}
    </p>
  </div>;
};
