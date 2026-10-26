import { useEffect, useRef } from "react";

export default function AnimatedBird({ variant, className = "" }: { variant: 1 | 2; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const safari = typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  useEffect(() => {
    const node = video.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !document.hidden && !reduced.matches) {
        void node.play().catch(() => node.parentElement?.removeAttribute("data-playing"));
      } else {
        node.pause();
        node.parentElement?.removeAttribute("data-playing");
        if (!visible && node.readyState >= 1) node.currentTime = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    return () => { observer.disconnect(); node.pause(); document.removeEventListener("visibilitychange", update); reduced.removeEventListener("change", update); };
  }, []);
  const name = variant === 1 ? "bird-primary" : "bird-launch";
  return <span className={`animated-bird ${className}`} aria-hidden="true">
    <img src="/assets/images/bird-logo.png" alt="" />
    <video ref={video} src={`/assets/videos/${name}${safari ? "-safari.mov" : ".webm"}`} muted loop playsInline preload="metadata"
      onPlaying={event => event.currentTarget.parentElement?.setAttribute("data-playing", "true")}
      onError={event => event.currentTarget.parentElement?.removeAttribute("data-playing")} />
  </span>;
}
