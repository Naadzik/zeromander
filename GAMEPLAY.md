# Zeromander Gameplay Guide

## Quick Start

1. **Open the game** → `npm run dev` → Visit `http://localhost:5173`
2. **Pick a difficulty** (Small/Medium/Large/3rd Party)
3. **Click districts** to select which one you're drawing (D1, D2, etc.)
4. **Click counties** on the map to add them to your district
5. **Goal**: Reach your target seat percentage while managing fairness

## How to Play

### Understanding the Map

- **Blue cells** = your party's voters
- **Red cells** = opposition voters  
- **Black borders** = county boundaries
- **Hovered county** = highlighted in yellow
- **Semi-transparent overlays** = districts you're creating

### Assigning Counties

1. **Select a district**: Click button D1, D2, D3, etc.
2. **Click on a county**: The entire county is added to that district
3. **Click again**: Removes the county from the district
4. **Rules**:
   - Districts must stay **contiguous** (connected)
   - Districts must have **±10% population variance** (shown as range)
   - You can't remove a county if it disconnects the district

### Winning

**Condition**: All districts assigned + reach target seat percentage

**Example**: In Easy difficulty with 55% target:
- You have 45% blue voters and need 55% of seats
- That means 3 out of 4 seats (75% blue seats) ← This is the actual required seats

**Notice**: You need MORE seats than your population percentage! Winning a disproportionate seat share is the classic *symptom* of a gerrymandered map — the game uses it as the win condition so you can feel the mechanism from the inside.

## Metrics Explained

### Blue Population %
Your party's share of all voters on the map.
- **Reading**: "45% of voters support your party"

### Blue Seats %
Your party's share of won districts.
- **Reading**: "Your party controls this % of seats"
- **Goal**: Make this higher than your population %!

### Efficiency Gap %
Measures how "unfair" the districting is (Stephanopoulos & McGhee, 2015).
- **What it measures**: Difference between wasted votes for each party
- **Lower is better**: below ~7–8% is generally considered acceptable
- **Extreme gerrymandering**: > 15%

**How it works**:
- Wasted votes = votes beyond 50% needed to win + ALL votes in losing districts
- Gap = |your wasted − their wasted| / total votes cast × 100

### Compactness % (Polsby-Popper)
How "round" and regular your districts are.
- **100% = perfect circle**
- **0% = extremely snaking/irregular**
- **Typical goal**: > 50% (somewhat compact)

**Why it matters**: More compact districts are easier to defend as non-partisan.

### Competitiveness %
Percentage of districts that are close/contested.
- **Calculation**: Districts where winner has 45-55% of votes
- **Higher is better**: More competitive elections
- **Lower indicates**: "Safe" districts for one party (bad sign for fairness)

### Partisan Asymmetry %
Difference between your seat share and vote share.
- **Formula**: |your seats % - your votes %|
- **Lower is better**: Means representation is proportional
- **Examples**:
  - You: 45% votes, win 3/6 seats (50%) = 5% asymmetry ✓
  - You: 45% votes, win 5/6 seats (83%) = 38% asymmetry ✗

## Strategy Tips

### For Winning with Minority Population (< 50%)

1. **Look for geographic clustering** of your voters
2. **Create "crescent" shaped districts** that connect voter clusters
3. **Concentrate just enough** of your votes to win districts (not too many!)
4. **Spread opposition** votes into districts you'll lose anyway
5. **Check population bars** - stay within the ±10% range

### For Fair Districts

1. **Avoid packing** = don't put all your voters in one district
2. **Avoid cracking** = don't split your voter clusters across many districts
3. **Natural boundaries** = follow county clusters to improve compactness
4. **Competitive districts** = try to make more districts close (45-55%)
5. **Population parity** = keep all districts near the target size

### Efficiency Gap Tricks

- Gap comes from wasted votes
- Your wasted = votes over 50% in winning districts + ALL votes in losing districts
- **To lower gap**: Win districts by small margins, don't blow them out
- **Maximum unfairness**: Win your districts 100%-0%, lose others 100%-0%

## Common Mistakes

❌ **Disconnecting districts** - Click carefully, you can't leave isolated counties
❌ **Too large/small districts** - Watch the population bar, stay in the green range  
❌ **Ignoring metrics** - Efficiency gap and asymmetry tell you if you're cheating
❌ **Forgetting the goal** - Check the Game Stats panel for your target

## Controls

| Action | Input |
|--------|-------|
| Select district | Click D1, D2, etc. buttons |
| Add county to district | Click county on map |
| Remove county | Click same county again |
| Hover to see county | Move mouse over map (yellow highlight) |
| Change difficulty | Click difficulty buttons |
| Regenerate map | Click "Generate Map" button |
| Adjust parameters | Use sliders (counties, population %) |

## What Gerrymanders Mean

### Cracking
Split your voters across many districts so you never have majority in any.
- You: 40% spread as 25%, 25%, 25%, 25% across 4 districts
- Result: Win 0 seats despite 40% population ← Unfair!

### Packing  
Concentrate all your voters into one district.
- You: 40% crammed into 1 district (100%), other districts 0%
- Result: Win 1 seat from 40% population (unfair in opposite way)

### Cracking + Packing
Combine both tactics. Some districts packed with your voters (you dominate), others cracked (they dominate).
- Result: You win 75% of seats despite 40% population ← This is gerrymandering!

## Real-World Context

Zeromander is based on real issues — and deliberately nonpartisan. The parties in the game are fictional, and both major U.S. parties have drawn aggressive gerrymanders where they held the pen:

- **Post-census redistricting**: After each census, whichever party controls a state's map-drawing has used it for advantage — in different states and cycles, both parties have done so
- **Measured unfairness**: The most extreme real-world congressional maps have shown efficiency gaps in the 10–15% range (Stephanopoulos & McGhee, 2015)
- **Recent cases**: U.S. Supreme Court cases (*Gill v. Whitford*, *Rucho v. Common Cause*) address partisan gerrymandering — *Rucho* (2019) held federal courts cannot police it, leaving it to states
- **Solutions**: Independent commissions, math-based criteria, transparency

The game shows why this matters: **Small changes in district lines = BIG changes in power — for whichever side draws them.**

---

Good luck, and remember: **With great redistricting power comes great responsibility!** 🗳️
