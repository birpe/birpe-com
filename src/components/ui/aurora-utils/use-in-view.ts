import { useEffect, useState } from "react";

/**
 * Tracks whether an element is near the viewport. Returns a stable callback
 * ref to attach and the current visibility; without IntersectionObserver the
 * element counts as visible.
 */
export function useInView<T extends Element>({ root, rootMargin, threshold }: IntersectionObserverInit = {}) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    // Several changes can arrive at once; the last is the current one.
    const observer = new IntersectionObserver((entries) => setInView(entries[entries.length - 1].isIntersecting), { root, rootMargin, threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, root, rootMargin, threshold]);

  return [setNode as (node: T | null) => void, inView] as const;
}
