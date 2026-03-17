"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { streamChat } from "@/lib/api";
import type { ChatMessage, ChatSession } from "@/lib/types";

const STORAGE_KEY = "roofing-chat-sessions";

const SUGGESTED_PROMPTS = [
  "Who are our top 5 hottest leads?",
  "Compare the top two Master Elite contractors",
  "Which leads show the strongest buying signals?",
  "Give me a portfolio overview",
];

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content;
  return text.length > 40 ? text.slice(0, 40) + "..." : text;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
  }, []);

  // Persist sessions whenever they change
  const persistSessions = useCallback(
    (updated: ChatSession[]) => {
      setSessions(updated);
      saveSessions(updated);
    },
    [],
  );

  // Save current messages into the active session
  const saveCurrentChat = useCallback(
    (msgs: ChatMessage[]) => {
      if (!activeSessionId) return;
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: msgs, title: deriveTitle(msgs), updatedAt: Date.now() }
            : s,
        );
        saveSessions(updated);
        return updated;
      });
    },
    [activeSessionId],
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeToolCall, scrollToBottom]);

  const startNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newSession, ...sessions];
    persistSessions(updated);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setInput("");
  }, [sessions, persistSessions]);

  const selectSession = useCallback(
    (id: string) => {
      if (isStreaming) return;
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setActiveSessionId(id);
        setMessages(session.messages);
      }
    },
    [sessions, isStreaming],
  );

  const deleteSession = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (isStreaming) return;
      const updated = sessions.filter((s) => s.id !== id);
      persistSessions(updated);
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    },
    [sessions, activeSessionId, isStreaming, persistSessions],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Auto-create session if none active
      let sessionId = activeSessionId;
      if (!sessionId) {
        const newSession: ChatSession = {
          id: generateId(),
          title: "New chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        sessionId = newSession.id;
        setActiveSessionId(sessionId);
        setSessions((prev) => {
          const updated = [newSession, ...prev];
          saveSessions(updated);
          return updated;
        });
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);
      setInput("");
      setIsStreaming(true);
      setActiveToolCall(null);

      // Save immediately with user message
      const currentSessionId = sessionId;
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...messages, userMsg], title: deriveTitle([...messages, userMsg]), updatedAt: Date.now() }
            : s,
        );
        saveSessions(updated);
        return updated;
      });

      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let finalMessages = newMessages;

      await streamChat(
        allMessages,
        (content) => {
          setActiveToolCall(null);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + content,
              };
            }
            finalMessages = updated;
            return updated;
          });
        },
        (label) => {
          setActiveToolCall(label);
        },
        () => {
          setIsStreaming(false);
          setActiveToolCall(null);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, isStreaming: false };
            }
            finalMessages = updated;
            return updated;
          });
          // Persist final state
          setSessions((prev) => {
            const cleanMessages = finalMessages.map(({ isStreaming: _, ...rest }) => rest);
            const updated = prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messages: cleanMessages, title: deriveTitle(cleanMessages), updatedAt: Date.now() }
                : s,
            );
            saveSessions(updated);
            return updated;
          });
        },
        (error) => {
          setIsStreaming(false);
          setActiveToolCall(null);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: `Sorry, something went wrong: ${error}`,
                isStreaming: false,
              };
            }
            finalMessages = updated;
            return updated;
          });
          // Persist error state too
          setSessions((prev) => {
            const cleanMessages = finalMessages.map(({ isStreaming: _, ...rest }) => rest);
            const updated = prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messages: cleanMessages, title: deriveTitle(cleanMessages), updatedAt: Date.now() }
                : s,
            );
            saveSessions(updated);
            return updated;
          });
        },
      );
    },
    [isStreaming, messages, activeSessionId],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0">
      {/* Sidebar — chat history */}
      <div className="w-64 flex-shrink-0 border-r bg-gray-50 flex flex-col">
        <div className="p-3 border-b">
          <Button
            onClick={startNewChat}
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 p-4 text-center">
              No previous chats
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => selectSession(session.id)}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                    activeSessionId === session.id
                      ? "bg-blue-100 text-blue-800"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                  <span className="truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <Card className="flex flex-col flex-1 overflow-hidden rounded-none border-0 border-l-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Sparkles className="h-8 w-8" />
                <h2 className="text-2xl font-semibold">AI Sales Assistant</h2>
              </div>
              <p className="text-gray-500 text-center max-w-md">
                Ask me anything about your contractor leads — search, compare,
                get insights, or review your portfolio.
              </p>
              <p className="text-xs text-gray-400">Powered by GPT-4o with real-time database access</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-gray-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                        <FormattedContent content={msg.content} />
                        {msg.isStreaming && !msg.content && !activeToolCall && (
                          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" />
                        )}
                        {msg.isStreaming && msg.content && (
                          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                </div>
              ))}

              {activeToolCall && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {activeToolCall}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t p-4 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your leads..."
              disabled={isStreaming}
              className="flex-1"
            />
            <Button type="submit" disabled={isStreaming || !input.trim()}>
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, i) => {
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} className="ml-2">
              <FormattedLine text={line} />
            </div>
          );
        }
        if (/^[-*]\s/.test(line)) {
          return (
            <div key={i} className="ml-2">
              <FormattedLine text={line} />
            </div>
          );
        }
        if (!line.trim()) {
          return <br key={i} />;
        }
        return (
          <span key={i}>
            <FormattedLine text={line} />
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

function FormattedLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
