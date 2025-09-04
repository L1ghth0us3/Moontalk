export async function copyText(text: string){
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-1000px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { void 0; }
  }
  try { window.dispatchEvent(new CustomEvent('huntspeak-toast', { detail: { message: 'Saved to clipboard successfully' } })); } catch { void 0; }
}
