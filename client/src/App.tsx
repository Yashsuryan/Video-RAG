import { useEffect, useRef, useState } from "react";
import type { SubmitEvent, KeyboardEvent } from "react";

type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  error?: boolean;
}

const API_URL = (
  (import.meta.env.VITE_API_URL as string) ||
  "https://video-rag-cn3e.onrender.com"
).replace(/\/+$/, "");

const DEFAULT_VIDEO_ID = "lfkjm2YRG-Q";
const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

/**
 * Accepts a bare YouTube video ID or a full URL (watch, youtu.be, shorts,
 * embed, live) and returns the 11-character ID, or null if it's not valid.
 */
function extractVideoId(value: string): string | null {
  const text = value.trim();
  if (VIDEO_ID_PATTERN.test(text)) return text;

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (host.endsWith("youtube.com")) {
      id = url.searchParams.get("v");
      if (!id) {
        const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/);
        id = match?.[1] ?? null;
      }
    }

    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

function SparkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
      <path
        d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10.5 9.5v5l4-2.5-4-2.5z" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 19V5M12 5l-6 6M12 5l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="spinner"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // videoId is the committed value sent to the API;
  // videoInput is whatever is currently typed in the field.
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO_ID);
  const [videoInput, setVideoInput] = useState(DEFAULT_VIDEO_ID);
  const videoInvalid =
    videoInput.trim() !== "" && extractVideoId(videoInput) === null;

  // One thread per video (a new video starts a fresh conversation)
  const threadId = useRef<string>(crypto.randomUUID());
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the latest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const commitVideo = () => {
    const id = extractVideoId(videoInput);
    if (!id) return; // invalid: keep the old video, field shows the error

    setVideoInput(id); // normalise a pasted URL down to the bare ID
    if (id !== videoId) {
      setVideoId(id);
      threadId.current = crypto.randomUUID();
      setMessages([]);
    }
  };

  const handleVideoKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitVideo();
      e.currentTarget.blur();
    }
  };

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: Message = {
      id: nextId.current++,
      role: "user",
      content: prompt,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMsg.content,
          thread_id: threadId.current,
          video_id: videoId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      // Works with both `res.json("text")` and `res.json({ content })`
      const data = await res.json();
      const content =
        typeof data === "string" ? data : (data?.content ?? "");

      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "assistant", content },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          content: `Sorry, I couldn't get a response. ${message}`,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">
            <SparkIcon />
          </span>
          <h1>AI Chat</h1>

          <label
            className={`video-field${videoInvalid ? " invalid" : ""}`}
            title="YouTube video ID or URL. Press Enter to apply."
          >
            <VideoIcon />
            <input
              type="text"
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              onBlur={commitVideo}
              onKeyDown={handleVideoKeyDown}
              placeholder="Video ID or URL"
              spellCheck={false}
              autoComplete="off"
              disabled={loading}
              aria-label="YouTube video ID or URL"
              aria-invalid={videoInvalid}
            />
          </label>
        </div>
      </header>

      <main className="messages">
        <div className="messages-inner">
          {messages.length === 0 && !loading && (
            <div className="empty">
              <span className="logo logo-lg">
                <SparkIcon />
              </span>
              <h2>How can I help you today?</h2>
              <p>Ask a question about the selected video below.</p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`message ${m.role}${m.error ? " error" : ""}`}
            >
              {m.role === "assistant" && (
                <span className="avatar">
                  <SparkIcon />
                </span>
              )}
              <div className="bubble">{m.content}</div>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <span className="avatar">
                <SparkIcon />
              </span>
              <div className="bubble typing" aria-label="Assistant is typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="composer">
        <form className="composer-inner" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            disabled={loading}
            aria-label="Message"
          />
          <button
            type="submit"
            className="send"
            disabled={loading || !input.trim()}
            aria-label={loading ? "Sending" : "Send message"}
          >
            {loading ? <Spinner /> : <SendIcon />}
          </button>
        </form>
        <p className="hint">Enter to send · Shift + Enter for a new line</p>
      </footer>
    </div>
  );
}