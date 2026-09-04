import React, { useState, useEffect, useMemo } from 'react';
import { Vote, CheckCircle2, Trophy, Radio, Loader2, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { VotingRound, MyRoundBallot } from '../types';

interface RoundTakeoverProps {
  round: VotingRound;
  myBallot: MyRoundBallot;
  onSubmitBallot: (selections: string[]) => Promise<void> | void;
  voterName?: string;
  syncStatus?: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  // Tapping the pill forces a full resync — the escape hatch for a phone that
  // was locked mid-round and came back to a stale ballot.
  onReconnect?: () => void;
}

const KIND_LABEL: Record<VotingRound['kind'], string> = {
  problem: 'Problem Ballot',
  category: 'Sector Ballot',
  trustee: 'Trustee Ballot'
};

export const RoundTakeover: React.FC<RoundTakeoverProps> = ({
  round,
  myBallot,
  onSubmitBallot,
  voterName,
  syncStatus = 'connected',
  onReconnect
}) => {
  const [selections, setSelections] = useState<string[]>(myBallot.selections || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new round always starts from a clean ballot.
  useEffect(() => {
    setSelections(myBallot.roundId === round.id ? myBallot.selections || [] : []);
    setError(null);
  }, [round.id, myBallot.roundId, myBallot.selections]);

  const isMulti = round.maxSelections > 1;
  const atCap = selections.length >= round.maxSelections;

  const toggle = (optionId: string) => {
    setError(null);
    setSelections(prev => {
      if (prev.includes(optionId)) return prev.filter(id => id !== optionId);
      if (!isMulti) return [optionId];
      if (prev.length >= round.maxSelections) return prev;
      return [...prev, optionId];
    });
  };

  const submit = async () => {
    if (!selections.length) {
      setError('Pick at least one option to submit your ballot.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmitBallot(selections);
    } catch (e: any) {
      setError(e?.message || 'Could not submit your ballot. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Small, quiet connection pill — same language as the idle screen's. It only
  // asks to be tapped when the link is actually down.
  const isLive = syncStatus === 'connected';
  const ConnectionPill = () => (
    <button
      type="button"
      onClick={() => { if (!isLive && onReconnect) onReconnect(); }}
      disabled={isLive || !onReconnect}
      title={isLive ? 'Live with the room' : 'Tap to resync with the room'}
      className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-full border transition ${
        isLive
          ? 'border-emerald-400/25 text-emerald-300/70 cursor-default'
          : 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 cursor-pointer active:scale-95'
      }`}
    >
      {isLive ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </>
      ) : (
        <>
          <RefreshCw size={10} className={syncStatus === 'offline' ? '' : 'animate-spin'} />
          {syncStatus === 'offline' ? 'Offline · tap to retry' : 'Reconnecting · tap to resync'}
        </>
      )}
    </button>
  );

  const winner = useMemo(() => round.results?.[0], [round.results]);
  const maxVotes = useMemo(
    () => Math.max(1, ...(round.results || []).map(r => r.votes)),
    [round.results]
  );

  // ---------------- Results reveal ----------------
  if (round.status === 'revealed') {
    return (
      <div className="min-h-screen bg-[#071912] text-[#FAF6EE] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
              <Trophy size={14} />
              Results In
            </div>
            <ConnectionPill />
          </div>
          <h1 className="text-2xl font-display font-bold leading-tight mb-1">{round.title}</h1>
          <p className="text-white/50 text-sm mb-6">
            {round.ballotsCast} ballot{round.ballotsCast === 1 ? '' : 's'} cast · {KIND_LABEL[round.kind]}
          </p>

          {winner && (
            <div className="rounded-2xl bg-amber-500/15 border border-amber-400/40 p-4 mb-5">
              <div className="text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider mb-1">
                Top of the room
              </div>
              <div className="text-lg font-display font-bold">{winner.label}</div>
              {winner.sublabel && <div className="text-white/50 text-xs mt-0.5">{winner.sublabel}</div>}
              <div className="text-amber-200 text-sm font-mono mt-2">
                {winner.votes} vote{winner.votes === 1 ? '' : 's'} · {Math.round(winner.share * 100)}%
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(round.results || []).map((r, i) => {
              const mine = myBallot.roundId === round.id && myBallot.selections.includes(r.optionId);
              return (
                <div
                  key={r.optionId}
                  className={`relative overflow-hidden rounded-xl border p-3 ${
                    mine ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500/15 transition-all duration-700"
                    style={{ width: `${(r.votes / maxVotes) * 100}%` }}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-center gap-3">
                    <span className="text-white/30 font-mono text-xs w-5 shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{r.label}</div>
                      {r.sublabel && <div className="text-white/40 text-xs truncate">{r.sublabel}</div>}
                    </div>
                    {mine && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                    <span className="font-mono text-sm font-bold shrink-0">{r.votes}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-white/35 text-xs mt-6">
            Returning to the room shortly…
          </p>
        </div>
      </div>
    );
  }

  // ---------------- Open ballot ----------------
  const alreadyVoted = myBallot.roundId === round.id && myBallot.hasVoted;

  return (
    <div className="min-h-screen bg-[#071912] text-[#FAF6EE] px-4 py-6 pb-32">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Round Open · {KIND_LABEL[round.kind]}
          </div>
          <ConnectionPill />
        </div>

        <h1 className="text-2xl font-display font-bold leading-tight mb-1">{round.title}</h1>
        {round.prompt && <p className="text-white/60 text-sm mb-2">{round.prompt}</p>}
        <p className="text-white/40 text-xs mb-5 flex items-center gap-3">
          <span>{isMulti ? `Choose up to ${round.maxSelections}` : 'Choose one'}</span>
          <span className="flex items-center gap-1">
            <Users size={11} /> {round.ballotsCast} in
          </span>
        </p>

        {alreadyVoted && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-3 mb-4 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-emerald-100 text-xs">
              Your ballot is in{voterName ? `, ${voterName}` : ''}. You can change it until the host closes the round.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {round.options.map(option => {
            const picked = selections.includes(option.id);
            const disabled = !picked && atCap && isMulti;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                disabled={disabled}
                aria-pressed={picked}
                className={`w-full text-left rounded-xl border p-3.5 transition active:scale-[0.99] ${
                  picked
                    ? 'border-emerald-400 bg-emerald-500/20'
                    : disabled
                    ? 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`shrink-0 w-5 h-5 flex items-center justify-center border-2 ${
                      isMulti ? 'rounded-md' : 'rounded-full'
                    } ${picked ? 'border-emerald-400 bg-emerald-400' : 'border-white/30'}`}
                  >
                    {picked && <CheckCircle2 size={12} className="text-[#071912]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{option.label}</div>
                    {option.sublabel && (
                      <div className="text-white/45 text-xs truncate mt-0.5">{option.sublabel}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-500/15 border border-red-400/40 p-3 flex items-start gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-100 text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 inset-x-0 bg-[#071912]/95 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting || !selections.length}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40 text-[#071912] font-display font-bold py-3.5 transition active:scale-[0.99] disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <><Loader2 size={16} className="animate-spin" /> Submitting…</>
            ) : error ? (
              <><RefreshCw size={16} /> Try again</>
            ) : alreadyVoted ? (
              <><Vote size={16} /> Update my ballot</>
            ) : (
              <><Vote size={16} /> Submit ballot</>
            )}
          </button>
          <p className="text-center text-white/30 text-[11px] mt-2 flex items-center justify-center gap-1">
            {error ? (
              <>Sending it again is safe — one ballot per device.</>
            ) : (
              <><Radio size={10} /> Live · one ballot per device</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
