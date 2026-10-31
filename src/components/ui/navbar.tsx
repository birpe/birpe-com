import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "framer-motion";
import "./navbar.css";

export type IMenu = {
  id: number;
  title: string;
  url: string;
  dropdown?: boolean;
  items?: IMenu[];
};

type MenuProps = { list: IMenu[] };

export default function NavBar({ list }: MenuProps) {
  const [active, setActive] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = () => {
    setActive(null);
    setExpanded(false);
  };

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setActive(null);
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  return (
    <MotionConfig transition={{ bounce: 0, type: "tween", duration: 0.2 }} reducedMotion="user">
      <LayoutGroup id={id}>
        <nav
          ref={root}
          className="site-navbar"
          aria-label="Main"
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) setActive(null);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) close();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            if (active !== null) {
              root.current?.querySelector<HTMLButtonElement>(`[data-trigger="${active}"]`)?.focus();
              setActive(null);
            } else {
              mobileToggle.current?.focus();
              close();
            }
          }}
        >
          <button
            ref={mobileToggle}
            className="navbar-toggle"
            type="button"
            aria-expanded={expanded}
            aria-controls={`${id}-links`}
            onClick={() => { setExpanded(!expanded); setActive(null); }}
          >
            <span>{expanded ? "Close" : "Menu"}</span>
            <span aria-hidden="true">{expanded ? "×" : "☰"}</span>
          </button>
          <ul id={`${id}-links`} className="navbar-list" data-expanded={expanded}>
            {list.map((item) => {
              const dropdown = item.dropdown && Boolean(item.items?.length);
              return (
                <li
                  key={item.id}
                  className="navbar-item"
                  onPointerEnter={(event) => { if (event.pointerType === "mouse") setActive(item.id); }}
                  onFocus={(event) => {
                    if (event.target instanceof HTMLAnchorElement) setActive(item.id);
                  }}
                >
                  {dropdown ? (
                    <button
                      className="navbar-link"
                      type="button"
                      data-active={active === item.id}
                      data-trigger={item.id}
                      aria-expanded={active === item.id}
                      aria-controls={`${id}-${item.id}`}
                      onClick={() => setActive(active === item.id ? null : item.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowDown") return;
                        event.preventDefault();
                        setActive(item.id);
                        requestAnimationFrame(() => document.getElementById(`${id}-${item.id}`)?.querySelector("a")?.focus());
                      }}
                    >
                      {item.title}<span className="navbar-chevron" aria-hidden="true">⌄</span>
                    </button>
                  ) : (
                    <a className="navbar-link" data-active={active === item.id} href={item.url} onClick={close}>{item.title}</a>
                  )}
                  {active === item.id && !dropdown && (
                    <motion.div layout layoutId="cursor" className="navbar-cursor" aria-hidden="true" />
                  )}
                  <AnimatePresence>
                    {dropdown && active === item.id && (
                      <motion.div
                        key="dropdown"
                        className="navbar-dropdown"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                      >
                        <motion.div layout layoutId="cursor" id={`${id}-${item.id}`} className="navbar-panel">
                          {item.items?.map((link) => (
                            <a key={link.id} href={link.url} onClick={close}>{link.title}</a>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </nav>
      </LayoutGroup>
    </MotionConfig>
  );
}
