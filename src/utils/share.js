// One-thumb text sharing: the native share sheet where it exists (all mobile
// browsers), clipboard on desktop. Returns 'shared' | 'copied' | 'failed' so
// buttons can label the outcome truthfully.
//
// iOS rule: navigator.share must be called synchronously inside the user
// gesture — never pre-compose text in an await before calling this.
export async function shareText(text) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      // User closed the sheet — that's a completed interaction, not a failure.
      if (err && err.name === 'AbortError') return 'shared';
      // Anything else (rare NotAllowedError etc.) falls through to clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
