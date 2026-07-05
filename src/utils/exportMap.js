import { PARTY } from './partyConfig.js';
import { computeCoreStats } from './computeGameStats.js';

export function exportMapPng(gameCanvas, { populationMap, districts, numDistricts, playerParty, isThreeParty, mapView, difficulty }) {
  const TOP = 70;
  const BOT = 44;
  const W = gameCanvas.width;
  const H = gameCanvas.height;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H + TOP + BOT;
  const ctx = out.getContext('2d');

  const BAR = '#060B16';
  const WHITE = '#FFFFFF';
  const SUBTEXT = 'rgba(255,255,255,0.7)';

  // Top bar
  ctx.fillStyle = BAR;
  ctx.fillRect(0, 0, W, TOP);

  const party = PARTY[playerParty];

  const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty);
  const ourPopPct = Math.round(core.ourPopPercent);
  const ourSeatCount = core.ourSeatCount;
  const ourSeatPct = Math.round(core.ourSeatsPct);

  const LY = 22; // label row y (textBaseline=middle → top gap = LY-6 = 16px)
  const VY = 44; // value row y  (bottom gap = 70-(VY+10) = 16px)

  // Left: "Playing as …"
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('Playing as', 20, LY);
  ctx.fillStyle = party.lightColor;
  ctx.fillRect(20, VY - 7, 14, 14);
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(party.label, 42, VY);

  // Center: population
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('Population', W / 2, LY);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.fillText(`${ourPopPct}%`, W / 2, VY);

  // Right: districts won — "4/6 (67%)" on one value row
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('Districts won', W - 20, LY);
  const pctStr = ` (${ourSeatPct}%)`;
  ctx.font = '15px system-ui, sans-serif';
  const pctW = ctx.measureText(pctStr).width;
  ctx.fillStyle = SUBTEXT;
  ctx.fillText(pctStr, W - 20, VY);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.fillText(`${ourSeatCount}/${numDistricts}`, W - 20 - pctW, VY);

  // Game canvas
  ctx.drawImage(gameCanvas, 0, TOP);

  // Bottom bar
  ctx.fillStyle = BAR;
  ctx.fillRect(0, TOP + H, W, BOT);

  const BY = TOP + H + BOT / 2;

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.fillText('Zeromander', W / 2, BY);

  ctx.textAlign = 'left';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('CC BY-SA 4.0', 16, BY);

  ctx.textAlign = 'right';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('naadzik.github.io/zeromander/', W - 16, BY);

  const link = document.createElement('a');
  link.download = `zeromander-${mapView}-${difficulty}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
}

// Stitches the player's map and the neutral map side by side into one PNG —
// the "you vs. a neutral commission" comparison, built for social sharing.
export function buildComparisonCanvas(playerCanvas, ghostCanvas, { playerStats, fairStats, playerParty, numDistricts }) {
  const TOP = 70;
  const BOT = 44;
  const GAP = 8;
  const MAP = Math.min(playerCanvas.width, ghostCanvas.width);
  const W = MAP * 2 + GAP;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = MAP + TOP + BOT;
  const ctx = out.getContext('2d');

  const BAR = '#060B16';
  const WHITE = '#FFFFFF';
  const SUBTEXT = 'rgba(255,255,255,0.7)';

  ctx.fillStyle = BAR;
  ctx.fillRect(0, 0, W, out.height);

  const party = PARTY[playerParty];
  const LY = 22, VY = 44;
  const leftCx = MAP / 2;
  const rightCx = MAP + GAP + MAP / 2;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Left header: the player's map
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = party.lightColor;
  ctx.fillText(`YOUR MAP — ${party.label.toUpperCase()}`, leftCx, LY);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.fillText(
    `${playerStats.ourSeatCount}/${numDistricts} seats · ${Math.round(playerStats.ourPopPercent)}% votes`,
    leftCx, VY
  );

  // Right header: the neutral map
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('NEUTRAL MAP (party-blind)', rightCx, LY);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.fillText(`${fairStats.ourSeatCount}/${numDistricts} seats`, rightCx, VY);

  ctx.drawImage(playerCanvas, 0, TOP, MAP, MAP);
  ctx.drawImage(ghostCanvas, MAP + GAP, TOP, MAP, MAP);

  // Footer
  const BY = TOP + MAP + BOT / 2;
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.fillText('Zeromander', W / 2, BY);
  ctx.textAlign = 'left';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = SUBTEXT;
  ctx.fillText('CC BY-SA 4.0', 16, BY);
  ctx.textAlign = 'right';
  ctx.fillText('naadzik.github.io/zeromander/', W - 16, BY);

  return out;
}

// Native share sheet where available (mobile → straight into Twitter/X etc.),
// download fallback everywhere else. Returns which path was taken.
export async function shareOrDownloadCanvas(canvas, { filename, text }) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (blob && typeof navigator !== 'undefined' && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return 'shared';
      } catch (err) {
        // AbortError = user closed the sheet; treat as done, don't force a download.
        if (err && err.name === 'AbortError') return 'shared';
        // Anything else: fall through to download.
      }
    }
  }
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
  return 'downloaded';
}
