import { useState, useCallback, useRef } from "react";

const SLOW_THRESHOLD_MS = 3000;

export function useLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const execute = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    setIsLoading(true);
    setIsSlow(false);
    timerRef.current = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsSlow(false);
      setIsLoading(false);
    }
  }, []);

  return { isLoading, isSlow, error, execute };
}
