// Apply the saved theme before first paint to avoid a flash (see src/hooks/useTheme.ts).
// Kept as a separate file (not inline in index.html) so the Content Security Policy can block inline scripts.
try {
  var t = localStorage.getItem("cloudopshub_theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
