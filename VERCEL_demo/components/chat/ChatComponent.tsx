'use client';

import { CleanIconButton } from '@neo4j-ndl/react/clean-icon-button';
import { Typography } from '@neo4j-ndl/react/typography';
import { Prompt, Response, Suggestion, Thinking, UserBubble } from '@neo4j-ndl/react/ai';
import { ArrowPathIconOutline, Square2StackIconOutline } from '@neo4j-ndl/react/icons';
import { useEveAgent } from 'eve/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AGENT_NAME, DEFAULT_SUGGESTIONS, MEMORY_MODES } from '@/constants';
import type { MemoryMode, MemorySnapshot, MemoryTab } from '@/types';
import {
  emptySnapshot,
  formatErrorMessage,
  getMsgText,
  isMemoryTool,
  lastUserText,
  toolParts,
} from '@/utils/message';
import MemoryPanel from './MemoryPanel';
import ReasoningPanel from './ReasoningPanel';

const OPENING = '@opening';

interface ChatComponentProps {
  mode: MemoryMode;

  sessionId?: string;
  suggestions?: readonly string[];
}

export default function ChatComponent({
  mode,
  sessionId,
  suggestions = DEFAULT_SUGGESTIONS,
}: ChatComponentProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);
  const wasBusyRef = useRef(false);

  const [input, setInput] = useState('');
  const [copyError, setCopyError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | undefined>();
  const [thinkingTimes, setThinkingTimes] = useState<Record<string, number>>({});
  const [memory, setMemory] = useState<Record<string, MemorySnapshot>>({});
  const [expandedMemory, setExpandedMemory] = useState<Record<string, boolean>>({});
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<string, MemoryTab>>({});

  const agent = useEveAgent({
    initialSession: sessionId === undefined ? undefined : { sessionId, streamIndex: 0 },
    resume: sessionId !== undefined,
    onSessionChange(session: { sessionId: string | number | boolean; } | undefined) {
      if (sessionId === undefined && session !== undefined) {

        History.prototype.replaceState.call(
          window.history,
          window.history.state,
          '',
          `/s/${encodeURIComponent(session.sessionId)}`,
        );
      }
    },
  });

  const messages = agent.data.messages;
  const isBusy = agent.status === 'submitted' || agent.status === 'streaming';
  const isResuming = agent.status === 'resuming';

  const loadMemory = useCallback(async (key: string, query: string) => {
    setMemory((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? emptySnapshot()), loading: true, error: undefined },
    }));
    try {
      const response = await fetch(`/api/memory?${new URLSearchParams({ q: query })}`);
      const payload: unknown = await response.json();
      if (!response.ok) {
        const detail = (payload as { error?: string } | null)?.error;
        throw new Error(detail ?? `Memory service returned ${response.status}.`);
      }
      setMemory((prev) => ({ ...prev, [key]: payload as MemorySnapshot }));
    } catch (error) {
      setMemory((prev) => ({
        ...prev,
        [key]: {
          ...emptySnapshot(),
          error: formatErrorMessage(error) ?? 'Could not reach the memory service.',
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (mode === 'off') return;
    void loadMemory(OPENING, '');
  }, [loadMemory, mode]);

  useEffect(() => {
    if (isBusy && !wasBusyRef.current) {
      wasBusyRef.current = true;
      startedAtRef.current = Date.now();
      return;
    }
    if (!isBusy && wasBusyRef.current) {
      wasBusyRef.current = false;
      const last = messages.at(-1);
      const startedAt = startedAtRef.current;
      startedAtRef.current = null;
      if (last?.role === 'assistant') {
        if (startedAt !== null) {
          setThinkingTimes((prev) => ({ ...prev, [last.id]: Date.now() - startedAt }));
        }
        if (mode !== 'off') void loadMemory(last.id, lastUserText(messages));
      }
    }
  }, [isBusy, messages, loadMemory, mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agent.status]);

  const handleSend = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isResuming) return;
    setInput('');
    setSendError(undefined);

    void agent.send(text, isBusy ? { turnPolicy: 'steer' } : undefined).catch((error: unknown) => {
      setSendError(formatErrorMessage(error) ?? 'The agent could not be reached.');
    });
  };

  const askAgain = (assistantIndex: number) => {
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        handleSend(getMsgText(messages[i]));
        return;
      }
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setCopyError('Copy failed.');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  const turnFailure = isBusy || isResuming ? undefined : latestTurnFailure(agent.events);
  const errorMessage = sendError ?? agent.error?.message ?? turnFailure;
  const opening = memory[OPENING];
  const knownAlready = opening
    ? Object.values(opening.counts).reduce((sum, n) => sum + n, 0)
    : 0;
  const showConversation = messages.length > 0 || isResuming || errorMessage !== undefined;

  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        width: '100%',
      }}
    >
      <div
        className="n-bg-neutral-bg-weak"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          width: '100%',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          <div style={{ margin: '0 auto', width: '100%', maxWidth: 860 }}>
            {copyError && (
              <div className="n-bg-warning-bg-weak n-border n-border-warning-border-weak n-rounded-lg n-p-2 n-mb-2">
                <Typography variant="body-small">{copyError}</Typography>
              </div>
            )}

            {!showConversation ? (
              <div className="n-flex n-flex-col n-gap-12" style={{ paddingTop: '8vh' }}>
                <div className="n-flex n-flex-col n-gap-2">
                  <Typography variant="display">Hi, how can I help you today?</Typography>
                  {knownAlready > 0 && (
                    <Typography
                      variant="body-medium"
                      style={{ color: 'var(--theme-color-neutral-text-weaker)' }}
                    >
                      {AGENT_NAME} — Neo4j is already holding {knownAlready}{' '}
                      {knownAlready === 1 ? 'memory' : 'memories'} from your earlier sessions.
                    </Typography>
                  )}
                </div>
                <div className="n-flex n-flex-col n-gap-4">
                  <Typography variant="body-medium">Suggestions</Typography>
                  {suggestions.map((suggestion, index) => (
                    <Suggestion
                      key={suggestion}
                      isPrimary={index === 0}
                      onClick={() => handleSend(suggestion)}
                    >
                      {suggestion}
                    </Suggestion>
                  ))}
                </div>
              </div>
            ) : (
              <div className="n-flex n-flex-col n-gap-4 n-pb-4">
                {messages.map((message: any, index: any) => {
                  const isLast = index === messages.length - 1;
                  const isLive = isBusy && isLast;

                  if (message.role === 'user') {
                    return (
                      <div
                        key={message.id}
                        style={{ display: 'flex', justifyContent: 'flex-end' }}
                      >
                        <UserBubble avatarProps={{ name: 'U', type: 'letters' }}>
                          {getMsgText(message)}
                        </UserBubble>
                      </div>
                    );
                  }

                  const ms = thinkingTimes[message.id];
                  const snapshot = memory[message.id];
                  const memoryCalls = toolParts(message.parts).filter((part) =>
                    isMemoryTool(part.toolName),
                  );
                  const text = getMsgText(message);
                  const hasTrace = message.parts.some(
                    (part: { type: string; }) => part.type === 'reasoning' || part.type === 'dynamic-tool',
                  );
                  const hasPanels =
                    isLive ||
                    hasTrace ||
                    snapshot !== undefined ||
                    memoryCalls.length > 0 ||
                    mode !== 'off';

                  return (
                    <div key={message.id} className="n-w-full n-flex n-flex-col n-gap-2">

                      {(isLive || ms !== undefined) && (
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              flexShrink: 0,
                              background: isLive
                                ? 'var(--theme-color-warning-text)'
                                : 'var(--theme-color-success-text)',
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontStyle: 'italic',
                              color: 'var(--palette-neutral-text-weakest)',
                            }}
                          >
                            {ms === undefined
                              ? 'Thinking…'
                              : `Thought for ${Math.max(1, Math.round(ms / 1000))}s`}
                          </span>
                        </div>
                      )}

                      {hasPanels && (
                        <div
                          style={{
                            border: '1px solid var(--theme-color-primary-border-weak)',
                            borderRadius: 10,
                            overflow: 'hidden',
                          }}
                        >
                          <MemoryPanel
                            mode={mode}
                            snapshot={snapshot}
                            toolCalls={memoryCalls}
                            isLive={isLive}
                            isExpanded={expandedMemory[message.id] ?? false}
                            onToggleExpand={() =>
                              setExpandedMemory((prev) => ({
                                ...prev,
                                [message.id]: !(prev[message.id] ?? false),
                              }))
                            }
                            activeTab={activeTab[message.id] ?? 'recent'}
                            onSetTab={(tab) =>
                              setActiveTab((prev) => ({ ...prev, [message.id]: tab }))
                            }
                          />
                          <ReasoningPanel
                            parts={message.parts}
                            isLive={isLive}
                            isExpanded={expandedReasoning[message.id] ?? false}
                            onToggleExpand={() =>
                              setExpandedReasoning((prev) => ({
                                ...prev,
                                [message.id]: !(prev[message.id] ?? false),
                              }))
                            }
                          />
                        </div>
                      )}

                      {text && (
                        <div
                          style={{
                            width: '100%',
                            marginTop: 3,
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: 'var(--theme-color-neutral-bg-strong)',
                            color: 'var(--theme-color-neutral-text-default)',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          <Response isAnimating={isLive}>{text}</Response>
                        </div>
                      )}

                      {!isLive && (
                        <div className="n-flex n-flex-row n-gap-1.5">
                          <CleanIconButton
                            size="small"
                            description="Ask again"
                            onClick={() => askAgain(index)}
                          >
                            <ArrowPathIconOutline />
                          </CleanIconButton>
                          <CleanIconButton
                            size="small"
                            description="Copy"
                            onClick={() => void handleCopy(text)}
                          >
                            <Square2StackIconOutline />
                          </CleanIconButton>
                        </div>
                      )}
                    </div>
                  );
                })}

                {agent.status === 'submitted' && messages.at(-1)?.role !== 'assistant' && (
                  <Thinking isThinking />
                )}
                {isResuming && (
                  <Typography variant="body-small">Reattaching to this session…</Typography>
                )}

                {errorMessage && (
                  <div className="n-bg-danger-bg-weak n-border n-border-danger-border-weak n-rounded-lg n-p-3">
                    <Typography variant="body-small">⚠ {errorMessage}</Typography>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        <div className="n-px-4 n-pt-4 n-pb-1 n-mt-auto full-width-content">
          <div style={{ margin: '0 auto', width: '100%', maxWidth: 860 }}>
            <Prompt
              value={input}
              onChange={(event: any) => setInput(event.target.value)}
              onSubmitPrompt={() => handleSend()}
              onCancelPrompt={() => void agent.cancel().catch(() => undefined)}
              isRunningPrompt={isBusy}
              isDisabled={isResuming}
              isSubmitDisabled={input.trim().length === 0 && !isBusy}
              disclaimer={
                <Typography
                  variant="body-small"
                  style={{ color: 'var(--palette-neutral-text-weakest)' }}
                >
                  {mode === 'off'
                    ? 'Memory is off — this agent forgets you the moment you close the tab.'
                    : `Memories are stored in Neo4j via NAMS (${mode} · ${MEMORY_MODES[mode].detail}) and persist across sessions.`}
                </Typography>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function latestTurnFailure(
  events: ReturnType<typeof useEveAgent>['events'],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === 'turn.failed') {
      return event.data.code === 'MODEL_CALL_FAILED'
        ? 'The model is temporarily unavailable. Please try again.'
        : event.data.message;
    }

    if (
      event.type === 'turn.completed' ||
      event.type === 'turn.cancelled' ||
      event.type === 'message.received'
    ) {
      return undefined;
    }
  }

  return undefined;
}
