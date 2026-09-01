"use client";

import { useEffect, useState } from "react";
import { GENERIC_MESSAGES, shuffleMessages } from "@/lib/motivation";

const QUEUE_KEY = "apexload.bruceLeeQuoteQueue.v1";
const LAST_KEY = "apexload.bruceLeeLastQuote.v1";

function readQueue(): string[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function nextSessionQuote(): string {
  let queue = readQueue().filter((quote) => GENERIC_MESSAGES.includes(quote));
  const lastQuote = window.sessionStorage.getItem(LAST_KEY);

  if (queue.length === 0) {
    queue = shuffleMessages();
  }

  if (queue.length > 1 && queue[0] === lastQuote) {
    [queue[0], queue[1]] = [queue[1], queue[0]];
  }

  const quote = queue.shift() ?? shuffleMessages()[0];
  window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.sessionStorage.setItem(LAST_KEY, quote);
  return quote;
}

export default function BruceLeeQuote({ className = "" }: { className?: string }) {
  const [quote, setQuote] = useState("");

  useEffect(() => {
    setQuote(nextSessionQuote());
  }, []);

  if (!quote) return null;

  return (
    <aside className={`rounded-lg border border-steel-700/80 bg-steel-900/60 px-4 py-3 ${className}`}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-copper-400">Bruce Lee</p>
      <p className="mt-1 text-sm leading-relaxed text-chalk-300">{quote.replace(" — Bruce Lee", "")}</p>
    </aside>
  );
}
