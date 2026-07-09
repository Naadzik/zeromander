import { createContext, useContext, useLayoutEffect, useState } from 'react';

// Visual edition: 'broadcast' (default, dark election-night TV) or 'print'
// (light newsprint broadsheet). The ONLY switch is `data-theme="print"` on
// <html> — design tokens re-resolve, and the canvases re-read them because
// each canvas component includes `theme` in its redraw-effect deps.
// Keep the key + values in sync with the no-flash boot script in index.html.
const THEME_KEY = 'zeromander.ui.theme';

const ThemeContext = createContext({ theme: 'broadcast', toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'print' ? 'print' : 'broadcast'; }
    catch { return 'broadcast'; }
  });

  // useLayoutEffect, NOT useEffect: React flushes ALL layout effects (whole
  // tree) before ANY passive effect. The canvases redraw in passive effects
  // that call getComputedStyle() — the attribute must already be on <html>
  // when they run, or a toggle would paint one frame of stale colors.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === 'print') root.dataset.theme = 'print';
    else delete root.dataset.theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'print' ? 'broadcast' : 'print'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
