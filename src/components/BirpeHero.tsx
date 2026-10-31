import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useHeroIntro } from '@/lib/useHeroIntro';
import '@/styles/hero.css';
import TetrisSkyline from './TetrisSkyline';
import RollText from './ui/RollText';

const examples = [
  { id: 'refund', name: 'Chase a refund', chip: 'Refunds', prompt: 'Help me follow up on a refund.', result: 'Start with the order number, the return date, and the store’s refund policy. Then send a short follow-up asking for the refund status and expected arrival date.' },
  { id: 'booking', name: 'Make a booking', chip: 'Bookings', prompt: 'Help me plan a dinner booking for two.', result: 'Pick a date, a time, and a neighborhood. Add your budget and any dietary preferences, then shortlist a few places before confirming a reservation.' },
  { id: 'bills', name: 'Sort the bills', chip: 'Bills', prompt: 'Help me get my monthly bills in order.', result: 'List each provider, due date, and expected amount in one place. Check for unused subscriptions and set reminders ahead of each payment date.' },
  { id: 'call', name: 'Prepare for a call', chip: 'Appointments', prompt: 'Help me prepare to reschedule an appointment.', result: 'Have your booking reference ready, choose two alternative times, and note any cancellation fees. Ask for written confirmation after the date changes.' },
];

const boundaries = ['You choose the goal', 'Your files stay local', 'No automatic actions'];
const menuGroups = [
  { title: 'Menu', links: [['Examples', '#examples'], ['How it works', '#how-it-works'], ['Four moves', '#steps'], ['FAQs', '#faqs']] },
  { title: 'Other', links: [['Try a task', '#try-a-task'], ['Back to top', '#top']] },
];
const THEME_KEY = 'birpe:theme';

function Words({ text, muted = false }: { text: string; muted?: boolean }) {
  return <>{text.split(' ').map((word, index) => (
    <span key={`${word}-${index}`}><span className="hero-word" data-hero-word data-muted={muted} aria-hidden="true">{word}</span>{' '}</span>
  ))}</>;
}

export default function BirpeHero() {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const menuToggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const header = useRef<HTMLElement>(null);
  const introDone = useHeroIntro(root);

  // The footer repeats the logo and links, so the fixed header steps aside before it reaches them.
  useEffect(() => {
    const footer = document.getElementById('footer');
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (header.current) header.current.dataset.away = String(entry.isIntersecting);
    }, { rootMargin: '0px 0px -88% 0px' });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      if (progress.current) progress.current.textContent = `${range > 0 ? Math.round(window.scrollY / range * 100) : 0}%`;
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuToggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !menuToggle.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      // Private browsing may disable storage; the theme still applies to this visit.
    }
  };

  const focusTask = () => input.current?.focus();
  const choose = (example: typeof examples[number]) => {
    setSelected(example.id);
    setPrompt(example.prompt);
    setResult(null);
    input.current?.focus();
  };
  const preview = (event: FormEvent) => {
    event.preventDefault();
    const example = examples.find((item) => item.id === selected);
    setResult(example?.result ?? 'A good first step: write down the outcome you want, gather the details you already have, and pick one small action to move it forward.');
  };

  const steps = [
    { title: 'Pick one loose end', code: '(PL)', tags: ['One task', 'A clear goal'], description: 'Choose a card above or write a short description of the errand you want to tackle.' },
    { title: 'Fill in the gaps', code: '(FG)', tags: ['Dates & references', 'Your constraints'], description: 'Include what changes the answer: when it happened, who’s involved, and what a good outcome looks like.' },
    { title: 'Review the suggestion', code: '(RS)', tags: ['Read it through', 'Compare your options'], description: 'Press the arrow to reveal a sample response, then check it against what you know.' },
    { title: 'Choose what happens next', code: '(YC)', tags: ['Your decision', 'No automatic actions'], description: 'Take the step yourself or leave it for later. Nothing happens until you act on it.' },
  ];
  const faqs = [
    ['What is Birpe being built to do?', 'Help with everyday tasks like refunds, bookings, bills and calls.'],
    ['Is Birpe available yet?', 'Not yet. The agent is still being built, so this page is a demo with sample answers.'],
    ['Are these live AI responses?', 'No. They’re fixed samples. This page doesn’t contact a model or any other service.'],
    ['What happens to an attachment?', 'Nothing. The demo shows the file’s name and never reads or uploads it.'],
    ['Is my task saved?', 'No. Refreshing clears the text and the file, and the page keeps no history.'],
    ['Who decides what happens next?', 'You do. The demo only suggests a first step, and nothing happens until you act on it.'],
  ];
  const brief = [
    ['Requested outcome', 'Refund status'],
    ['Order reference', 'BR–2048'],
    ['Return date', '24 October'],
    ['Preferred reply', 'Email'],
  ];
  const stepVisuals = [
    <div className="step-thumbs" key="pick">{examples.map((example) => <img key={example.id} src={`/assets/images/preloader/${example.id}.svg`} alt="" width="512" height="768" loading="lazy" />)}</div>,
    <dl className="step-brief" key="fill">{brief.map(([label, value]) => <div key={label}><dt className="u-title-s">{label}</dt><dd className="u-body-2">{value}</dd></div>)}</dl>,
    <div className="step-answer" key="review"><span className="u-title-s">One possible next step</span><p className="u-body-3">{examples[0].result}</p></div>,
    <div className="step-answer" key="choose"><span className="u-title-s">Your call</span><p className="u-body-3">{examples[0].result}</p><div className="context-choices u-title-s"><span>Write the follow-up</span><span>Not now</span></div></div>,
  ];

  return (
    <div ref={root} className="hero-shell" data-intro-state="waiting" data-hero-intro>
      <header ref={header} className="hero-header">
        <a className="hero-brand u-title-3" href="#top" aria-label="Birpe home" data-intro data-hero-logo>
          <img src="/assets/images/bird-logo.png" alt="" width="40" height="40" /><span>birpe</span>
        </a>
        <nav className="hero-nav u-btn" aria-label="Main navigation" data-intro data-hero-nav>
          <button ref={menuToggle} type="button" className="hero-menu-toggle" aria-expanded={menuOpen} aria-controls="site-menu" onClick={() => setMenuOpen((open) => !open)}>
            <span className="hero-menu-icon" data-open={menuOpen} aria-hidden="true"><i /><i /></span><span className="hero-menu-label">Menu</span>
          </button>
          <button type="button" className="hero-theme" aria-pressed={dark} aria-label="Dark theme" onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{dark
              ? <path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5 1 3h-2l1-3Zm0 20-1-3h2l-1 3ZM2 12l3-1v2l-3-1Zm20 0-3 1v-2l3 1ZM4.9 4.9l2.8 1.4-1.4 1.4-1.4-2.8Zm14.2 14.2-2.8-1.4 1.4-1.4 1.4 2.8Zm0-14.2-1.4 2.8-1.4-1.4 2.8-1.4ZM4.9 19.1l1.4-2.8 1.4 1.4-2.8 1.4Z" />
              : <path fill="currentColor" d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />}</svg>
          </button>
          <span className="hero-progress" ref={progress} aria-hidden="true">0%</span>
        </nav>
        <button className="btn-pill u-btn" onClick={focusTask} data-intro data-hero-button><RollText text="Try a task" /></button>
      </header>
      <div ref={menu} id="site-menu" className="site-menu" data-open={menuOpen}>
        {menuGroups.map((group) => <nav key={group.title} aria-label={group.title}>
          <p className="u-title-s">{group.title}</p>
          {group.links.map(([label, href]) => <a key={href} className="u-title-3" href={href} onClick={() => setMenuOpen(false)}><RollText text={label} /></a>)}
        </nav>)}
      </div>

      <section id="top" className="hero-opening" aria-labelledby="hero-title">
        <div className="hero-mark">
          <div className="hero-board">
            <TetrisSkyline ready={introDone} />
            <h1 id="hero-title" className="hero-tagline u-h1" data-intro data-hero-text aria-label="Your personal agent"><Words text="Your personal agent" muted /></h1>
          </div>
        </div>
        <div className="hero-meta-row">
          <span className="hero-meta u-small-1" data-intro data-hero-delayed>©2026</span>
          <a className="hero-meta hero-scroll u-small-1" href="#what-you-can-do" data-intro data-hero-delayed>Scroll down <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section id="what-you-can-do" className="section-intro section-grid" aria-labelledby="possibilities-title">
        <p className="section-tag u-tag" data-reveal>What you can do</p>
        <h2 id="possibilities-title" className="section-headline u-h2" data-reveal-words>Refunds, bookings, bills and calls.</h2>
      </section>

      <section id="examples" className="feature-cards" aria-label="Explore Birpe">
        <article className="feature-card feature-preview" data-reveal>
          <div className="feature-copy">
            <p className="feature-label u-title-s"><span aria-hidden="true" />Interactive preview</p>
            <div className="feature-text">
              <h3 className="u-h3">Start with what’s on your list.</h3>
              <p className="u-body-2 u-fg-64">Describe an errand and see a suggested first step.</p>
            </div>
          </div>
          <div id="try-a-task" className="app-frame">
            <div className="app-frame-bar u-title-s"><img src="/assets/images/bird-logo.png" alt="" width="24" height="24" /><span>New task</span><span className="app-frame-note">Demo only. Nothing is sent.</span></div>
            <form className="hero-composer" onSubmit={preview}>
              <label className="sr-only" htmlFor="hero-task">What would you like to get done?</label>
              <textarea className="u-body" ref={input} id="hero-task" value={prompt} onChange={(event) => { setPrompt(event.target.value); setSelected(null); setResult(null); }} placeholder="What would you like to get done?" rows={3} maxLength={1000} required />
              <div className="hero-composer-controls">
                <label className="hero-attachment u-title-s" title="Attach a file to this local preview">
                  <input type="file" aria-label="Attach a file to the preview" onChange={(event) => { setFileName(event.target.files?.[0]?.name ?? ''); focusTask(); }} />
                  <span aria-hidden="true">＋</span><span>{fileName || 'Attach a file'}</span>
                </label>
                <button type="submit" className="hero-send u-btn" aria-label="Preview a next step" disabled={!prompt.trim()}><span aria-hidden="true">↑</span></button>
              </div>
              {result && <div className="hero-result u-body-2" role="status"><span className="u-title-s u-fg-64">One possible next step</span><p>{result}</p><button type="button" className="u-btn" onClick={() => setResult(null)}>Close</button></div>}
            </form>
            <div className="app-frame-thumbs">
              {examples.map((example) => <button key={example.id} type="button" className="app-thumb" onClick={() => choose(example)} aria-label={`Try a task: ${example.name}`} aria-pressed={selected === example.id}>
                <img src={`/assets/images/thumbs/${example.id}.svg`} alt="" width="240" height="240" loading="lazy" />
                <span className="u-title-s" aria-hidden="true">{example.chip}</span>
              </button>)}
            </div>
          </div>
        </article>
        <article className="feature-card feature-context" data-reveal>
          <div className="feature-top">
            <p className="feature-label u-title-s"><span aria-hidden="true" />Useful context</p>
            <button type="button" className="feature-link" onClick={focusTask} aria-label="Open the preview"><span aria-hidden="true">↗</span></button>
          </div>
          <div className="feature-stage">
            <div className="context-document" aria-label="Illustrative task brief">
              <div className="context-document-heading"><span className="u-title">Task brief</span></div>
              <dl>
                {brief.map(([label, value]) => <div key={label}><dt className="u-title-s u-fg-64">{label}</dt><dd className="u-body-2">{value}</dd></div>)}
              </dl>
            </div>
          </div>
          <div className="feature-text">
            <h3 className="u-h3">Add the details once.</h3>
            <p className="u-body-2 u-fg-64">Dates, references and preferences make the suggestion specific.</p>
          </div>
        </article>
        <article className="feature-card feature-answer" data-reveal>
          <div className="feature-top">
            <p className="feature-label u-title-s"><span aria-hidden="true" />A clear next step</p>
            <button type="button" className="feature-link" onClick={focusTask} aria-label="Open the preview"><span aria-hidden="true">↗</span></button>
          </div>
          <div className="feature-stage">
            <div className="context-document">
              <div className="context-document-heading"><span className="u-title">One possible next step</span></div>
              <p className="context-answer u-body-2 u-fg-64">{examples[0].result}</p>
              <div className="context-choices u-title-s" aria-hidden="true"><span>Write the follow-up</span><span>Not now</span></div>
            </div>
          </div>
          <div className="feature-text">
            <h3 className="u-h3">You decide what happens next.</h3>
            <p className="u-body-2 u-fg-64">Birpe suggests a first step. Nothing happens until you act on it.</p>
          </div>
        </article>
      </section>

      <section id="how-it-works" className="how-section" aria-labelledby="how-title">
        <p id="how-title" className="how-tag u-tag">How it works</p>
        <div className="section-grid how-grid">
          <div className="how-left">
            <h2 className="u-h2" data-reveal-words>You’re in charge.</h2>
            <button className="btn-pill u-btn" onClick={focusTask} data-reveal><RollText text="Try a task" /></button>
          </div>
          <div className="how-actions">
            <div className="motion-column" style={{ '--motion-duration': '24s' } as CSSProperties}>
              {boundaries.map((title) => <h3 key={title} className="u-h2">{title}</h3>)}
              {boundaries.map((title) => <p key={title} className="u-h2" aria-hidden="true">{title}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section id="steps" className="steps-section" aria-labelledby="steps-title">
        <div className="steps-intro"><h2 id="steps-title" className="u-h1" data-reveal-words>From loose end to next step in four moves.</h2><p className="u-tag u-fg-64" data-reveal>A quick walkthrough of this demo.</p></div>
        {steps.map((step, index) => <article className="step" key={step.title} data-step>
          <div className="step-card" data-step-card>
            <div className="step-heading"><h3 className="u-h2-5" data-reveal-words>{step.title}</h3><span className="step-code u-title-3" aria-hidden="true">{step.code}</span><span className="step-number u-h2" data-reveal-words>0{index + 1}</span></div>
            <div className="step-info">
              <div className="step-tags">{step.tags.map((tag) => <span className="u-title-s" key={tag}><i aria-hidden="true" />{tag}</span>)}</div>
              <p className="u-title-3">{step.description}</p>
            </div>
            <button className="btn-pill btn-pill-light u-btn" onClick={focusTask}><RollText text="Try a task" /></button>
            <div className="step-visual" aria-hidden="true">{stepVisuals[index]}</div>
          </div>
        </article>)}
      </section>

      <section id="faqs" className="faq-section section-grid" aria-labelledby="faq-title">
        <p className="section-tag u-tag" data-reveal>FAQs</p>
        <div className="faq-main">
          <h2 id="faq-title" className="section-headline u-h2" data-reveal-words>Common questions</h2>
          <div className="faq-list">{faqs.map(([question, answer]) => <details key={question} className="faq-item"><summary className="u-body-3">{question}<span className="faq-toggle" aria-hidden="true" /></summary><p className="u-body-2 u-fg-64">{answer}</p></details>)}</div>
        </div>
      </section>
    </div>
  );
}
