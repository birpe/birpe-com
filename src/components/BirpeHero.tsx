import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useHeroIntro } from '@/lib/useHeroIntro';
import '@/styles/hero.css';
import TetrisSkyline from './TetrisSkyline';
import RollText from './ui/RollText';
import WaitlistForm from './WaitlistForm';

const examples = [
  { id: 'refund', name: 'Chase a refund', chip: 'Refunds', prompt: 'Get my refund for the headphones I returned last week.', result: 'Birpe would find the order and the return date, write to the store, and keep following up until the money is back. You’d get a note when it lands.' },
  { id: 'booking', name: 'Make a booking', chip: 'Bookings', prompt: 'Book dinner for two on Friday at 7:30.', result: 'Birpe would shortlist places that fit your budget and tastes, check you’re happy with the pick, make the reservation, and send you the confirmation.' },
  { id: 'bills', name: 'Sort the bills', chip: 'Bills', prompt: 'Get this month’s bills in order.', result: 'Birpe would list every bill with its amount and due date, flag anything that looks wrong or unused, and make sure none of them slips past its date.' },
  { id: 'call', name: 'Make a call', chip: 'Calls', prompt: 'Call the clinic and move my appointment to next week.', result: 'Birpe would call the clinic, wait on hold, ask for a time that suits you, and send you the new date once it’s confirmed.' },
];

const jobs = ['Chase a late refund', 'Book a table for two', 'Sort the monthly bills', 'Move a dentist visit'];
const menuGroups = [
  { title: 'On this page', links: [['What Birpe does', '#what-birpe-does'], ['How it works', '#how-it-works'], ['FAQs', '#faqs']] },
  { title: 'Get started', links: [['Try a sample task', '#try-a-task'], ['Join the waitlist', '#waitlist'], ['Back to top', '#top']] },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const menuToggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const header = useRef<HTMLElement>(null);
  const { introDone, showTagline, hideTagline } = useHeroIntro(root);

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
    setResult(example?.result ?? 'Birpe would ask for anything it’s missing, work out the steps, check the plan with you, get it done, and tell you when it’s finished.');
  };

  const steps = [
    { title: 'Tell Birpe what you need', tags: ['Plain words', 'Big jobs or small'], description: 'Say it the way you’d say it to a friend: get my refund, book dinner, move my appointment.' },
    { title: 'Share the details', tags: ['Order numbers & dates', 'Your preferences'], description: 'Birpe asks only for what the job needs, like an order number, a date or a budget.' },
    { title: 'Check the plan', tags: ['See every step', 'Change anything'], description: 'Birpe shows you what it’s going to do and who it will contact. Say yes, or change it.' },
    { title: 'Consider it done', tags: ['Follow-ups included', 'Updates as it goes'], description: 'Birpe does the emailing, the waiting and the chasing, then tells you when it’s finished.' },
  ];
  const faqs = [
    ['What is Birpe?', 'A personal AI agent for everyday errands. You tell it what needs doing, and it handles the refunds, bookings, bills and calls that usually sit on your list.'],
    ['How is it different from a chatbot?', 'A chatbot tells you what to do. Birpe is being built to do the job itself, including the emails, the calls and the follow-ups, and to tell you when it’s finished.'],
    ['Can I use it today?', 'Not yet. Birpe is still being built. Join the waitlist and we’ll email you when it opens.'],
    ['Will Birpe act without my OK?', 'No. Birpe will check with you before it sends, books or pays for anything.'],
    ['Is the task box on this page real?', 'It’s a preview. The answers are pre-written samples, and nothing you type is sent or saved.'],
    ['What happens to my email?', 'We keep it for the waitlist and only use it to tell you when Birpe opens.'],
  ];
  const details = [
    ['Task', 'Refund for headphones'],
    ['Order number', 'BR-2048'],
    ['Returned on', '24 October'],
    ['Amount', '₹2,499'],
    ['Update me by', 'Email'],
  ];
  const progressLog = [
    ['Day 1', 'Asked the store for the refund'],
    ['Day 3', 'No reply, so Birpe followed up'],
    ['Day 5', 'Refund confirmed. You’re notified'],
  ];
  const outcome = [
    ['Refund received', '₹2,499'],
    ['Status', 'Back in your account'],
    ['Follow-ups sent', '2'],
    ['Left for you to do', 'Nothing'],
  ];
  const plan = ['Find the order and the return date', 'Write to the store and ask for the refund', 'Follow up until the money is back'];
  const stepVisuals = [
    <div className="step-thumbs" key="tell">{examples.map((example) => <img key={example.id} src={`/assets/images/preloader/${example.id}.svg`} alt="" width="512" height="768" loading="lazy" />)}</div>,
    <dl className="step-sheet step-brief" key="details">{details.map(([label, value]) => <div key={label}><dt className="u-title-3 u-fg-64">{label}</dt><dd className="u-title-3">{value}</dd></div>)}</dl>,
    <div className="step-sheet" key="plan"><p className="u-title-3 u-fg-64">Birpe’s plan</p>{plan.map((item, index) => <p className="step-sheet-row u-title-3" key={item}><span>{index + 1}</span>{item}</p>)}<div className="context-choices u-title-s"><span>Looks good</span><span>Change something</span></div></div>,
    <dl className="step-sheet step-brief" key="done">{outcome.map(([label, value]) => <div key={label}><dt className="u-title-3 u-fg-64">{label}</dt><dd className="u-title-3">{value}</dd></div>)}</dl>,
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
        <a className="btn-pill u-btn" href="#waitlist" data-intro data-hero-button><RollText text="Join the waitlist" /></a>
      </header>
      <div ref={menu} id="site-menu" className="site-menu" data-open={menuOpen}>
        {menuGroups.map((group) => <nav key={group.title} aria-label={group.title}>
          <p className="u-title-s">{group.title}</p>
          {group.links.map(([label, href]) => <a key={href} className="u-title-3" href={href} onClick={() => setMenuOpen(false)}><RollText text={label} /></a>)}
        </nav>)}
      </div>

      <section id="top" className="hero-opening" aria-labelledby="hero-title">
        <div className="hero-lead" data-intro data-hero-delayed>
          <p className="u-h2-5">Tell Birpe what needs doing. It chases the refund, makes the booking, sorts the bill and takes the call.</p>
          <a className="hero-scroll u-btn" href="#what-birpe-does">See what it does <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-board">
          <TetrisSkyline ready={introDone} onBuilt={showTagline} onClearing={hideTagline} />
          <h1 id="hero-title" className="hero-tagline u-h1" data-intro data-hero-text aria-label="Your personal agent"><Words text="Your personal agent" muted /></h1>
        </div>
      </section>

      <section id="what-birpe-does" className="section-intro" aria-labelledby="possibilities-title">
        <p className="section-tag u-tag" data-reveal>What Birpe does</p>
        <h2 id="possibilities-title" className="section-headline u-h2" data-reveal-words>One agent for the jobs you keep putting off.</h2>
      </section>

      <section id="examples" className="feature-cards" aria-label="What Birpe does">
        <article className="feature-card feature-preview" data-reveal>
          <div className="feature-copy">
            <p className="feature-label u-title-s"><span aria-hidden="true" />Try a sample task</p>
            <div className="feature-text">
              <h3 className="u-h3">Tell it what needs doing.</h3>
              <p className="u-body-2 u-fg-64">Pick an example or type your own to see how Birpe would handle it.</p>
            </div>
          </div>
          <div id="try-a-task" className="app-frame">
            <div className="app-frame-bar u-title-s"><img src="/assets/images/bird-logo.png" alt="" width="24" height="24" /><span>New task</span><span className="app-frame-note">Sample answers. Nothing is sent.</span></div>
            <form className="hero-composer" onSubmit={preview}>
              <label className="sr-only" htmlFor="hero-task">What do you need done?</label>
              <textarea className="u-body" ref={input} id="hero-task" value={prompt} onChange={(event) => { setPrompt(event.target.value); setSelected(null); setResult(null); }} placeholder="What do you need done?" rows={2} maxLength={1000} required />
              <div className="hero-composer-controls">
                <button type="submit" className="hero-send u-btn" aria-label="See how Birpe would handle it" disabled={!prompt.trim()}><span aria-hidden="true">↑</span></button>
              </div>
              {result && <div className="hero-result u-body-2" role="status"><span className="u-title-s u-fg-64">How Birpe would handle it</span><p>{result}</p><button type="button" className="u-btn" onClick={() => setResult(null)}>Close</button></div>}
            </form>
            <div className="app-frame-thumbs">
              {examples.map((example) => <button key={example.id} type="button" className="app-thumb" onClick={() => choose(example)} aria-label={`Try a sample task: ${example.name}`} aria-pressed={selected === example.id}>
                <img src={`/assets/images/thumbs/${example.id}.svg`} alt="" width="240" height="240" loading="lazy" />
                <span className="u-title-s" aria-hidden="true">{example.chip}</span>
              </button>)}
            </div>
          </div>
        </article>
        <article className="feature-card feature-context" data-reveal>
          <p className="feature-label u-title-s"><span aria-hidden="true" />It follows through</p>
          <div className="feature-stage">
            <div className="context-document" aria-label="Example: how a refund gets chased">
              <div className="context-document-heading"><span className="u-title">Refund for order BR-2048</span></div>
              <dl className="context-log">
                {progressLog.map(([label, value]) => <div key={label}><dt className="u-title-s u-fg-64">{label}</dt><dd className="u-body-2">{value}</dd></div>)}
              </dl>
            </div>
          </div>
          <div className="feature-text">
            <h3 className="u-h3">It doesn’t stop at advice.</h3>
            <p className="u-body-2 u-fg-64">Most assistants tell you what to do. Birpe does the emailing, the calling and the follow-ups until the job is finished.</p>
          </div>
        </article>
        <article className="feature-card feature-answer" data-reveal>
          <p className="feature-label u-title-s"><span aria-hidden="true" />You stay in charge</p>
          <div className="feature-stage">
            <div className="context-document">
              <div className="context-document-heading"><span className="u-title">Ready to send</span></div>
              <p className="context-answer u-body-2 u-fg-64">Hi, I returned order BR-2048 on 24 October and haven’t received my ₹2,499 refund. Please confirm when it will arrive.</p>
              <div className="context-choices u-title-s" aria-hidden="true"><span>Send it</span><span>Change something</span></div>
            </div>
          </div>
          <div className="feature-text">
            <h3 className="u-h3">You make the final call.</h3>
            <p className="u-body-2 u-fg-64">Birpe shows you what it plans to send and checks with you first. Approve it, change it or say not now.</p>
          </div>
        </article>
      </section>

      <section id="jobs" className="how-section" aria-labelledby="jobs-title">
        <div className="section-grid how-grid">
          <div className="how-left">
            <h2 id="jobs-title" className="u-h2-5" data-reveal-words>What you can hand over.</h2>
            <button className="btn-pill u-btn" onClick={focusTask} data-reveal><RollText text="Try a sample task" /></button>
          </div>
          <div className="how-actions">
            <div className="motion-column" style={{ '--motion-duration': '24s' } as CSSProperties}>
              {jobs.map((title) => <h3 key={title} className="u-h2">{title}</h3>)}
              {jobs.map((title) => <p key={title} className="u-h2" aria-hidden="true">{title}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="steps-section" aria-labelledby="steps-title">
        <div className="steps-intro"><h2 id="steps-title" className="u-h1" data-reveal-words>From your list to done in four steps.</h2><p className="u-tag u-fg-64" data-reveal>How Birpe will work when it opens.</p></div>
        {steps.map((step, index) => <article className="step" key={step.title} data-step>
          <div className="step-card" data-step-card>
            <div className="step-heading"><h3 className="u-h2-5" data-reveal-words>{step.title}</h3><span className="step-number u-h2" data-reveal-words>0{index + 1}</span></div>
            <div className="step-info">
              <div className="step-tags">{step.tags.map((tag) => <span className="u-title-s" key={tag}><i aria-hidden="true" />{tag}</span>)}</div>
              <p className="u-title-3">{step.description}</p>
            </div>
            <div className="step-visual" aria-hidden="true">{stepVisuals[index]}</div>
          </div>
        </article>)}
      </section>

      <section id="faqs" className="faq-section section-grid" aria-labelledby="faq-title">
        <div className="faq-intro">
          <p className="section-tag u-tag" data-reveal>FAQs</p>
          <h2 id="faq-title" className="section-headline u-h2-5" data-reveal-words>Questions, answered.</h2>
        </div>
        <div className="faq-list">{faqs.map(([question, answer], index) => <details key={question} className="faq-item" open={index === 0}><summary className="u-body-3">{question}<span className="faq-toggle" aria-hidden="true" /></summary><p className="u-body-2 u-fg-64">{answer}</p></details>)}</div>
      </section>

      <section id="waitlist" className="waitlist-section" aria-labelledby="waitlist-title">
        <div className="waitlist-copy">
          <p className="u-tag" data-reveal>Waitlist</p>
          <h2 id="waitlist-title" className="u-h2-5" data-reveal-words>Hand over your first errand.</h2>
          <p className="u-body-3" data-reveal>Birpe isn’t open yet. Join the waitlist and we’ll email you as soon as it is.</p>
        </div>
        <div className="waitlist-form" data-reveal><WaitlistForm inputId="waitlist-email" /></div>
      </section>
    </div>
  );
}
