import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon-only' | 'badge';
  className?: string;
  dark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
  dark = false
}) => {
  // Gemstone Diamond Icon Vector matching the uploaded Tin City Founders logo
  const DiamondMark = ({ iconSize = 40 }: { iconSize?: number }) => (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-sm"
    >
      {/* Top Floating Diamond Rhombus */}
      <polygon points="50,4 62,17 50,30 38,17" fill="#E5A93C" />

      {/* Center Left Facet */}
      <polygon points="50,37 21,37 50,96" fill="#D4952B" />

      {/* Center Right Facet */}
      <polygon points="50,37 79,37 50,96" fill="#E5A93C" />

      {/* Top Center-Right Highlight Facet */}
      <polygon points="50,37 79,37 66,54" fill="#F4BF58" opacity="0.85" />

      {/* Subtle Inner Spine Line */}
      <line x1="50" y1="37" x2="50" y2="96" stroke="#0D4734" strokeWidth="1.5" strokeOpacity="0.4" />
    </svg>
  );

  if (variant === 'icon-only') {
    const pixelSize = size === 'sm' ? 24 : size === 'md' ? 36 : size === 'lg' ? 48 : 64;
    return <DiamondMark iconSize={pixelSize} />;
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-[#09251B] bg-[#0D4734] text-[#FAF6EE] shadow-[2px_2px_0px_0px_#09251B] ${className}`}>
        <DiamondMark iconSize={20} />
        <span className="font-display font-black tracking-wider text-xs uppercase text-[#E5A93C]">
          TIN CITY FOUNDERS
        </span>
      </div>
    );
  }

  // Full brand header mark
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-11 h-11 bg-[#0D4734] rounded-2xl flex items-center justify-center border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] p-1 shrink-0">
        <DiamondMark iconSize={28} />
      </div>
      <div>
        <div className="font-display font-black tracking-tight text-xl sm:text-2xl text-[#09251B] flex items-center gap-2">
          <span>TIN CITY</span>
          <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-4">FOUNDERS</span>
          <span className="text-[10px] bg-[#E5A93C] text-[#09251B] border-2 border-[#09251B] px-2 py-0.5 rounded-lg font-sans font-black tracking-wider uppercase hidden sm:inline-block shadow-[1px_1px_0px_0px_#09251B]">
            JOS · EST. 2026
          </span>
        </div>
        <small className="block font-display font-bold text-[11px] text-[#0D4734]/80 tracking-wider">
          PLATEAU FOUNDER CONSOLE & PROBLEM TRACKER
        </small>
      </div>
    </div>
  );
};
