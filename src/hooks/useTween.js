/* Smoothly animates a number from its previous value to the new one */
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useTween(target, ms = 700) {
  /* first value counts up from zero, later changes glide from the previous value */
  const [value, setValue] = useState(() => (Number.isFinite(target) && !reduced() ? 0 : target));
  const cur = useRef(Number.isFinite(target) && !reduced() ? 0 : target);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = cur.current;
    const start0 = from == null || !Number.isFinite(from);
    if (target == null || !Number.isFinite(target) || reduced()) {
      cur.current = target;
      setValue(target);
      return;
    }
    const origin = start0 ? 0 : from;
    const dur = start0 ? Math.max(ms, 1100) : ms;
    const start = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = origin + (target - origin) * e;
      cur.current = v;
      setValue(v);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);

  return value;
}
