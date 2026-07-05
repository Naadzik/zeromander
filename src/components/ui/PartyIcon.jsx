import '../../styles/ui.css';

// Broadcast-style party chip — replaces the 🔵🔴🟢 emoji.
export default function PartyIcon({ party }) {
  return <span className="party-dot" data-party={party} aria-hidden="true" />;
}
