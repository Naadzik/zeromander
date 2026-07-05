import { useState, useEffect, useCallback } from 'react';

// `enabled: false` hard-disables undo/redo INCLUDING the global Ctrl+Z/Y
// shortcuts — guarding only the toolbar buttons is not enough (a locked
// daily board must not be mutable from the keyboard).
export function useUndoRedo(current, setCurrent, enabled = true) {
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  function snapshot() {
    setHistory(h => [...h.slice(-49), current]);
    setFuture([]);
  }

  const undo = useCallback(() => {
    if (!enabled || history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [...f, current]);
    setHistory(h => h.slice(0, -1));
    setCurrent(prev);
  }, [enabled, history, current, setCurrent]);

  const redo = useCallback(() => {
    if (!enabled || future.length === 0) return;
    const next = future[future.length - 1];
    setHistory(h => [...h, current]);
    setFuture(f => f.slice(0, -1));
    setCurrent(next);
  }, [enabled, future, current, setCurrent]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  function reset() {
    setHistory([]);
    setFuture([]);
  }

  return { snapshot, undo, redo, reset, canUndo: history.length > 0, canRedo: future.length > 0 };
}
