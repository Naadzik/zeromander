import { createContext, useContext, useLayoutEffect, useState } from 'react';

// Visual editions:
//   'broadcast' — dark election-night TV dashboard (default)
//   'print'     — light newsprint THEME on the same dashboard (tokens only)
//   'paper'     — the Broadsheet: a distinct front-page shell for /game,
//                 sharing the print tokens but its own layout + map engine.
// Two attributes drive CSS: data-theme='print' carries the paper tokens for
// BOTH print and paper; data-edition='paper' additionally scopes the
// Broadsheet's structural styles. Keep key + values in sync with the
// no-flash boot script in index.html.
const THEME_KEY = 'zeromander.ui.theme';
const EDITIONS = ['broadcast', 'print', 'paper'];

// Cycle labels name the edition you'd switch TO.
export const NEXT_LABEL = {
  broadcast: 'Print edition',
  print: 'Broadsheet edition',
  paper: 'Broadcast edition',
};

const ThemeContext = createContext({
  edition: 'broadcast',
  cycleEdition: () => {},
  // Legacy aliases (canvas redraw deps destructure `theme`) — keep in sync.
  theme: 'broadcast',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [edition, setEdition] = useState(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return EDITIONS.includes(v) ? v : 'broadcast';
    } catch { return 'broadcast'; }
  });

  // useLayoutEffect, NOT useEffect: React flushes ALL layout effects before
  // ANY passive effect. The canvases redraw in passive effects that call
  // getComputedStyle() — the attributes must already be on <html> when they
  // run, or a cycle would paint one frame of stale colors.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (edition === 'broadcast') delete root.dataset.theme;
    else root.dataset.theme = 'print'; // print tokens serve print AND paper
    if (edition === 'paper') root.dataset.edition = 'paper';
    else delete root.dataset.edition;
    try { localStorage.setItem(THEME_KEY, edition); } catch { /* private mode */ }
  }, [edition]);

  const cycleEdition = () =>
    setEdition(e => EDITIONS[(EDITIONS.indexOf(e) + 1) % EDITIONS.length]);

  return (
    <ThemeContext.Provider value={{ edition, cycleEdition, theme: edition, toggleTheme: cycleEdition }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
