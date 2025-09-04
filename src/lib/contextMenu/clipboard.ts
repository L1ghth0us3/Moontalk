export async function copyText(text: string){
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-1000px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { /* ignore */ }
  }
}

