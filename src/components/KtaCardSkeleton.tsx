import React from 'react';
import { ShieldCheck, QrCode } from 'lucide-react';

interface KtaCardSkeletonProps {
  className?: string;
  side?: 'front' | 'back';
  statusText?: string;
}

export const KtaCardSkeleton: React.FC<KtaCardSkeletonProps> = ({
  className = '',
  side = 'front',
  statusText = 'Memuat data KTA digital...',
}) => {
  return (
    <div
      className={`w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden text-white border border-emerald-500/30 shadow-xl select-none flex flex-col justify-between p-4 sm:p-5 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #032017 0%, #064e3b 45%, #0f172a 100%)',
      }}
      role="status"
      aria-live="polite"
      aria-label="Memuat kartu tanda anggota digital"
    >
      {/* Background radial pattern */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

      {/* Shimmer sweep effect running continuously */}
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer pointer-events-none z-20"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        }}
      />

      {side === 'front' ? (
        /* FRONT SKELETON */
        <>
          {/* Top Bar Skeleton */}
          <div className="flex justify-between items-start gap-2 border-b border-white/10 pb-2 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-400/50 animate-pulse shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-28 sm:w-32 bg-emerald-400/20 rounded-full animate-pulse" />
                <div className="h-3.5 w-36 sm:w-44 bg-white/20 rounded-md animate-pulse" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-5 w-20 sm:w-24 bg-emerald-400/15 border border-emerald-400/20 rounded-md animate-pulse" />
            </div>
          </div>

          {/* Middle Content Skeleton */}
          <div className="grid grid-cols-12 gap-2 my-auto py-1 items-center relative z-10">
            <div className="col-span-8 space-y-2">
              <div className="h-2 w-32 bg-emerald-300/20 rounded-full animate-pulse" />
              <div className="h-6 sm:h-7 w-40 sm:w-48 bg-white/25 rounded-md animate-pulse" />
              <div className="h-4 sm:h-5 w-48 sm:w-60 bg-white/20 rounded-md animate-pulse" />
              <div className="flex items-center gap-2 pt-0.5">
                <div className="h-2.5 w-20 bg-emerald-200/20 rounded-full animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-emerald-200/30" />
                <div className="h-2.5 w-24 bg-emerald-200/20 rounded-full animate-pulse" />
              </div>
            </div>

            {/* QR Code Placeholder with scanner line effect */}
            <div className="col-span-4 flex flex-col items-center justify-center">
              <div className="w-16 h-16 sm:w-[70px] sm:h-[70px] bg-white/10 rounded-xl p-2 border border-white/20 flex items-center justify-center relative overflow-hidden shadow-inner">
                <QrCode className="w-8 h-8 text-white/30 animate-pulse" />
                {/* Micro scanning line */}
                <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400/60 shadow-[0_0_8px_#34d399] animate-pulse" />
              </div>
              <div className="h-2 w-14 bg-emerald-400/20 rounded-full mt-1.5 animate-pulse" />
            </div>
          </div>

          {/* Bottom Bar Skeleton */}
          <div className="flex justify-between items-end pt-1.5 border-t border-white/10 relative z-10">
            <div className="space-y-1">
              <div className="h-2 w-20 bg-emerald-300/20 rounded-full animate-pulse" />
              <div className="h-3 w-24 bg-white/20 rounded-md animate-pulse" />
            </div>
            <div className="space-y-1 flex flex-col items-end">
              <div className="h-2 w-16 bg-emerald-300/20 rounded-full animate-pulse" />
              <div className="h-3 w-28 bg-white/20 rounded-md animate-pulse" />
            </div>
          </div>
        </>
      ) : (
        /* BACK SKELETON */
        <>
          {/* Back Top Bar */}
          <div className="flex justify-between items-center border-b border-white/10 pb-1.5 relative z-10">
            <div className="h-2.5 w-44 bg-teal-300/20 rounded-full animate-pulse" />
            <div className="h-3.5 w-16 bg-white/15 rounded-md animate-pulse" />
          </div>

          {/* Back Body */}
          <div className="grid grid-cols-12 gap-2 my-auto py-1 items-center relative z-10">
            <div className="col-span-7 space-y-1.5">
              <div className="h-2 w-24 bg-teal-300/20 rounded-full animate-pulse" />
              <div className="h-4 w-40 bg-white/25 rounded-md animate-pulse" />
              <div className="h-10 w-full bg-black/20 rounded-lg border border-white/10 p-1.5 space-y-1 animate-pulse">
                <div className="h-2 w-28 bg-white/15 rounded" />
                <div className="h-2 w-36 bg-white/10 rounded" />
              </div>
            </div>
            <div className="col-span-5 flex flex-col items-center justify-center space-y-1">
              <div className="w-14 h-14 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center animate-pulse">
                <QrCode className="w-7 h-7 text-white/30" />
              </div>
              <div className="h-6 w-full bg-black/20 rounded-lg border border-white/10 animate-pulse" />
            </div>
          </div>

          {/* Back Footer */}
          <div className="flex justify-between items-end pt-1 border-t border-white/10 relative z-10">
            <div className="h-2.5 w-24 bg-white/15 rounded animate-pulse" />
            <div className="h-2.5 w-20 bg-emerald-300/20 rounded animate-pulse" />
          </div>
        </>
      )}

      {/* Floating Status Pill */}
      {statusText && (
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center pointer-events-none z-30">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-bold bg-slate-950/75 backdrop-blur-md text-emerald-300 border border-emerald-500/30 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{statusText}</span>
          </span>
        </div>
      )}
    </div>
  );
};
