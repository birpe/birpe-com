import { useState, type FormEvent } from "react";

type Status = "idle" | "sending" | "done" | "error" | "busy" | "invalid";

const MESSAGES: Partial<Record<Status, string>> = {
  error: "That didn't go through. Please try again.",
  busy: "That's a lot of tries. Please wait a minute and try again.",
  invalid: "That email doesn't look right. Please check it.",
};

/** The hero's sign-up form. `inputId` is what the page's other waitlist links focus. */
export default function WaitlistForm({ inputId }: { inputId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const message = MESSAGES[status];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus("sending");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), website: data.get("website") }),
      });
      setStatus(response.ok ? "done" : response.status === 429 ? "busy" : response.status === 400 ? "invalid" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return <p data-waitlist-done role="status">You're on the list. We'll email you when Birpe opens.</p>;
  }

  return (
    <form data-waitlist onSubmit={submit}>
      <div data-waitlist-row>
        <label className="sr-only" htmlFor={inputId}>Email address</label>
        <input id={inputId} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} placeholder="you@example.com" aria-describedby={`${inputId}-note`} />
        {/* Left empty by people, who never see it; bots fill it in. */}
        <input data-waitlist-trap name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Joining…" : "Join the waitlist"}</button>
      </div>
      <p id={`${inputId}-note`} data-waitlist-note role={message ? "alert" : undefined} data-error={message ? "" : undefined}>
        {message ?? "We'll only use your email to tell you when Birpe opens."}
      </p>
    </form>
  );
}
