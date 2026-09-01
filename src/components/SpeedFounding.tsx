import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ArrowRight } from 'lucide-react';

export const SpeedFounding: React.FC = () => {
  const [duration, setDuration] = useState<number>(180); // 3 minutes default
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [round, setRound] = useState<number>(1);

  const prompts = [
    "In one sentence — what do you build in Jos, and who is your primary customer?",
    "What is the single biggest operational bottleneck slowing your business down right now?",
    "What product or service could the founder across from you buy from you or sell to you today?",
    "Swap one high-value local contact or one hard-won operational lesson in Plateau State.",
    "If ₦1,000,000 in non-equity grant landed in your startup tomorrow, what is your first move?",
    "What specific skill, hardware, or access do you need that someone in this room probably has?"
  ];

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPrompt = prompts[(round - 1) % prompts.length];

  // Play audio chime when timer ends
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const freqs = [660, 880, 990];
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const startTime = ctx.currentTime + index * 0.18;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);
        
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            playChime();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleSetDuration = (seconds: number) => {
    setIsRunning(false);
    setDuration(seconds);
    setTimeLeft(seconds);
  };

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(duration);
  };

  const handleNextRound = () => {
    setIsRunning(false);
    setRound((r) => r + 1);
    setTimeLeft(duration);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isWarning = timeLeft <= 30 && timeLeft > 0;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 text-center">
      <div className="inline-block font-display font-black tracking-wider text-xs text-[#09251B] bg-[#E5A93C] border-2 border-[#09251B] px-4 py-1.5 rounded-full mb-4 uppercase shadow-[2px_2px_0px_0px_#09251B]">
        SPEED-FOUNDING · ROUND <span className="text-[#0D4734] font-black text-sm">#{round}</span>
      </div>

      {/* Length Picker */}
      <div className="inline-flex items-center gap-2 mb-6 bg-white border-3 border-[#09251B] p-1.5 rounded-2xl shadow-[4px_4px_0px_0px_#09251B]">
        {[180, 300, 420].map((s) => (
          <button
            key={s}
            onClick={() => handleSetDuration(s)}
            className={`font-display font-black text-xs px-4 py-2 rounded-xl transition cursor-pointer ${
              duration === s
                ? 'bg-[#0D4734] text-[#FAF6EE] border-2 border-[#09251B] shadow-[2px_2px_0px_0px_#09251B]'
                : 'text-[#09251B] hover:text-[#0D4734] font-bold'
            }`}
          >
            {s / 60} MIN
          </button>
        ))}
      </div>

      {/* Clock Display */}
      <div
        className={`font-display font-black text-7xl sm:text-9xl tracking-tight my-6 transition-colors ${
          timeLeft === 0
            ? 'text-rose-600 animate-pulse'
            : isWarning
            ? 'text-[#C85A28] animate-bounce'
            : 'text-[#09251B]'
        }`}
      >
        {formatTime(timeLeft)}
      </div>

      {/* Prompt Card */}
      <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 sm:p-8 my-6 shadow-[8px_8px_0px_0px_#09251B] max-w-2xl mx-auto text-center">
        <span className="text-xs font-display font-black text-[#0D4734] uppercase tracking-wider block mb-2">
          ROUND {round} DISCUSSION PROMPT
        </span>
        <p className="font-display font-black text-xl sm:text-3xl text-[#09251B] leading-snug">
          "{currentPrompt}"
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
        <button
          onClick={handleStartPause}
          className="bg-[#E5A93C] hover:bg-[#D4952B] text-[#09251B] border-2 border-[#09251B] font-display font-black text-sm px-8 py-3.5 rounded-2xl shadow-[4px_4px_0px_0px_#09251B] transition flex items-center gap-2 cursor-pointer"
        >
          {isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{isRunning ? 'PAUSE' : 'START TIMER'}</span>
        </button>

        <button
          onClick={handleReset}
          className="bg-white hover:bg-[#FAF8F4] text-[#09251B] border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] font-display font-black text-sm px-6 py-3.5 rounded-2xl transition flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-[#0D4734] stroke-[3]" />
          <span>RESET</span>
        </button>

        <button
          onClick={handleNextRound}
          className="bg-white hover:bg-[#FAF8F4] text-[#09251B] border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] font-display font-black text-sm px-6 py-3.5 rounded-2xl transition flex items-center gap-2 cursor-pointer"
        >
          <span>NEXT ROUND</span>
          <ArrowRight className="w-4 h-4 text-[#0D4734] stroke-[3]" />
        </button>
      </div>

      <p className="text-xs text-[#09251B]/60 font-medium mt-8 max-w-md mx-auto leading-relaxed">
        Pairs sit knee-to-knee. When the chime sounds, everyone shifts one seat to the right and you hit "Next Round".
      </p>
    </div>
  );
};
