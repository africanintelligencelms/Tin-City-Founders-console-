import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/soundEffects';

export interface ParticleItem {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  type: 'upvote' | 'squad' | 'category' | 'sparkle';
}

interface VotingParticleContextType {
  triggerVoteAnimation: (
    e: React.MouseEvent<HTMLElement> | { clientX: number; clientY: number },
    options?: {
      text?: string;
      color?: string;
      type?: 'upvote' | 'squad' | 'category' | 'sparkle';
      milestone?: boolean;
    }
  ) => void;
}

export const VotingParticleContext = React.createContext<VotingParticleContextType>({
  triggerVoteAnimation: () => {}
});

export const useVotingAnimation = () => React.useContext(VotingParticleContext);

export const VotingParticleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [particles, setParticles] = useState<ParticleItem[]>([]);

  const triggerVoteAnimation = useCallback(
    (
      e: React.MouseEvent<HTMLElement> | { clientX: number; clientY: number },
      options: {
        text?: string;
        color?: string;
        type?: 'upvote' | 'squad' | 'category' | 'sparkle';
        milestone?: boolean;
      } = {}
    ) => {
      const x = 'clientX' in e ? e.clientX : window.innerWidth / 2;
      const y = 'clientY' in e ? e.clientY : window.innerHeight / 2;

      const type = options.type || 'upvote';
      const text = options.text || (type === 'squad' ? '⚡ Squad +1' : '+1');
      const color = options.color || (type === 'squad' ? '#0D4734' : '#E5A93C');

      // Audio feedback
      if (type === 'squad') {
        sounds.playSquadJoinedSound();
      } else {
        sounds.playVoteSound();
      }

      // Confetti burst for squads or milestones
      if (options.milestone || type === 'squad') {
        try {
          const originX = x / window.innerWidth;
          const originY = y / window.innerHeight;
          confetti({
            particleCount: type === 'squad' ? 35 : 25,
            spread: 60,
            origin: { x: originX, y: originY },
            colors: ['#E5A93C', '#0D4734', '#166E52', '#F59E0B', '#FAF6EE'],
            ticks: 120,
            gravity: 1.2,
            scalar: 0.85
          });
        } catch (err) {}
      }

      // Add main floating particle
      const id = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newParticle: ParticleItem = {
        id,
        x,
        y,
        text,
        color,
        type
      };

      setParticles(prev => [...prev.slice(-12), newParticle]);

      // Remove after animation completes
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, 1000);
    },
    []
  );

  return (
    <VotingParticleContext.Provider value={{ triggerVoteAnimation }}>
      {children}
      {/* Floating Particle Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{
                opacity: 1,
                scale: 0.6,
                x: p.x - 24,
                y: p.y - 20,
                rotate: (Math.random() - 0.5) * 20
              }}
              animate={{
                opacity: 0,
                scale: [0.6, 1.25, 1.1],
                y: p.y - 75 - Math.random() * 20,
                x: p.x - 24 + (Math.random() - 0.5) * 40,
                rotate: (Math.random() - 0.5) * 30
              }}
              transition={{
                duration: 0.85,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute font-display font-black text-xs sm:text-sm px-2.5 py-1 rounded-full shadow-lg border border-[#09251B]/40 flex items-center gap-1 select-none"
              style={{
                backgroundColor: p.type === 'squad' ? '#0D4734' : '#E5A93C',
                color: p.type === 'squad' ? '#FAF6EE' : '#09251B',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              <span>{p.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </VotingParticleContext.Provider>
  );
};
