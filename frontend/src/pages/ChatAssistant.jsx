import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send, Volume2, VolumeX } from "lucide-react";
import { useApp } from "../context/app-context";
import { api } from "../utils/api";

const SUGGESTED = [
  "Explain the latest simulation result and its limitations.",
  "Which courses show the largest paired impact in Bottleneck Analysis?",
  "What uncertainty does the Monte Carlo result show?",
  "Which capacity signals appear in the latest Enrollment Forecast?",
  "How does the cohort model define on-time graduation?",
  "Compare the baseline CS and CE simulation outputs.",
];

const SHORTCUTS = [
  "Explain the latest result",
  "Explain a bottleneck metric",
  "Summarize forecast capacity signals",
  "Compare CS vs CE outputs",
];

export default function ChatAssistant() {
  const { effectiveProgram, lastSimulation } = useApp();
  const contextProgram = lastSimulation?.program || effectiveProgram;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback((text) => {
    const content = (text ?? input).trim();
    if (!content) return;
    const newMessages = [...messages, { role: "user", content, ts: Date.now() }];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    api.sendChatMessage({
      message: content,
      conversation_history: newMessages.map((m) => ({ role: m.role, content: m.content })),
      simulation_context: {
        program: contextProgram,
        last_simulation: lastSimulation,
      },
    }).then((res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.response, ts: Date.now(), tools: res.tool_calls_made }]);
      if (voiceOut && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(res.response);
        window.speechSynthesis.speak(utter);
      }
    }).catch(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong reaching the assistant. Please try again.", ts: Date.now() }]);
    }).finally(() => setSending(false));
  }, [input, messages, contextProgram, lastSimulation, voiceOut]);

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => setInput(e.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  return (
    <div className="flex gap-5" style={{ height: "calc(100vh - 130px)" }}>
      <div className="flex-1 flex flex-col qu-card p-0 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto mt-8">
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => send(q)} className="qu-card p-3 text-left text-xs text-qu-text hover:border-qu-maroon border border-qu-border transition-colors">
                  {q}
                </button>
              ))}
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-white border border-qu-border flex items-center justify-center p-1 mr-2 shrink-0">
                    <img src="/qu-favicon.png" alt="QU" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                  m.role === "user" ? "bg-qu-maroon text-white" : "qu-card border border-qu-border"
                }`}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 text-qu-text-muted text-xs">
              <div className="w-7 h-7 rounded-full bg-white border border-qu-border flex items-center justify-center p-1">
                <img src="/qu-favicon.png" alt="QU" className="w-full h-full object-contain" />
              </div>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-qu-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-qu-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-qu-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-qu-border p-3 flex items-end gap-2">
          <button onClick={toggleListening} className={`p-2 rounded-md ${listening ? "bg-qu-danger text-white animate-pulse" : "border border-qu-border text-qu-text-muted"}`}>
            <Mic size={16} />
          </button>
          <button onClick={() => setVoiceOut((v) => !v)} className={`p-2 rounded-md ${voiceOut ? "bg-qu-beige text-qu-maroon-dark" : "border border-qu-border text-qu-text-muted"}`}>
            {voiceOut ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={listening ? "Listening..." : "Ask about your simulation results..."}
            rows={1}
            className="flex-1 text-sm border border-qu-border rounded-md px-3 py-2 resize-none"
          />
          <button onClick={() => send()} disabled={sending} className="bg-qu-maroon text-white p-2 rounded-md hover:bg-qu-maroon-mid disabled:opacity-60">
            <Send size={16} />
          </button>
        </div>
      </div>

      <div className="w-80 shrink-0 qu-card p-4 overflow-y-auto">
        <h3 className="text-sm font-bold mb-3">Current Simulation State</h3>
        <div className="text-xs space-y-1.5 mb-4">
          <div className="flex justify-between"><span className="text-qu-text-muted">Program</span><span className="font-semibold uppercase">{contextProgram}</span></div>
          {lastSimulation ? (
            <>
              <div className="flex justify-between"><span className="text-qu-text-muted">Last run</span><span className="font-semibold">{lastSimulation.type}</span></div>
              {lastSimulation.summary?.avg_graduation_term != null && (
                <div className="flex justify-between"><span className="text-qu-text-muted">Avg graduation</span><span className="font-semibold">{lastSimulation.summary.avg_graduation_term} terms</span></div>
              )}
              {lastSimulation.summary?.on_time_pct != null && (
                <div className="flex justify-between"><span className="text-qu-text-muted">On-time rate</span><span className="font-semibold">{lastSimulation.summary.on_time_pct}%</span></div>
              )}
            </>
          ) : (
            <div className="text-qu-text-muted">No simulation run yet -- go run one to give the assistant context.</div>
          )}
        </div>

        <h4 className="text-xs font-semibold text-qu-text-muted mb-2">Ask about this</h4>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} className="w-full text-left text-xs border border-qu-border rounded-md px-2.5 py-1.5 hover:bg-qu-off-white">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
