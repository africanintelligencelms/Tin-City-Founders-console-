import React, { useEffect } from 'react';
import { 
  X, 
  Lightbulb, 
  Users, 
  Rocket, 
  Sparkles, 
  CheckCircle2, 
  Info, 
  ThumbsUp, 
  ArrowUpRight,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastNotification } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onToastClick?: (toast: ToastNotification) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onToastClick
}) => {
  return (
    <aside 
      aria-label="Notifications"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 left-4 sm:left-auto z-50 flex flex-col gap-2.5 max-w-md w-auto sm:w-[420px] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => onDismiss(toast.id)}
            onClick={() => onToastClick && onToastClick(toast)}
          />
        ))}
      </AnimatePresence>
    </aside>
  );
};

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: () => void;
  onClick?: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onClick }) => {
  const duration = toast.duration ?? 4500;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const getToastConfig = () => {
    switch (toast.type) {
      case 'problem_submitted':
        return {
          headerBg: 'bg-[#0D4734]',
          headerText: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#E5A93C] text-[#09251B]',
          badgeLabel: 'New Challenge Added',
          icon: Rocket,
          iconColor: 'text-[#E5A93C]',
          borderColor: 'border-[#09251B]',
          accentBar: 'bg-[#E5A93C]'
        };
      case 'squad_joined':
        return {
          headerBg: 'bg-[#166E52]',
          headerText: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#E5A93C] text-[#09251B]',
          badgeLabel: 'Squad Pledge',
          icon: Users,
          iconColor: 'text-[#E5A93C]',
          borderColor: 'border-[#09251B]',
          accentBar: 'bg-[#166E52]'
        };
      case 'upvote':
        return {
          headerBg: 'bg-[#0D4734]',
          headerText: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#FAF8F4] text-[#0D4734]',
          badgeLabel: 'Challenge Upvoted',
          icon: ThumbsUp,
          iconColor: 'text-[#E5A93C]',
          borderColor: 'border-[#09251B]',
          accentBar: 'bg-[#E5A93C]'
        };
      case 'success':
        return {
          headerBg: 'bg-[#0D4734]',
          headerText: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#E5A93C] text-[#09251B]',
          badgeLabel: 'Success',
          icon: CheckCircle2,
          iconColor: 'text-[#E5A93C]',
          borderColor: 'border-[#09251B]',
          accentBar: 'bg-[#0D4734]'
        };
      default:
        return {
          headerBg: 'bg-[#0D4734]',
          headerText: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#FAF8F4] text-[#09251B]',
          badgeLabel: 'Plateau Notice',
          icon: Info,
          iconColor: 'text-[#FAF6EE]',
          borderColor: 'border-[#09251B]',
          accentBar: 'bg-[#0D4734]'
        };
    }
  };

  const config = getToastConfig();
  const IconComponent = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 35, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`pointer-events-auto bg-[#FAF8F4] border-3 ${config.borderColor} rounded-2xl shadow-[6px_6px_0px_0px_#09251B] overflow-hidden flex flex-col relative select-none`}
      role="alert"
    >
      {/* Toast Header */}
      <div className={`${config.headerBg} ${config.headerText} px-3.5 py-2 flex items-center justify-between border-b-2 border-[#09251B]`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-[#09251B]/40 flex items-center justify-center flex-none">
            <IconComponent className={`w-3.5 h-3.5 ${config.iconColor} stroke-[2.5]`} />
          </div>
          <span className={`text-[10px] font-display font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#09251B]/40 ${config.badgeBg}`}>
            {config.badgeLabel}
          </span>
          {toast.sector && (
            <span className="text-[10px] font-mono text-[#FAF6EE]/80 truncate font-semibold">
              · {toast.sector}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-[#FAF6EE]/70 hover:text-white hover:bg-white/15 p-1 rounded-lg transition cursor-pointer flex-none ml-2"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5 stroke-[3]" />
        </button>
      </div>

      {/* Toast Body */}
      <div 
        onClick={onClick}
        className={`p-3.5 flex items-start gap-3 ${onClick ? 'cursor-pointer hover:bg-white/60 transition' : ''}`}
      >
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-black text-xs sm:text-sm text-[#09251B] leading-tight line-clamp-2">
            {toast.title}
          </h4>
          <p className="text-[11px] text-[#09251B]/80 font-medium mt-1 leading-snug line-clamp-2">
            {toast.message}
          </p>

          {toast.author && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[#0D4734]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5A93C]" />
              <span>By {toast.author}</span>
            </div>
          )}
        </div>
      </div>

      {/* Subtle Auto-dismiss Progress Bar */}
      {duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={`h-1 ${config.accentBar} opacity-80`}
        />
      )}
    </motion.div>
  );
};
