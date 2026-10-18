import React, { useEffect } from 'react';
import { AppUser } from '../types';
import {
  LogOut,
  AlertTriangle,
  X,
  Shield,
  Building2,
} from 'lucide-react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  user: AppUser | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  user,
  onConfirm,
  onClose,
}) => {
  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          title="Batal dan tutup"
          aria-label="Tutup konfirmasi"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Warning Icon & Title */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 pr-6">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 mb-1">
                <Shield className="w-3 h-3" />
                Konfirmasi Keamanan Sesi
              </span>
              <h3 id="logout-dialog-title" className="text-lg font-black text-slate-900 leading-tight">
                Keluar dari Akun Sistem?
              </h3>
            </div>
          </div>

          {/* User Details Card */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/90 space-y-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm shrink-0 ${
                  user.avatarColor || 'bg-indigo-600'
                }`}
              >
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-sm text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 text-xs">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-md font-bold text-[11px] border border-indigo-200 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {user.authority}
              </span>
              {user.cluster && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[11px] border border-amber-200 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {user.cluster}
                </span>
              )}
            </div>
          </div>


          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center cursor-pointer"
            >
              Batal / Tetap di Sini
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              <span>Ya, Keluar Akun</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
