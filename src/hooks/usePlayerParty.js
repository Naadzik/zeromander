import { useState } from 'react';

export function usePlayerParty() {
  const [playerParty, setPlayerPartyState] = useState(() => {
    if (typeof window === 'undefined') return 'blue';
    return window.localStorage.getItem('zeromander.playerParty') || 'blue';
  });

  function setPlayerParty(party) {
    setPlayerPartyState(party);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('zeromander.playerParty', party);
    }
  }

  function togglePlayerParty() {
    setPlayerParty(playerParty === 'blue' ? 'red' : 'blue');
  }

  return { playerParty, setPlayerParty, togglePlayerParty };
}
