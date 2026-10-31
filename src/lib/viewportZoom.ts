/** Keyboard zoom for the reference's viewport-based root font size. */
export function installViewportZoom() {
  const root = document.documentElement;
  let zoom = Number.parseFloat(getComputedStyle(root).getPropertyValue('--user-zoom')) || 1;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    const increase = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
    const decrease = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
    const reset = event.key === '0' || event.code === 'Numpad0';
    if (!increase && !decrease && !reset) return;
    event.preventDefault();
    zoom = reset ? 1 : Math.min(5, Math.max(.5, Math.round((zoom + (increase ? .1 : -.1)) * 10) / 10));
    root.style.setProperty('--user-zoom', String(zoom));
    root.toggleAttribute('data-large-zoom', zoom >= 2);
    // Refresh geometry consumers even if the CSS viewport itself hasn't resized.
    window.dispatchEvent(new Event('resize'));
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
