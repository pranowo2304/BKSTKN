import React, { useEffect, useState } from 'react';
import { Siren, HeartHandshake, AlertCircle, X, ChevronRight, BellRing, CalendarDays } from 'lucide-react';
import { AppNotification } from '../types';

export interface ToastAlertItem extends AppNotification {
  toastId: string;
  targetTab?: string;
  badgeText?: string;
}

interface RealtimeToastNotifierProps {
  toasts: ToastAlertItem[];
  onDismiss: (toastId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const RealtimeToastNotifier: React.FC<RealtimeToastNotifierProps> = ({
  toasts,
  onDismiss,
  onNavigateTab,
}) => {
  if (toasts.length === 0) return null;

  return (
    <aside aria-label="Notifikasi Realtime" className="fixed top-20 right-4 z-50 flex flex-col gap-3 w-full max-w-sm sm:max-w-md pointer-events-none px-3 sm:px-0">
      {toasts.map((toast) => (
        <ToastSingleItem
          key={toast.toastId}
          toast={toast}
          onDismiss={() => onDismiss(toast.toastId)}
          onNavigate={() => {
            if (toast.targetTab) {
              onNavigateTab(toast.targetTab);
            } else if (toast.category === 'ambulance') {
              onNavigateTab('ambulance');
            } else if (toast.category === 'claim') {
              onNavigateTab('realization');
            } else if (toast.category === 'funeral') {
              onNavigateTab('funeral');
            }
            onDismiss(toast.toastId);
          }}
        />
      ))}
    </aside>
  );
};

interface ToastSingleItemProps {
  toast: ToastAlertItem;
  onDismiss: () => void;
  onNavigate: () => void;
}

const ToastSingleItem: React.FC<ToastSingleItemProps> = ({ toast, onDismiss, onNavigate }) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const durationMs = 7500;

  useEffect(() => {
    if (isHovered) return;
    const intervalTime = 50;
    const step = (intervalTime / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isHovered, onDismiss]);

  const isAmbulance = toast.category === 'ambulance' || toast.title.toLowerCase().includes('ambulans');
  const isClaim = toast.category === 'claim' || toast.title.toLowerCase().includes('klaim');
  const isFuneral = toast.category === 'funeral' || toast.title.toLowerCase().includes('pemakaman');

  // Styling based on urgency
  let borderClass = 'border-amber-300 shadow-amber-900/10';
  let headerBg = 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  let badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200';
  let iconComponent = <BellRing className="w-5 h-5 text-amber-600 animate-bounce" />;
  let progressBarColor = 'bg-amber-500';
  let actionLabel = 'Lihat Detail';

  if (isAmbulance) {
    borderClass = 'border-red-400 dark:border-red-500/60 shadow-red-900/15 ring-2 ring-red-400/30';
    headerBg = 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300';
    badgeColor = 'bg-red-600 text-white animate-pulse';
    iconComponent = <Siren className="w-5 h-5 text-red-600 animate-spin" style={{ animationDuration: '3s' }} />;
    progressBarColor = 'bg-red-600';
    actionLabel = 'Buka Antrean Ambulans';
  } else if (isClaim) {
    borderClass = 'border-purple-300 dark:border-purple-600/50 shadow-purple-900/15 ring-1 ring-purple-400/30';
    headerBg = 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300';
    badgeColor = 'bg-purple-600 text-white';
    iconComponent = <HeartHandshake className="w-5 h-5 text-purple-600 animate-pulse" />;
    progressBarColor = 'bg-purple-600';
    actionLabel = 'Proses Klaim Santunan';
  } else if (isFuneral) {
    borderClass = 'border-emerald-300 dark:border-emerald-600/50 shadow-emerald-900/15 ring-1 ring-emerald-400/30';
    headerBg = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300';
    badgeColor = 'bg-emerald-600 text-white';
    iconComponent = <CalendarDays className="w-5 h-5 text-emerald-600" />;
    progressBarColor = 'bg-emerald-600';
    actionLabel = 'Lihat Jadwal Pemakaman';
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pointer-events-auto relative overflow-hidden bg-white dark:bg-slate-900 border ${borderClass} rounded-2xl shadow-xl transition-all duration-300 ease-out transform translate-x-0 hover:scale-[1.02]`}
      style={{
        animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <style>{`
        @keyframes slideInRight {
          0% {
            opacity: 0;
            transform: translateX(110%) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>

      {/* Progress countdown bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full transition-all ease-linear ${progressBarColor}`}
          style={{ width: `${progress}%`, transitionDuration: '50ms' }}
        />
      </div>

      <div className="p-4 pt-3.5">
        {/* Header line with badge and close */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${headerBg} flex items-center justify-center`}>
              {iconComponent}
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
              {isAmbulance ? '🚨 SIAGA AMBULANS' : isClaim ? '🕊️ KLAIM DUKA MASUK' : isFuneral ? '⚰️ JADWAL PEMAKAMAN' : '🔔 NOTIFIKASI'}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Tutup Notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title and message */}
        <div className="space-y-1 pr-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
            {toast.title}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
            {toast.message}
          </p>
        </div>

        {/* Footer with action button */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {new Date(toast.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={onNavigate}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
              isAmbulance
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/30'
                : isClaim
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30'
            }`}
          >
            <span>{actionLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
