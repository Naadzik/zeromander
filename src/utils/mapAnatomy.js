// Names the gerrymandering tactic each district embodies, from the player's
// perspective — turning "you won" into "here's *how* you rigged it." Pure,
// two-party only (grey is already resolved by the time this runs).
//
// PACK  — the opponent is warehoused (≥65% of a district): a landslide loss
//         that wastes all their surplus votes.
// CRACK — the opponent is a strong minority (40–49.9%) that still loses;
//         only counts as a scheme when it recurs across ≥2 districts.
export function analyzeMap(districtBreakdown, playerParty) {
  const ourKey = playerParty === 'red' ? 'red' : 'blue';
  const theirKey = ourKey === 'blue' ? 'red' : 'blue';

  const rows = districtBreakdown.map(d => {
    const our = d[ourKey] ?? 0;
    const their = d[theirKey] ?? 0;
    const total = our + their;
    const theirShare = total > 0 ? their / total : 0;
    const weWin = our > their;
    let label = 'clean';
    if (theirShare >= 0.65) label = 'pack';
    else if (weWin && theirShare >= 0.40) label = 'crack';
    return { id: d.id, our, their, theirSharePct: Math.round(theirShare * 100), weWin, label };
  });

  const packIds = rows.filter(r => r.label === 'pack').map(r => r.id);
  let crackIds = rows.filter(r => r.label === 'crack').map(r => r.id);
  // A single close win isn't a scheme — a crack pattern needs ≥2 districts.
  if (crackIds.length < 2) {
    rows.forEach(r => { if (r.label === 'crack') r.label = 'clean'; });
    crackIds = [];
  }
  const worstPackPct = packIds.length
    ? Math.max(...rows.filter(r => r.label === 'pack').map(r => r.theirSharePct))
    : 0;

  return { rows, packIds, crackIds, worstPackPct };
}

// One dry, cited line placing an efficiency gap next to reality. Returns null
// for small gaps (no need to editorialize a fair map).
export function efficiencyGapContext(gapPct) {
  const g = Math.abs(gapPct);
  if (g >= 13) return '~13% is the efficiency gap that sent Wisconsin’s 2011 Assembly map to the Supreme Court (Gill v. Whitford, 2018).';
  if (g >= 7) return 'Above ~7% is the range political scientists flag as a durable partisan advantage (Stephanopoulos & McGhee, 2015).';
  return null;
}
