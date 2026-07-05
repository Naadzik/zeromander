import { useState } from 'react';

export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem('zeromander.tutorialSeen');
  });
  const [show3PartyTutorial, setShow3PartyTutorial] = useState(false);

  function dismissTutorial() {
    setShowTutorial(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('zeromander.tutorialSeen', '1');
    }
  }

  function dismiss3PartyTutorial() {
    setShow3PartyTutorial(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('zeromander.3partyTutorialSeen', '1');
    }
  }

  function show3PartyTutorialIfNew() {
    if (typeof window !== 'undefined' && !window.localStorage.getItem('zeromander.3partyTutorialSeen')) {
      setShow3PartyTutorial(true);
    }
  }

  return {
    showTutorial,
    show3PartyTutorial,
    openTutorial: () => setShowTutorial(true),
    dismissTutorial,
    dismiss3PartyTutorial,
    show3PartyTutorialIfNew
  };
}
