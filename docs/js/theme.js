// Appearance (design/06 V1): runs before first paint as a classic same-origin script (the CSP forbids inline scripts).
// html[data-theme] = the choice (light | auto | dark, stored as prefs.appearance; default light).
// html[data-appearance] = the resolved appearance (light | dark); tokens.css reads only this. No attribute means light.
(() => {
  const DEFAULT = 'light';
  const THEME_COLOR = { light: '#F3F1EC', dark: '#111113' }; // equals --theme-color in tokens.css
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = DEFAULT;
  function resolve() {
    const root = document.documentElement;
    const mode = choice === 'auto' ? (mq.matches ? 'dark' : 'light') : choice;
    root.dataset.theme = choice;
    root.dataset.appearance = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLOR[mode];
  }
  function apply(next) {
    choice = next === 'dark' || next === 'auto' ? next : 'light';
    resolve();
    return choice;
  }
  mq.addEventListener('change', () => { if (choice === 'auto') resolve(); });
  let saved = DEFAULT;
  try { saved = JSON.parse(localStorage.getItem('osaka.prefs') || '{}').appearance || DEFAULT; } catch { /* private mode */ }
  apply(saved);
  window.osakaTheme = { apply, DEFAULT, get choice() { return choice; } };
})();
