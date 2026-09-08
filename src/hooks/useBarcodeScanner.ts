import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan?: (barcode: string) => void;
  minLength?: number;
  maxDelay?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minLength = 3,
  maxDelay = 100,
  enabled = true,
}: UseBarcodeScannerOptions = {}) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const callbackRef = useRef(onScan);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      if (e.key === 'Enter' && bufferRef.current.length >= minLength) {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= minLength && callbackRef.current) {
          callbackRef.current(barcode);
        }
        bufferRef.current = '';
      }
      return;
    }

    const now = Date.now();

    if (now - lastKeyTimeRef.current > maxDelay) {
      bufferRef.current = '';
    }

    lastKeyTimeRef.current = now;

    if (e.key === 'Enter') {
      if (bufferRef.current.length >= minLength) {
        const barcode = bufferRef.current.trim();
        if (callbackRef.current) {
          callbackRef.current(barcode);
        }
      }
      bufferRef.current = '';
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      bufferRef.current += e.key;
    }
  }, [enabled, minLength, maxDelay]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  return { clearBuffer };
}
