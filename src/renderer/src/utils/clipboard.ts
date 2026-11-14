/**
 * Robust clipboard helpers for Electron desktop app and web dev
 * 1. Native Electron IPC clipboard (always works in Electron when main process is restarted)
 * 2. navigator.clipboard.readText()
 * 3. document.execCommand('paste') fallback
 */

export async function readClipboardText(): Promise<string> {
  // 1. Try native Electron IPC clipboard
  if (typeof window !== 'undefined' && window.api && typeof window.api.readClipboard === 'function') {
    try {
      const text = await window.api.readClipboard();
      if (typeof text === 'string' && text.trim().length > 0) {
        return text.trim();
      }
    } catch (e) {
      console.warn('[Clipboard] Native readClipboard failed:', e);
    }
  }

  // 2. Try browser navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      const text = await navigator.clipboard.readText();
      if (typeof text === 'string' && text.trim().length > 0) {
        return text.trim();
      }
    } catch (e) {
      console.warn('[Clipboard] navigator.clipboard.readText failed:', e);
    }
  }

  // 3. Fallback: off-screen textarea with document.execCommand('paste')
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('textarea');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      const ok = document.execCommand('paste');
      const text = el.value;
      document.body.removeChild(el);
      if (ok && text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (e) {
      console.warn('[Clipboard] execCommand fallback failed:', e);
    }
  }

  return '';
}

export async function writeClipboardText(text: string): Promise<boolean> {
  // 1. Try native Electron IPC clipboard
  if (typeof window !== 'undefined' && window.api && typeof window.api.writeClipboard === 'function') {
    try {
      const success = await window.api.writeClipboard(text);
      if (success) return true;
    } catch (e) {
      console.warn('[Clipboard] Native writeClipboard failed:', e);
    }
  }

  // 2. Try browser navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed:', e);
    }
  }

  // 3. Fallback: off-screen textarea with document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch (e) {
      console.warn('[Clipboard] execCommand copy failed:', e);
    }
  }

  return false;
}
