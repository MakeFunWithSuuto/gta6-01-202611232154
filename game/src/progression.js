// Reputation: missions, courier runs, Sun Tokens, stolen cars and beaten gangsters earn rep;
// each level gives Rae a street title and a cash bonus.

export const REP_LEVELS = [
  { at: 0, title: 'Nobody' },
  { at: 100, title: 'Street Rat' },
  { at: 260, title: 'Known Face' },
  { at: 520, title: 'Wheelman' },
  { at: 900, title: 'Enforcer' },
  { at: 1500, title: 'Big Fish' },
  { at: 2400, title: 'Bay Legend' },
];

export function repLevel(rep) {
  let level = 0;
  for (let k = 0; k < REP_LEVELS.length; k += 1) if (rep >= REP_LEVELS[k].at) level = k;
  return level;
}

/** Progress (0..1) from this level's threshold to the next. */
export function repProgress(rep) {
  const level = repLevel(rep);
  const next = REP_LEVELS[level + 1];
  if (!next) return 1;
  return (rep - REP_LEVELS[level].at) / (next.at - REP_LEVELS[level].at);
}

export function earnRep(world, amount) {
  const before = repLevel(world.stats.rep ?? 0);
  world.stats.rep = (world.stats.rep ?? 0) + amount;
  const after = repLevel(world.stats.rep);
  if (after > before) {
    const bonus = after * 250;
    world.player.money += bonus;
    world.banner = { title: `Rep level ${after}: ${REP_LEVELS[after].title}`, sub: `+$${bonus} level-up bonus`, t: 3.5 };
    world.events.push({ type: 'pass' });
  }
}
