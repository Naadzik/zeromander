import '../../styles/ui.css';

// Stacked seat bar with a center majority tick, election-broadcast style.
// Blue fills from the left, red from the right, green (3-party) after blue.
// `tossup`: districts whose undecided (grey) population could still flip
// them — rendered as their own hatched segment between the camps.
export default function SeatBar({ seats, numDistricts, isThreeParty = false, tossup = 0 }) {
  const blue = seats.blue || 0;
  const red = seats.red || 0;
  const green = isThreeParty ? (seats.green || 0) : 0;
  const unassigned = Math.max(0, numDistricts - blue - red - green - tossup);
  const pct = n => `${(n / numDistricts) * 100}%`;

  const label = `Seats: ${blue} Urban Union, ${red} Heartland Alliance` +
    (isThreeParty ? `, ${green} Farmers Coalition` : '') +
    (tossup ? `, ${tossup} tossup` : '') +
    (unassigned ? `, ${unassigned} undecided` : '');

  return (
    <div className="seat-bar" role="img" aria-label={label}>
      {blue > 0 && <div className="seat-bar__seg" data-party="blue" style={{ width: pct(blue) }} />}
      {green > 0 && <div className="seat-bar__seg" data-party="green" style={{ width: pct(green) }} />}
      {tossup > 0 && <div className="seat-bar__seg seat-bar__seg--tossup" style={{ width: pct(tossup) }} />}
      {unassigned > 0 && <div className="seat-bar__seg seat-bar__seg--none" style={{ width: pct(unassigned) }} />}
      {red > 0 && <div className="seat-bar__seg" data-party="red" style={{ width: pct(red) }} />}
      <div className="seat-bar__tick" />
    </div>
  );
}
