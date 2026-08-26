// The circle method: fix one team, rotate everyone else around it one
// position per round. This is the standard algorithm for generating a
// round-robin schedule and it has a real mathematical guarantee - across
// up to (n-1) rounds, no pair of teams ever repeats.
//
// Odd team counts get a "bye" - one team sits out each round rather than
// forcing an uneven pairing. Handled by padding to an even count with a
// null placeholder internally. With an odd count that also exceeds 29
// teams, it's mathematically impossible for every team to get exactly
// one bye within only 29 rounds (29 bye-slots can't cover more than 29
// teams) - some teams will play 28 real matches instead of 29. That's an
// inherent constraint of "odd headcount, fixed 29-round season," not a
// bug; the shuffle before generating means WHO ends up with the shorter
// count is random and unbiased, not systematically favoring anyone.
//
// A genuinely small league (fewer than 30 people) runs out of unique
// pairings before reaching 29 rounds - a full cycle only has (n-1)
// rounds. Rather than silently generating fewer rounds than requested
// (which would leave some gameweeks with zero H2H fixtures at all), this
// repeats the cycle with a fresh shuffle each time until all 29 rounds
// are filled - so this works correctly at any league size, not just the
// one this season happens to have.
export function generateRoundRobinSchedule(teamIds, numRounds) {
  const rounds = [];
  while (rounds.length < numRounds) {
    const cycle = generateOneCycle(teamIds);
    for (const round of cycle) {
      if (rounds.length >= numRounds) break;
      rounds.push(round);
    }
  }
  return rounds;
}

function generateOneCycle(teamIds) {
  const ids = shuffle([...teamIds]);
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push(null); // null = bye slot

  const n = ids.length;
  const arr = [...ids];
  const rounds = [];
  const roundsInFullCycle = n - 1;

  for (let r = 0; r < roundsInFullCycle; r++) {
    const pairings = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) {
        pairings.push([a, b]);
      } else {
        // Whichever side isn't null gets the bye this round.
        const byeTeam = a === null ? b : a;
        pairings.push([byeTeam, null]);
      }
    }
    rounds.push(pairings);

    // Rotate: keep position 0 fixed, rotate everyone else one step.
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return rounds;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
