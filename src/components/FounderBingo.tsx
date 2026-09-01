import React, { useState } from 'react';
import { Trophy, Check, Sparkles, RotateCcw } from 'lucide-react';

export const FounderBingo: React.FC = () => {
  const defaultSquares = [
    "Has shipped a live digital or physical product in Jos",
    "Is a non-tech or agricultural business founder",
    "Is a founder or student based outside Jos City limits",
    "Can teach you a growth/technical skill in 5 minutes",
    "Has raised grant funding or lent money to a peer",
    "Started their current Plateau venture in the last year",
    "Employs or manages more than 3 staff members",
    "Sells products directly B2B to other businesses",
    "Could potentially be your first or next customer"
  ];

  const [completed, setCompleted] = useState<boolean[]>(Array(9).fill(false));
  const [hasWon, setHasWon] = useState<boolean>(false);

  // Check winning lines (3 rows, 3 cols, 2 diagonals)
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  const toggleSquare = (index: number) => {
    const updated = [...completed];
    updated[index] = !updated[index];
    setCompleted(updated);

    // Check if any winning line is complete
    const isWin = winningLines.some(line => line.every(idx => updated[idx]));
    setHasWon(isWin);
  };

  const handleReset = () => {
    setCompleted(Array(9).fill(false));
    setHasWon(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 text-center">
      <div className="inline-block font-display font-black tracking-wider text-xs text-[#09251B] bg-[#E5A93C] border-2 border-[#09251B] px-4 py-1.5 rounded-full mb-3 uppercase shadow-[2px_2px_0px_0px_#09251B]">
        FOUNDER BINGO GAME
      </div>

      <h1 className="font-display font-black text-3xl sm:text-5xl text-[#09251B] mb-2">
        FIND SOMEONE <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-8">WHO...</span>
      </h1>

      <p className="text-xs sm:text-sm font-semibold text-[#09251B]/70 mb-6 max-w-md mx-auto">
        Tap a square when you meet a founder in the room matching the description. First to get a line shouts <strong className="text-[#0D4734] font-black">"TIN CITY!"</strong>
      </p>

      {/* Win Banner */}
      {hasWon && (
        <div className="bg-[#E5A93C] text-[#09251B] border-4 border-[#09251B] rounded-2xl p-4 mb-6 shadow-[6px_6px_0px_0px_#09251B] animate-bounce flex items-center justify-center gap-3">
          <Trophy className="w-7 h-7 stroke-[2.5]" />
          <span className="font-display font-black text-xl sm:text-2xl tracking-wider">
            BINGO! SHOUT "TIN CITY!" TO THE ROOM
          </span>
          <Sparkles className="w-7 h-7 stroke-[2.5]" />
        </div>
      )}

      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-3.5 max-w-xl mx-auto my-6">
        {defaultSquares.map((text, idx) => {
          const isDone = completed[idx];
          return (
            <button
              key={idx}
              onClick={() => toggleSquare(idx)}
              className={`p-3 sm:p-4 rounded-2xl border-3 text-xs sm:text-sm font-bold transition-all min-h-[95px] sm:min-h-[115px] flex flex-col items-center justify-center text-center cursor-pointer relative group ${
                isDone
                  ? 'bg-[#0D4734] text-[#FAF6EE] border-[#09251B] font-black shadow-[4px_4px_0px_0px_#09251B] scale-[0.98]'
                  : 'bg-white text-[#09251B] border-[#09251B] hover:border-[#09251B] hover:bg-[#FAF8F4] shadow-[3px_3px_0px_0px_rgba(9,37,27,0.1)] hover:shadow-[4px_4px_0px_0px_#09251B]'
              }`}
            >
              {isDone && (
                <div className="absolute top-2 right-2 bg-[#E5A93C] border border-[#09251B] text-[#09251B] rounded-full p-0.5 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              <span className="leading-snug">...{text}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={handleReset}
          className="bg-white hover:bg-[#FAF8F4] text-[#09251B] border-2 border-[#09251B] shadow-[2px_2px_0px_0px_#09251B] font-display font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-[#0D4734] stroke-[3]" />
          <span>Reset Bingo Card</span>
        </button>
      </div>
    </div>
  );
};
