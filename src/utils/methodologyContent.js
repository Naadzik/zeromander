// The /methodology page's content, in one place.
//
// EVERY NUMBER HERE MUST MATCH THE SHIPPED CODE. This page is the game's
// public claim to being defensible, so a stale constant here is a bug of the
// worst kind — the audit's own instruction was that a claim the cited source
// doesn't support is a bug to report. When a model constant changes, change
// the sentence that quotes it in the same commit.
//
// Values quoted below, and where they live:
//   city/rural anchors 85% / 5%, γ 1.9, D₀ 31 ....... V2 in mapGenerator.js
//   vote-share tolerance 0.14pp .................... Spec 5 T1 (check)
//   break shock σ 7pp, cluster σ 8pp, anchor 0.5 ... greyReveal.js
//   swing: 20% waves 5–9, calm N(0,2.6)±5 .......... swingModel.js
//   elasticity 1.2 rural / 0.8 core, district σ 2 .. swingModel.js
//   midterm penalty 2.5pp .......................... swingModel.js
//   ensemble 25 maps (15 on large), median score ... neutralEnsemble.js
//   completion gate: range ≤ 10%; draw band ±5% .... legalConstraints.js
//   mean–median flags ~13–15pp (own-generator p95) . litigation.js
//   neutral compactness ~21–41%, neutral EG 2–10% .. measured on v2 boards
//
// Each section is layered: `plain` (the in-game register) then `fine` (what a
// reviewer needs), then sources. Short forms for in-game tooltips live in
// metricDescriptions.js — the two must not contradict each other.

export const METHODOLOGY_SECTIONS = [
  {
    id: 'board',
    title: 'How the board is made',
    plain:
      'Every board is a small fictional state, grown from a random seed: a few cities, suburbs that thin out into countryside, and two made-up parties — Urban Union, strongest downtown, and Heartland Alliance, strongest in the countryside. The daily board is grown from the date itself, which is why every player on Earth gets the identical map.',
    fine: [
      'The generator places 2–4 city centres and sizes them by the rank-size rule: city i gets a footprint proportional to 1/√rank, so populations scale roughly as 1/rank (Auerbach 1913; Zipf 1949; Gabaix 1999). With only 2–4 cities we claim rank-size-consistent heterogeneity, not the asymptotic law — the full city-size distribution is better described as lognormal (Eeckhout 2004).',
      'Density falls off from each centre following Clark\'s law — the negative-exponential gradient D(u) = D₀·e^(−γu) observed in real cities since 1951 — fitted here at D₀ = 31 and γ = 1.9 per city radius, so a smooth gradient reproduces the density tiers the game used before it.',
      'Party is assigned per cell by a single Bernoulli draw whose probability follows a continuous urban–rural gradient: about 85% Urban Union in the city cores, 5% in deep countryside, with a logistic ramp through the suburbs. The urban anchor is calibrated to the "density divide" literature, where big-city cores vote roughly 70–90% for the urban party (Rodden 2019; Wilkinson 2019). The rural floor is deliberately lower than that literature\'s 25–35% figure for rural counties, for a reason worth stating plainly: the published number is a VOTE share, while ours is a per-cell mixture — a stricter quantity — and a higher floor made the countryside read as visual noise rather than as territory. It is a legibility choice, not a finding.',
      'Two correction passes then land the displayed vote share within 0.14 points of the stated target, so "X% of the vote" is always honest. Those passes never strip the countryside\'s sparse minority-party cells: no county on the board is ever 100% one party.',
    ],
    disclosure:
      'Deliberate simplification, disclosed: each cell is 100% one party. Real precincts are mixtures; we reject "purple" cells for legibility — you should be able to read the map at a glance. Because the MIXTURE of cells follows the continuous gradient, county-level vote shares still span a wide range and the suburbs contain genuinely mixed territory, though on a population-weighted basis only a small share of counties land in a 40–60% band. The consequence to know: packing and cracking are somewhat cleaner in Zeromander than in reality, where mapmakers work with margins, not monoliths.',
    sources:
      'Clark, "Urban Population Densities," J. Royal Statistical Society A 114 (1951); Auerbach (1913); Zipf, National Unity and Disunity (1949); Gabaix, "Zipf\'s Law for Cities," QJE 114 (1999); Eeckhout, AER 94 (2004); McDonald, "Econometric Studies of Urban Population Density," J. Urban Econ. 26 (1989); Rodden, Why Cities Lose (2019); Wilkinson, "The Density Divide" (Niskanen Center, 2019).',
  },
  {
    id: 'election-night',
    title: 'Election night: undecideds, swing and the decade',
    plain:
      'Grey areas are undecided voters. They don\'t count for anyone until election night, when each undecided neighbourhood makes up its mind — mostly leaning the way its surroundings lean, but with a genuine element of surprise, and with one nationwide mood that pushes all of them the same direction at once. That last part is why a "safe" map can shatter: some years, the late deciders break the same way everywhere.',
    fine: [
      'Undecided cells resolve in spatially contiguous clusters, not as independent coin flips. Each cluster\'s lean = 50% + 0.5·(local decided lean − 50%) + β + ε, where β ~ Normal(0, 7 points) is drawn ONCE per election — the systematic "late deciders broke one way" shock — and ε ~ Normal(0, 8 points) is per-cluster idiosyncrasy; leans clamp to [5%, 95%]. The half-strength anchor to local partisanship reflects that late deciders are disproportionately weak partisans, activated toward local fundamentals but not fully (Gelman & King 1993; Fournier et al. 2004; Panagopoulos 2016 — the once-popular "incumbent rule" decayed after 1992). The election-wide shock is sized so a 2016-Wisconsin-style break is roughly a 2σ tail event, with "historically, undecideds split about evenly" as the central case. This matters more than it sounds: before this model each cluster drew independently, which made a uniform nationwide break — the documented 2016 pattern — effectively impossible, because independent clusters average out.',
      'National swing. Swings are uniform across districts in the base model — Butler\'s classic uniform national swing, the same counterfactual engine used by Gelman & King (1994) and validated as an approximation by Katz, King & Rosenblatt (2020). A cell\'s responsiveness to that swing then scales with density: rural about 1.2×, dense core about 0.8×, with the population-weighted mean pinned at exactly 1.0 so the headline swing stays honest. This reflects that low-density areas have swung hardest in recent US cycles (Scala & Johnson 2017; Rodden 2019) and the spread of published elasticity scores. District-level noise of about 2 points follows the stochastic-uniform-swing tradition. Disclosed: this is direction-symmetric responsiveness, not one-way realignment — the game does not model secular realignment inside a decade.',
      'The Decade. Each cycle\'s national swing is drawn as: 80% of years Normal(0, 2.6 points) clamped to ±5; 20% of years a "wave" of 5–9 points whose magnitude gets less likely the larger it is. These constants are fitted to the 39 postwar House cycle-to-cycle two-party vote changes (1946–2024): mean |swing| 3.0 points, SD 3.65, P(|swing| ≥ 5) ≈ 23%, maximum 8.9 (2008→2010). The famous waves — 1994, 2006, 2018 — were about 5–7 points, so the model\'s wave floor of 5 includes them. With midterm structure on, the White-House party takes a 2.5-point penalty at midterm cadence: the president\'s party lost House seats in 32 of 33 midterms from 1862 to 1990 (Tufte 1975; Campbell 1991).',
      'The ground moves too. Between elections the electorate itself shifts. Growth is modelled as a function of local density: fastest in the inner-suburban ring (peaking around 2.6× mean density), slower in the densest cores, and negative in deep countryside — the ordering the 2010–2020 Census shows (big-metro suburbs +10.2%, cities +8.4%, nonmetro −0.6%). A fringe cell beside existing development also sprawls outward instead of declining, because real development is overwhelmingly adjacent to what is already built (Makse, Havlin & Stanley 1995; Clarke, Hoppen & Gaydos 1997; Burchfield et al. 2006). The total electorate is held constant: seats are reapportioned, so a fixed map faces a shifting electorate — which is the whole point of the mode. Two disclosed simplifications: a sprawling cell keeps its party, which mechanically favours the metro party, and because that growth concentrates the metro party\'s voters it also packs them under winner-take-all rules — a party can gain vote share across the decade and still lose ground in seats (Chen & Rodden 2013).',
      'Too close to call. A district shows TOSSUP when the decided margin is within what the undecideds could realistically move — half their number, the realistic break deviation in typical territory. A wider "uncalled" tier covers the full mathematical range, in the spirit of the AP\'s no-call rule: the trailing side could still catch up.',
    ],
    sources:
      'Butler, in Nicholas (1951); Gelman & King, BJPS 23 (1993) and AJPS 38 (1994); Katz, King & Rosenblatt, APSR 114 (2020); AAPOR, "An Evaluation of 2016 Election Polls" (2017); Panagopoulos, "Late Deciders in U.S. Presidential Elections" (2016); Fournier et al., Electoral Studies 23 (2004); Shirani-Mehr, Rothschild, Goel & Gelman, JASA 113 (2018); Tufte, APSR 69 (1975); Campbell, J. Politics 53 (1991); Scala & Johnson, ANNALS 672 (2017); Makse, Havlin & Stanley (1995); Clarke, Hoppen & Gaydos (1997); Burchfield, Overman, Puga & Turner, QJE 121 (2006); Frey/Brookings and USDA ERS county estimates, 2010–2020; Brookings/Vital Statistics on Congress and Sabato\'s Crystal Ball (House national vote series).',
  },
  {
    id: 'baseline',
    title: 'The party-blind baseline and "seats stolen"',
    plain:
      'After you draw, we draw the same state blind — an algorithm that only sees population and geography, never party — twenty-five times, from twenty-five fixed seeds. Those party-blind maps typically give your party some number of seats; your score is how many seats your map got beyond the party-blind median. That\'s the number you stole with the pen.',
    fine: [
      'The baseline is an ensemble of 25 maps (15 on the largest boards) drawn from a deterministic seed schedule, each grown party-blind by a population-balancing, compactness-seeking region grower, and filtered to the same completion rule that binds you — the spread between the biggest and smallest district within 10%. The score compares your seat count to the ensemble MEDIAN, and the full range is displayed. The ghost map drawn on screen is the ensemble member whose seat count equals that median, so the map you can see always matches the number you are scored against. On typical boards the ensemble\'s seat outcomes span two to four different values, which is precisely why a single map is not a baseline.',
      'Honest limitation one: twenty-five maps from a seed-and-grow sampler is NOT a uniform sample of all legal plans — samplers of this family are known to produce biased samples (Fifield, Higgins, Imai & Tarr 2020). We therefore claim only "what this party-blind procedure typically draws", never "the distribution of all fair maps". This is a deliberately small, browser-scale version of the ensemble analyses used in litigation and scholarship (Chen & Rodden 2013; Chikina, Frieze & Pegden 2017; DeFord, Duchin & Solomon 2021; Herschlag et al. 2020), where ensembles of 1,000–24,000 plans were credited in Common Cause v. Rucho and League of Women Voters v. Pennsylvania.',
      'Honest limitation two: party-blind is not the same as outcome-neutral. In real geography, blind maps systematically cost the party clustered in cities — Chen & Rodden\'s "unintentional gerrymandering". Zeromander\'s synthetic boards are calibrated so the urban and rural parties are treated symmetrically by the blind baseline, but that is a property of our board model, not of blindness itself. On a real map, "the algorithm drew it blind" does not settle the fairness question.',
      'This is also why we say party-blind baseline, not "fair map": fair is a conclusion; party-blind is a procedure.',
    ],
    sources:
      'Chen & Rodden, "Unintentional Gerrymandering," QJPS 8 (2013); Chikina, Frieze & Pegden, PNAS 114 (2017); DeFord, Duchin & Solomon, "Recombination," HDSR 3.1 (2021); Fifield, Higgins, Imai & Tarr, JCGS 29 (2020); Herschlag et al., Statistics and Public Policy 7 (2020); Common Cause v. Rucho, 318 F. Supp. 3d 777 (M.D.N.C. 2018); League of Women Voters v. Commonwealth, 178 A.3d 737 (Pa. 2018).',
  },
  {
    id: 'efficiency-gap',
    title: 'The efficiency gap',
    plain:
      'Count each side\'s wasted votes — every vote in a district they lost, plus every vote past the halfway line in a district they won. Packing and cracking both show up as one party wasting votes faster than the other. The gap is who wasted more, as a share of all votes. We show it signed ("12.7% favouring Heartland ≈ 1.3 seats") and judge it against the same board\'s party-blind baseline, not against thresholds built for real 99-seat legislatures.',
    fine: [
      'Per district: the loser wastes every vote cast for it; the winner wastes everything beyond exactly half the district total. The gap is the net difference divided by all votes cast (Stephanopoulos & McGhee 2015). We compute the full wasted-votes form rather than the popular shortcut EG = (S−½) − 2(V−½), because our districts have unequal turnout by design; on well-balanced boards the two forms agree to within about 0.7 points, and the full form stays exact for any turnout (Veomett 2018 on why turnout matters).',
      'Know what zero means: EG = 0 is NOT proportionality. It corresponds to a seats–votes line with slope 2 — each point of vote share "should" buy two points of seat share — a fact that matters at the 52–62% vote shares our boards use (Bernstein & Duchin 2017). A perfectly proportional map of a 57–43 state scores about 7 points.',
      'Thresholds in the literature — 8% or two seats (Stephanopoulos & McGhee), 7% (the Whitford plaintiffs) — were proposed for real statewide maps. On a ten-district board one flipped seat moves the gap by about ten points, and this game\'s own party-blind maps routinely score several points from geography alone, so we benchmark against the board\'s own neutral baseline instead.',
      'Legal status, stated exactly: the district court in Whitford v. Gill (2016) credited the efficiency gap as evidence; the Supreme Court in Gill v. Whitford (2018) vacated on standing WITHOUT endorsing the metric; Rucho v. Common Cause (2019) then closed federal courts to partisan-gerrymandering claims entirely. The gap lives on in state courts, scholarship — and games.',
    ],
    sources:
      'Stephanopoulos & McGhee, 82 U. Chi. L. Rev. 831 (2015); McGhee, ELJ 16 (2017); Bernstein & Duchin, Notices of the AMS 64(9) (2017); Veomett, ELJ 17 (2018); Cover, 70 Stan. L. Rev. 1131 (2018); Whitford v. Gill, 218 F. Supp. 3d 837 (W.D. Wis. 2016); Gill v. Whitford, 585 U.S. 48 (2018); Rucho v. Common Cause, 588 U.S. 684 (2019).',
  },
  {
    id: 'compactness',
    title: 'Compactness, and the county borders you cut',
    plain:
      'Are your districts chunky or snaky? We compare each district\'s area to its boundary length — 100% is a perfect square, the roundest shape a cell map allows. The party-blind maps on this geometry typically land around 20–40%; a long thin bar scores under 20%. Contorted shapes don\'t lose lawsuits by themselves — they\'re the evidence that makes judges look harder at everything else.',
    fine: [
      'We report the grid isoperimetric quotient IQ = 16·A/P², where A is cell count and P is the count of exposed rook edges (board edges count toward the perimeter, matching real practice where state borders do). On a square grid the isoperimetric optimum is the square, not the circle: P ≥ 4√A (Harary & Harborth 1976), so IQ ≤ 1 with equality exactly for perfect squares. This is the Polsby-Popper idea (4πA/P², itself Cox\'s 1927 isoperimetric quotient) rescaled by 4/π for honest grid normalisation — a circle-normalised score cannot exceed π/4 ≈ 0.785 on cell geometry, so "100%" was previously unreachable by construction.',
      'Two disclosed grid artefacts: scores are resolution-dependent — the "coastline" effect — so our fixed grid makes them comparable WITHIN Zeromander but not against published real-map Polsby-Popper values, whose congressional mean is about 0.27; and boundaries at 45° cost up to √2 more perimeter than axis-aligned ones, a penalty measured at roughly 2× for the same shape rotated. The plan average covers drawn districts only, so a half-finished map reports shape, not progress.',
      'The literature calls contour-based scores unstable under discretisation and prefers discrete measures for grid and graph settings (Duchin & Tenner; Barnes & Solomon), so the end-of-game report also shows a cut-edges count: the number of neighbouring COUNTY pairs your plan places in different districts, displayed beside the same count for the party-blind map of the same board. We count on the county dual graph rather than on grid cells deliberately — the cited methods count cut edges on the graph of the units being assigned, and counties are what you assign here. A cell-pair count would merely re-measure boundary length and would inherit the same diagonal artefact as the perimeter score, adding no independent information.',
      'Legal status: compactness is a "traditional districting principle" (Shaw v. Reno) and a requirement in many state laws, but NOT a federal mandate — and compact maps can still be badly biased (Chen & Rodden 2013), which is why "compact districts are harder to gerrymander" is a safeguard, not a guarantee.',
    ],
    sources:
      'Polsby & Popper, 9 Yale L. & Pol\'y Rev. 301 (1991); Cox, J. Paleontology 1 (1927); Harary & Harborth, "Extremal Animals," J. Combinatorics (1976); Duchin & Tenner, "Discrete Geometry for Electoral Geography" (2018/2024); Barnes & Solomon, "Gerrymandering and Compactness" (2020); DeFord, Duchin & Solomon, HDSR 3.1 (2021); Validi & Buchanan, Networks 80 (2022); Shaw v. Reno, 509 U.S. 630 (1993); Chen & Rodden, QJPS 8 (2013).',
  },
  {
    id: 'symmetry',
    title: 'Disproportionality, mean–median, and bias at 50%',
    plain:
      'Three different questions people confuse. Disproportionality asks how far your seat haul drifts from your vote share — but winner-take-all normally hands the bigger party a bonus, so drift alone isn\'t cheating. Mean–median asks whether your MIDDLE district is stronger than your AVERAGE one, which is what packing actually looks like. Bias at 50% asks who would win if the election were exactly tied.',
    fine: [
      'Disproportionality: D = (seat share − vote share), in points — the two-party reduction of the Loosemore–Hanby (1971) and Gallagher (1991) indices. It is descriptive only: plurality systems systematically produce seat shares above vote shares for the leading party (the cube-law tradition, Kendall & Stuart 1950; Tufte\'s swing ratio, 1973), and U.S. courts expressly reject proportional representation as a constitutional entitlement (Davis v. Bandemer 1986; Rucho 2019). This metric was previously labelled "partisan asymmetry" in-game — a name that belongs to a different concept — so we renamed it rather than keep teaching the wrong term.',
      'Mean–median difference: MM = median − mean of your party\'s district two-party vote shares (McDonald & Best 2015); positive means the map is skewed toward that party. This is a true symmetry-family diagnostic — it detects skew in the DISTRIBUTION of districts rather than deviation from proportionality. Caveats we adopt from the literature: it is most informative when the statewide vote is near 50–50 (Katz, King & Rosenblatt 2020; DeFord et al. 2023), and on an 8–12 district board it carries real small-N noise. So the litigation gauge\'s flags are calibrated to the 95th and 99th percentiles of |MM| across 220 of this game\'s OWN party-blind maps per board size, which land near 13–15 points — not to congressional-scale values. Neutral maps on this deliberately clustered geography average about 5 points of skew with no intent at all, which is exactly why transplanted thresholds would mislead here.',
      'Partisan bias at 50%: shift every district\'s two-party share uniformly until the overall vote is tied, then take each party\'s seat share minus 50% (Gelman & King 1994, as operationalised by PlanScore). An exactly tied district counts half a seat to each side, which keeps the measure antisymmetric between the parties. It relies on the uniform-swing assumption, and we report it in whole seats ("in a tied election you\'d win 7 of 12") because with 12 or fewer districts it quantises in steps of 1/N — a smooth percentage would be false precision.',
      'One further diagnostic, mentioned for completeness and deliberately NOT shown in-game: declination (Warrington 2018) is undefined when one party wins every district, which is common at these board sizes.',
    ],
    sources:
      'Loosemore & Hanby, BJPS 1 (1971); Gallagher, Electoral Studies 10 (1991); Kendall & Stuart, BJS 1 (1950); Tufte, APSR 67 (1973); McDonald & Best, ELJ 14(4) (2015); Katz, King & Rosenblatt, APSR 114 (2020); DeFord et al., "Implementing Partisan Symmetry" (2023); Gelman & King, AJPS 38 (1994); PlanScore methodology (planscore.org); Warrington, ELJ 17 (2018); Davis v. Bandemer, 478 U.S. 109 (1986); Rucho v. Common Cause, 588 U.S. 684 (2019).',
  },
  {
    id: 'competitiveness',
    title: 'Competitiveness and your target',
    plain:
      'Competitive districts are the ones close enough that a normal election-to-election swing could flip them — they\'re what makes seats respond to voters at all. And your target is one seat above what the party-blind maps typically give you: that extra seat is the one you stole.',
    fine: [
      'A district is competitive when the winner\'s two-party share is 55% or less (a margin within 10 points), matching the swing-seat band of the Cook Political Report\'s Partisan Voting Index (D+5 to R+5; 82 of 435 seats at the 2023 PVI) and the marginal-seats tradition (Mayhew 1974). Real indices normalise against a national baseline over two elections; a fictional board has no nation, so the raw single-election share is the direct analogue. Responsiveness framing per Gelman & King (1994). Undecided population is excluded here — its uncertainty is the TOSSUP indicator, a different concept.',
      'The target is the party-blind ensemble median plus one, capped at the number of districts. We deliberately do NOT define it as proportionality: single-member plurality does not promise proportionality, and the ensemble-baseline logic — fairness judged against neutral line-drawing on THIS geography — is the standard the modern literature actually uses. Where no ensemble is in scope, the game falls back to the smallest seat count that beats your own vote share.',
    ],
    sources:
      'Cook Political Report, Partisan Voting Index (2023 release); Mayhew, "Congressional Elections: The Case of the Vanishing Marginals," Polity 6 (1974); Gelman & King, AJPS 38 (1994); Chen & Rodden, QJPS 8 (2013); Chikina, Frieze & Pegden, PNAS 114 (2017).',
  },
  {
    id: 'population',
    title: 'The legal layer: population equality',
    plain:
      'The one rule with no partisan escape hatch: districts must hold near-equal numbers of people. Zeromander enforces the real test — the gap between your biggest and smallest district, as a share of the ideal district — with the 10% line the courts use for state legislatures.',
    fine: [
      'Reynolds v. Sims (1964) established one person, one vote. The doctrinal quantity is the OVERALL RANGE — (largest − smallest) ÷ ideal — not each district\'s distance from ideal. Zeromander\'s completion gate is range ≤ 10%: the state-legislative "safe harbour" from Brown v. Thomson (1983), with the disclosure that the harbour has eroded. Plans under 10% have been struck down where the deviations systematically served one party or region (Cox v. Larios, summarily affirmed, 2004) — and in this game they always do.',
      'Congressional maps face a far stricter rule: deviations must be justified at near zero, and Karcher v. Daggett (1983) struck a plan whose range was 0.69%. Zeromander\'s boards play by the state-legislative rule.',
      'While you paint, each district also shows a ±5% band whose ceiling is ENFORCED — a county that would push a district past +5% is refused outright. That makes the aid sufficient as well as necessary: hold every district inside the band and the overall spread is guaranteed to pass, because the largest and smallest can then differ by at most 10%.',
    ],
    sources:
      'Reynolds v. Sims, 377 U.S. 533 (1964); Wesberry v. Sanders, 376 U.S. 1 (1964); Brown v. Thomson, 462 U.S. 835 (1983); Gaffney v. Cummings, 412 U.S. 735 (1973); Karcher v. Daggett, 462 U.S. 725 (1983); Cox v. Larios, 542 U.S. 947 (2004).',
  },
  {
    id: 'community',
    title: 'Communities and the Voting Rights Act',
    plain:
      'If a large, geographically compact community could form the majority of a district, and your map denies them every such district, federal law still applies — that door survived (Allen v. Milligan, 2023). But using the community too much is also illegal: packing them far beyond a majority triggers strict scrutiny. Mapmakers are squeezed from both sides — that\'s the Riverlands scenario\'s lesson.',
    fine: [
      'The scenario operationalises Thornburg v. Gingles (1986): an opportunity district is one where the community exceeds 50% of district population — a STRICT majority, the threshold from Bartlett v. Strickland (2009), because a community at exactly half cannot elect on its own votes. Courts use citizen voting-age population; in Zeromander everyone votes, so population stands in for CVAP — a disclosed simplification.',
      'The scenario\'s "fair share" (the community\'s population share times the number of districts, rounded) is valid ONLY because the scenario community is compact by construction. Section 2 expressly disclaims any right to proportional representation, and the real inquiry is how many ADDITIONAL compact majority districts could be drawn.',
      'The over-packing ceiling — flagged when an opportunity district exceeds 70% concentration and the fair share is already met — teaches Shaw v. Reno (1993) and Cooper v. Harris (2017). The 70% trigger is our game heuristic ("well past what\'s needed to elect"), not a doctrinal number.',
    ],
    sources:
      'Thornburg v. Gingles, 478 U.S. 30 (1986); Bartlett v. Strickland, 556 U.S. 1 (2009); Allen v. Milligan, 599 U.S. 1 (2023); Shaw v. Reno, 509 U.S. 630 (1993); Miller v. Johnson, 515 U.S. 900 (1995); Cooper v. Harris, 581 U.S. 285 (2017); 52 U.S.C. §10301(b).',
  },
  {
    id: 'litigation',
    title: 'Litigation risk: two dials, two courthouses',
    plain:
      'Federal exposure covers unequal populations and community dilution — claims any federal court will hear, anywhere. State-court exposure covers the partisan numbers: efficiency gap, skewed districts, contorted shapes. Since 2019, no federal court will hear those, however lopsided the map; whether anyone can sue depends on your state\'s constitution. Pennsylvania said yes (2018). North Carolina said yes (2022) — then re-heard the case with new justices and said no (2023). The map is the same; the forum decides.',
    fine: [
      'Risk is scored per legal channel — each channel is one actual cause of action in the forum where it is live — and the worst channel dominates, because a map dies to one good claim. The federal channels: equal population (ramping below the 10% line and jumping at it, where the burden shifts), VRA §2 dilution (the shortfall from feasible opportunity districts), and the Shaw/Cooper over-packing ceiling. The state channel blends the efficiency gap, district-distribution skew (mean–median) and shape evidence, and is always tagged state-court-only per Rucho v. Common Cause (2019).',
      'Every partisan signal is measured RELATIVE to this board\'s own party-blind baseline rather than against a fixed threshold. That is not a stylistic choice: on some boards the neutral map itself posts a large efficiency gap or a contorted-looking plan from geography alone, and a fixed threshold would flag a map drawn with no intent whatsoever. Judging the player against what blind line-drawing achieves on the same geography is both fairer and closer to what modern expert testimony actually presents.',
      'The two-dial display, the channel weights and the low/elevated/high bands are our game heuristic; the individual signals and thresholds come from the cases and papers cited throughout this page. The gauge estimates exposure — it does not strike maps down. The completion gate (population, contiguity) is what can.',
    ],
    sources:
      'Rucho v. Common Cause, 588 U.S. 684 (2019); League of Women Voters v. Commonwealth, 178 A.3d 737 (Pa. 2018); Harper v. Hall, 380 N.C. 317 (2022), overruled by Harper v. Hall, 384 N.C. 292 (2023); plus the population and VRA sources above.',
  },
  {
    id: 'rules',
    title: 'Rules the game enforces that law doesn\'t (and vice versa)',
    plain:
      'Zeromander never splits a county — painting claims whole counties, which is stricter than real law, where county splitting is common and only sometimes restricted. Contiguity is enforced absolutely; in reality it is near-universal but state-defined (water crossings, point contiguity). There are no incumbents, no primaries, no candidates, and 100% turnout of decided voters — the game isolates the geometry of representation from everything else elections contain.',
    fine: [],
    sources: '',
  },
];

// Every known simplification in one place — the audit's requirement that the
// page state exactly where the game departs from reality.
export const HONESTY_BOX = [
  {
    simplification: 'Cells are 100% one party',
    why: 'Map legibility — no purple mush',
    effect: 'Packing and cracking are cleaner than reality; county-level mixtures still restore realistic margins',
  },
  {
    simplification: 'Deep countryside is 5% urban-party, not the literature\'s 25–35%',
    why: 'That figure is a vote share; ours is a per-cell mixture, and a higher floor read as visual noise',
    effect: 'Rural counties are more one-sided than real ones — but never uniformly one party',
  },
  {
    simplification: '100% turnout of decided voters',
    why: 'No turnout model to hide assumptions in',
    effect: 'The efficiency gap\'s turnout sensitivities are mostly moot in-game; disclosed',
  },
  {
    simplification: 'Population stands in for citizen voting-age population',
    why: 'One population concept for a game',
    effect: 'VRA thresholds read on population, not eligible voters',
  },
  {
    simplification: 'Party-blind baseline is a 25-map seed-and-grow ensemble',
    why: 'Browser-scale determinism',
    effect: '"What this blind procedure typically draws", not "all fair maps" (Fifield et al. 2020)',
  },
  {
    simplification: 'Urban/rural baseline symmetry',
    why: 'A calibrated property of our board model',
    effect: 'On real maps, blind ≠ neutral (Chen & Rodden 2013) — don\'t generalise from this',
  },
  {
    simplification: 'Uniform swing plus density elasticity',
    why: 'The canonical counterfactual engine',
    effect: 'No realignment, no candidate effects within a decade',
  },
  {
    simplification: 'Sprawling cells keep their party',
    why: 'Keeps the decade drift deterministic and rng-free',
    effect: 'Mechanically favours the metro party; real suburbs diversify as they grow',
  },
  {
    simplification: 'Whole-county painting, and a hard +5% district ceiling',
    why: 'Tap-sized moves on a phone; a visible rule you cannot accidentally break',
    effect: 'Stricter than real law — real maps split counties and negotiate deviations',
  },
  {
    simplification: 'Fictional parties, synthetic geography',
    why: 'Nonpartisanship by construction',
    effect: 'Nothing here estimates any real state\'s maps',
  },
];

export const KEY_REFERENCES = [
  { text: 'Stephanopoulos & McGhee — Partisan Gerrymandering and the Efficiency Gap (2015)', href: 'https://chicagounbound.uchicago.edu/uclrev/vol82/iss2/4/' },
  { text: 'Bernstein & Duchin — A Formula Goes to Court, Notices of the AMS (2017)', href: 'https://www.ams.org/notices/201709/rnoti-p1020.pdf' },
  { text: 'DeFord, Duchin & Solomon — Recombination, Harvard Data Science Review (2021)', href: 'https://hdsr.mitpress.mit.edu/pub/1ds8ptxu' },
  { text: 'MGGG Redistricting Lab — ensemble methods for redistricting', href: 'https://mggg.org' },
  { text: 'PlanScore — partisan-bias methodology', href: 'https://planscore.org/metrics/' },
  { text: 'Rucho v. Common Cause, 588 U.S. 684 (2019) — federal courts closed to partisan-gerrymandering claims' },
  { text: 'Gill v. Whitford, 585 U.S. 48 (2018) — decided on standing; the efficiency gap was never endorsed' },
  { text: 'Allen v. Milligan, 599 U.S. 1 (2023) — VRA §2 vote-dilution claims survive' },
  { text: 'Brown v. Thomson, 462 U.S. 835 (1983) — the 10% overall-range line for state legislative maps' },
  { text: 'Reynolds v. Sims, 377 U.S. 533 (1964) — one person, one vote' },
];
