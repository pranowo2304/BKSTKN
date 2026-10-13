import React, { useEffect } from 'react';
import { AppUser, Member } from '../types';
import { UserLoginForm } from './UserLoginForm';
import { AppIcon } from './AppIcon';
import { X, ShieldCheck } from 'lucide-react';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  members?: Member[];
  activeUser?: AppUser | null;
  onLoginSuccess: (user: AppUser) => void;
  onLogout?: () => void;
  onNavigateToDashboard?: () => void;
  onUpdateMember?: (member: Member) => void;
  onUpdateUser?: (user: AppUser) => void;
}

export const UserLoginModal: React.FC<UserLoginModalProps> = ({
  isOpen,
  onClose,
  users,
  members = [],
  activeUser,
  onLoginSuccess,
  onLogout,
  onNavigateToDashboard,
  onUpdateMember,
  onUpdateUser,
}) => {
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center p-3 sm:p-6 py-4 sm:py-8 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl my-auto bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-login-title"
      >
        {/* Modal Top Navigation Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <AppIcon size={34} className="rounded-xl shadow-md shadow-emerald-950/20 shrink-0" />
            <div>
              <h2 id="modal-login-title" className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                Masuk ke Akun Portal
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Autentikasi warga & pengurus paguyuban
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Sesi Aman</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 bg-white hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors shadow-xs cursor-pointer"
              title="Tutup jendela login (Esc)"
              aria-label="Tutup jendela login"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body Container */}
        <div className="overflow-y-auto flex-1 overscroll-contain p-2 sm:p-4">
          <UserLoginForm
            users={users}
            members={members}
            activeUser={activeUser}
            onLoginSuccess={(user) => {
              onLoginSuccess(user);
            }}
            onLogout={onLogout}
            onNavigateToDashboard={onNavigateToDashboard}
            variant="modal"
            onCloseModal={onClose}
            onUpdateMember={onUpdateMember}
            onUpdateUser={onUpdateUser}
          />
        </div>
      </div>
    </div>
  );
};

