// The circle method: fix one team, rotate everyone else around it one
// position per round. This is the standard algorithm for generating a
// round-robin schedule and it has a real mathematical guarantee - across
// up to (n-1) rounds, no pair of teams ever repeats. We only need the
// first 29 of the 63 possible rounds for 64 teams, which this naturally
// supports: generating fewer rounds than the maximum is always safe,
// generating more than (n-1) is what would start repeating pairs.
//
// Odd team counts get a "bye" - one team sits out each round rather than
// forcing an uneven pairing. Handled by padding to an even count with a
// null placeholder internally.
export function generateRoundRobinSchedule(teamIds, numRounds) {
  const ids = shuffle([...teamIds]);
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push(null); // null = bye slot

  const n = ids.length;
  const arr = [...ids];
  const rounds = [];

  const maxPossibleRounds = n - 1;
  const roundsToGenerate = Math.min(numRounds, maxPossibleRounds);

  for (let r = 0; r < roundsToGenerate; r++) {
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

  return rounds; // rounds[0] is round 1, an array of [teamA, teamB] pairs (teamB may be null for a bye)
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
