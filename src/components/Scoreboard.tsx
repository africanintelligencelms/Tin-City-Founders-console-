import React, { useState, useEffect } from 'react';
import { Minus, Plus, RotateCcw, Activity } from 'lucide-react';
import { useVotingAnimation } from './VotingParticleManager';

interface ScoreboardProps {
  totalProblemsVoted: number;
  totalSquadsFormed: number;
  onOpenAnalytics?: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  totalProblemsVoted,
  totalSquadsFormed,
  onOpenAnalytics
}) => {
  const { triggerVoteAnimation } = useVotingAnimation();
  const [scores, setScores] = useState<{ conn: number; ask: number }>({
    conn: 0,
    ask: 0
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tcf_scores');
      if (saved) {
        const parsed = JSON.parse(saved);
        setScores({
          conn: typeof parsed.conn === 'number' ? parsed.conn : 0,
          ask: typeof parsed.ask === 'number' ? parsed.ask : 0
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const updateScore = (key: 'conn' | 'ask', delta: number) => {
    setScores((prev) => {
      const updated = { ...prev, [key]: Math.max(0, prev[key] + delta) };
      try {
        localStorage.setItem('tcf_scores', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const handleReset = () => {
    if (confirm('Reset room counters to zero for the next event?')) {
      const resetState = { conn: 0, ask: 0 };
      setScores(resetState);
      try {
        localStorage.setItem('tcf_scores', JSON.stringify(resetState));
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 text-center">
      <div className="inline-block font-display font-black tracking-wider text-xs text-[#09251B] bg-[#E5A93C] border-2 border-[#09251B] px-4 py-1.5 rounded-full mb-3 uppercase shadow-[2px_2px_0px_0px_#09251B]">
        TONIGHT IN THE ROOM
      </div>

      <h1 className="font-display font-black text-3xl sm:text-5xl text-[#09251B] mb-8">
        MEETUP IMPACT <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-8">SCOREBOARD</span>
      </h1>

      {/* Grid of 4 Score Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Metric 1: Connections Made */}
        <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 shadow-[6px_6px_0px_0px_#09251B] flex flex-col items-center">
          <div className="font-display font-black text-6xl sm:text-7xl text-[#0D4734] my-2">
            {scores.conn}
          </div>
          <div className="font-display font-black text-xs tracking-wider text-[#09251B] uppercase">
            CONNECTIONS MADE
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => updateScore('conn', -1)}
              className="w-10 h-10 rounded-xl border-2 border-[#09251B] hover:bg-[#FAF8F4] text-[#09251B] font-bold text-lg flex items-center justify-center transition cursor-pointer shadow-[2px_2px_0px_0px_#09251B]"
            >
              <Minus className="w-4 h-4 stroke-[3]" />
            </button>
            <button
              onClick={(e) => {
                triggerVoteAnimation(e, { text: '+1 Intro', type: 'squad', milestone: true });
                updateScore('conn', 1);
              }}
              className="w-10 h-10 rounded-xl bg-[#E5A93C] border-2 border-[#09251B] text-[#09251B] font-bold text-lg flex items-center justify-center transition hover:bg-[#D4952B] cursor-pointer shadow-[2px_2px_0px_0px_#09251B] active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Metric 2: Asks Answered */}
        <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 shadow-[6px_6px_0px_0px_#09251B] flex flex-col items-center">
          <div className="font-display font-black text-6xl sm:text-7xl text-[#0D4734] my-2">
            {scores.ask}
          </div>
          <div className="font-display font-black text-xs tracking-wider text-[#09251B] uppercase">
            ASKS ANSWERED
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => updateScore('ask', -1)}
              className="w-10 h-10 rounded-xl border-2 border-[#09251B] hover:bg-[#FAF8F4] text-[#09251B] font-bold text-lg flex items-center justify-center transition cursor-pointer shadow-[2px_2px_0px_0px_#09251B]"
            >
              <Minus className="w-4 h-4 stroke-[3]" />
            </button>
            <button
              onClick={(e) => {
                triggerVoteAnimation(e, { text: '+1 Solved', type: 'upvote', milestone: true });
                updateScore('ask', 1);
              }}
              className="w-10 h-10 rounded-xl bg-[#E5A93C] border-2 border-[#09251B] text-[#09251B] font-bold text-lg flex items-center justify-center transition hover:bg-[#D4952B] cursor-pointer shadow-[2px_2px_0px_0px_#09251B] active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Metric 3: Plateau Problems Voted */}
        <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 shadow-[6px_6px_0px_0px_#09251B] flex flex-col items-center">
          <div className="font-display font-black text-6xl sm:text-7xl text-[#0D4734] my-2">
            {totalProblemsVoted}
          </div>
          <div className="font-display font-black text-xs tracking-wider text-[#09251B] uppercase">
            PROBLEMS VOTED
          </div>
          <span className="text-[10px] text-[#0D4734] font-bold font-mono bg-[#EBF3EF] border border-[#0D4734]/30 px-3 py-1 rounded-full mt-6">
            Live Dashboard Total
          </span>
        </div>

        {/* Metric 4: Squads Formed */}
        <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 shadow-[6px_6px_0px_0px_#09251B] flex flex-col items-center">
          <div className="font-display font-black text-6xl sm:text-7xl text-[#0D4734] my-2">
            {totalSquadsFormed}
          </div>
          <div className="font-display font-black text-xs tracking-wider text-[#09251B] uppercase">
            SQUADS FORMED
          </div>
          <span className="text-[10px] text-[#0D4734] font-bold font-mono bg-[#EBF3EF] border border-[#0D4734]/30 px-3 py-1 rounded-full mt-6">
            Pledged Collaborators
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onOpenAnalytics && (
          <button
            onClick={onOpenAnalytics}
            className="bg-gradient-to-r from-[#0D4734] to-[#125B43] hover:from-[#125B43] hover:to-[#0D4734] text-[#FAF6EE] border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] font-display font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Activity className="w-4 h-4 text-[#E5A93C]" />
            <span>Open Room Live Intelligence & Analytics</span>
          </button>
        )}
        <button
          onClick={handleReset}
          className="bg-white hover:bg-[#FAF8F4] text-[#09251B] border-2 border-[#09251B] shadow-[2px_2px_0px_0px_#09251B] font-display font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-[#0D4734] stroke-[3]" />
          <span>Reset Counters for Next Event</span>
        </button>
      </div>

      <p className="text-xs text-[#09251B]/60 font-medium mt-8 max-w-md mx-auto leading-relaxed">
        Click +1 every time you spot a real introduction or an Ask getting answered in the room. Reveal these totals at the closing remarks — it provides proof of ecosystem traction!
      </p>
    </div>
  );
};
