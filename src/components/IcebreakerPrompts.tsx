import React, { useState } from 'react';
import { Sparkles, Dices, Timer } from 'lucide-react';

export const IcebreakerPrompts: React.FC = () => {
  const spinPrompts = [
    "Your founder origin story — in exactly five words.",
    "The absolute worst business advice you ever followed in Nigeria.",
    "What were you doing full-time before launching this venture?",
    "Tin or Gold — and why does it describe your business hustle?",
    "The last milestone at work that made your team genuinely proud.",
    "One technical or business skill you would trade for right now.",
    "Your business in three years on the Plateau — paint the picture.",
    "Which business leader in Jos do you wish was sitting in this room?",
    "What is the most uniquely Nigerian thing about running your business?",
    "What product would you build if you knew it couldn't fail?",
    "Name one local tool, mentor, or space that saved your business.",
    "What's an Ask you are almost too shy to say out loud to investors?",
    "If you could solve one Plateau State infrastructure problem overnight, what is it?",
    "What is your favorite local spot in Jos to recharge after a long week?",
    "What is one customer reaction that completely changed your product strategy?"
  ];

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  const handleSpin = () => {
    setIsSpinning(true);
    setTimerSeconds(null);
    let count = 0;
    const interval = setInterval(() => {
      setCurrentIndex(Math.floor(Math.random() * spinPrompts.length));
      count++;
      if (count > 10) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 80);
  };

  const start20SecChallenge = () => {
    setTimerSeconds(20);
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 text-center">
      <div className="inline-block font-display font-black tracking-wider text-xs text-[#09251B] bg-[#E5A93C] border-2 border-[#09251B] px-4 py-1.5 rounded-full mb-3 uppercase shadow-[2px_2px_0px_0px_#09251B]">
        MEETUP ICEBREAKER
      </div>

      <h1 className="font-display font-black text-3xl sm:text-5xl text-[#09251B] mb-8">
        SPIN FOR A <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-8">PROMPT</span>
      </h1>

      {/* Main Card */}
      <div className="bg-white border-4 border-[#09251B] rounded-3xl p-8 my-4 shadow-[8px_8px_0px_0px_#09251B] min-h-[220px] flex flex-col items-center justify-center relative overflow-hidden">
        <Sparkles className="w-9 h-9 text-[#E5A93C] mb-4 animate-bounce fill-current" />
        
        <p className={`font-display font-black text-2xl sm:text-3xl text-[#09251B] leading-snug max-w-lg transition-all duration-150 ${isSpinning ? 'scale-95 opacity-50 blur-[1px]' : 'scale-100 opacity-100'}`}>
          "{spinPrompts[currentIndex]}"
        </p>

        {timerSeconds !== null && (
          <div className="mt-4 inline-flex items-center gap-1.5 bg-[#FEF7EB] border-2 border-[#09251B] px-4 py-1.5 rounded-full text-xs font-mono font-black text-[#09251B] shadow-[2px_2px_0px_0px_#09251B]">
            <Timer className="w-4 h-4 text-[#0D4734]" />
            <span>20s Challenge: {timerSeconds}s</span>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
        <button
          onClick={handleSpin}
          disabled={isSpinning}
          className="bg-[#E5A93C] hover:bg-[#D4952B] text-[#09251B] font-display font-black border-2 border-[#09251B] shadow-[4px_4px_0px_0px_#09251B] text-sm px-8 py-3.5 rounded-2xl transition flex items-center gap-2 cursor-pointer"
        >
          <Dices className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>SPIN A PROMPT</span>
        </button>

        <button
          onClick={start20SecChallenge}
          className="bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-black border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] text-sm px-6 py-3.5 rounded-2xl transition flex items-center gap-2 cursor-pointer"
        >
          <Timer className="w-5 h-5 text-[#E5A93C] stroke-[3]" />
          <span>20s Answer Challenge</span>
        </button>
      </div>

      <p className="text-xs text-[#09251B]/60 font-medium mt-8 max-w-md mx-auto leading-relaxed">
        Use between segments or throw to a random founder in the room. Keep answers under 20 seconds to maintain high energy!
      </p>
    </div>
  );
};
