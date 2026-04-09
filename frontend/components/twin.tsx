'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const AVATAR_SRC = '/me.jpeg';

function isErrorReply(content: string) {
    return content.startsWith('Sorry, I encountered');
}

export default function Twin() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    session_id: sessionId || undefined,
                }),
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();

            if (!sessionId) {
                setSessionId(data.session_id);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const [hasAvatar, setHasAvatar] = useState(false);
    useEffect(() => {
        fetch(AVATAR_SRC, { method: 'HEAD' })
            .then((res) => setHasAvatar(res.ok))
            .catch(() => setHasAvatar(false));
    }, []);

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl shadow-zinc-900/10 ring-1 ring-zinc-200/80">
            <header className="relative shrink-0 border-b border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-5 py-4 text-white">
                <div
                    className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500"
                    aria-hidden
                />
                <div className="flex items-start justify-between gap-4 pt-0.5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15">
                            {hasAvatar ? (
                                <img
                                    src={AVATAR_SRC}
                                    alt="Ed Folmi"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <Bot className="h-5 w-5 text-emerald-300" strokeWidth={1.75} />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                                Career digital twin
                            </h2>
                            <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
                                Ask about experience, skills & how I work
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-400/25">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        Online
                    </div>
                </div>
            </header>

            <div className="twin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto bg-zinc-50/95 p-4 sm:p-5">
                {messages.length === 0 && (
                    <div className="mx-auto mt-4 w-full max-w-sm rounded-2xl bg-white/80 px-6 py-10 text-center ring-1 ring-zinc-200/70 sm:mt-8">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200/80 ring-1 ring-zinc-200/80">
                            {hasAvatar ? (
                                <img
                                    src={AVATAR_SRC}
                                    alt="Ed Folmi"
                                    className="h-full w-full rounded-2xl object-cover"
                                />
                            ) : (
                                <Bot className="h-9 w-9 text-zinc-500" strokeWidth={1.5} />
                            )}
                        </div>
                        <p className="text-sm font-medium text-zinc-800">Hi, I&apos;m Ed&apos;s career twin.</p>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                            Ask about roles, strengths, projects, or what I&apos;m looking for next. I&apos;ll answer
                            in his voice.
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((message) => {
                        const err = message.role === 'assistant' && isErrorReply(message.content);
                        return (
                            <div
                                key={message.id}
                                className={`animate-twin-message-in flex gap-3 ${
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="mt-0.5 shrink-0">
                                        {hasAvatar ? (
                                            <img
                                                src={AVATAR_SRC}
                                                alt="Ed Folmi"
                                                className="h-9 w-9 rounded-xl object-cover ring-1 ring-zinc-200/90"
                                            />
                                        ) : (
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-zinc-700/80">
                                                <Bot className="h-4.5 w-4.5 text-emerald-300" strokeWidth={2} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div
                                    className={`max-w-[min(85%,28rem)] rounded-2xl px-4 py-3 ${
                                        message.role === 'user'
                                            ? 'rounded-br-md bg-zinc-900 text-zinc-50 shadow-md shadow-zinc-900/20'
                                            : err
                                              ? 'rounded-bl-md border border-rose-200/90 bg-rose-50/90 text-rose-950 ring-1 ring-rose-100'
                                              : 'rounded-bl-md border border-zinc-200/90 bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-100'
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
                                    <p
                                        className={`mt-2 text-[11px] font-medium tabular-nums tracking-wide ${
                                            message.role === 'user'
                                                ? 'text-zinc-400'
                                                : err
                                                  ? 'text-rose-600/80'
                                                  : 'text-zinc-400'
                                        }`}
                                    >
                                        {message.timestamp.toLocaleTimeString(undefined, {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>

                                {message.role === 'user' && (
                                    <div className="mt-0.5 shrink-0">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-300 ring-1 ring-zinc-400/30">
                                            <User className="h-4 w-4 text-zinc-700" strokeWidth={2} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isLoading && (
                    <div className="animate-twin-message-in mt-4 flex gap-3 justify-start">
                        <div className="mt-0.5 shrink-0">
                            {hasAvatar ? (
                                <img
                                    src={AVATAR_SRC}
                                    alt="Ed Folmi"
                                    className="h-9 w-9 rounded-xl object-cover ring-1 ring-zinc-200/90"
                                />
                            ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-zinc-700/80">
                                    <Bot className="h-4.5 w-4.5 text-emerald-300" strokeWidth={2} />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-zinc-200/90 bg-white px-4 py-3.5 shadow-sm ring-1 ring-zinc-100">
                            <span className="h-2 w-2 rounded-full bg-zinc-400 animate-twin-dot" />
                            <span className="h-2 w-2 rounded-full bg-zinc-400 animate-twin-dot twin-dot-delay-1" />
                            <span className="h-2 w-2 rounded-full bg-zinc-400 animate-twin-dot twin-dot-delay-2" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} className="h-px shrink-0" />
            </div>

            <div className="shrink-0 border-t border-zinc-200/90 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-5">
                <div className="flex items-center gap-2 sm:gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask about experience, skills, or goals…"
                        className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-shadow focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-60"
                        disabled={isLoading}
                        autoFocus
                        aria-label="Message input"
                    />
                    <button
                        type="button"
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-md shadow-zinc-900/25 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Send message"
                    >
                        <Send className="h-4.5 w-4.5" strokeWidth={2} />
                    </button>
                </div>
            </div>
        </div>
    );
}
