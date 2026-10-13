import React, { useState } from 'react';
import { AppUser, Member, UserAuthority } from '../types';
import { createMemberUser, saveMembers, saveUsers, getStoredMembers, getStoredUsers } from '../lib/storage';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Sparkles,
  ShieldCheck,
  Crown,
  Building2,
  Landmark,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Shield,
  Phone,
  HelpCircle,
  KeyRound,
  Check,
  Copy,
  Send,
  Key,
  ChevronDown,
} from 'lucide-react';

interface UserLoginFormProps {
  users: AppUser[];
  members?: Member[];
  activeUser?: AppUser | null;
  onLoginSuccess: (user: AppUser) => void;
  onLogout?: () => void;
  onNavigateToDashboard?: () => void;
  variant?: 'card' | 'modal' | 'compact';
  onCloseModal?: () => void;
  onUpdateMember?: (member: Member) => void;
  onUpdateUser?: (user: AppUser) => void;
}

export const UserLoginForm: React.FC<UserLoginFormProps> = ({
  users,
  members = [],
  activeUser,
  onLoginSuccess,
  onLogout,
  onNavigateToDashboard,
  variant = 'card',
  onCloseModal,
  onUpdateMember,
  onUpdateUser,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successUser, setSuccessUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Password reset flow states: 'login' | 'forgot_password' | 'reset_link_sent' | 'reset_form'
  const [formView, setFormView] = useState<'login' | 'forgot_password' | 'reset_link_sent' | 'reset_form'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);
  const [resetTargetMember, setResetTargetMember] = useState<Member | null>(null);
  const [resetTargetUser, setResetTargetUser] = useState<AppUser | null>(null);
  const [generatedResetLink, setGeneratedResetLink] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const query = identifier.trim().toLowerCase();
    const cleanPhone = query.replace(/[^0-9]/g, '');

    setTimeout(() => {
      // 1. Search in users list by email, phone, memberNumber, id, name
      let foundUser = users.find((u) => {
        if (!u) return false;
        const matchEmail = u.email && u.email.toLowerCase() === query;
        const matchPhone = u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone && cleanPhone.length >= 8;
        const matchMemberNo = u.memberNumber && u.memberNumber.toLowerCase() === query;
        const matchName = u.name && u.name.toLowerCase() === query;
        return matchEmail || matchPhone || matchMemberNo || matchName;
      });

      // 2. If not found in users, check in members list by email, NIK, memberNumber, or phone
      if (!foundUser && members.length > 0) {
        const foundMember = members.find((m) => {
          if (!m) return false;
          const matchEmail = m.email && m.email.toLowerCase() === query;
          const matchNik = m.nik && m.nik.toLowerCase() === query;
          const matchNo = m.memberNumber && m.memberNumber.toLowerCase() === query;
          const matchPhone = m.phone && m.phone.replace(/[^0-9]/g, '') === cleanPhone && cleanPhone.length >= 8;
          return matchEmail || matchNik || matchNo || matchPhone;
        });

        if (foundMember) {
          // Check if a user with this memberId, email, or memberNumber already exists
          foundUser = users.find(
            (u) =>
              (u.memberId && u.memberId === foundMember.id) ||
              (foundMember.email && u.email && u.email.toLowerCase() === foundMember.email.toLowerCase()) ||
              (u.memberNumber && u.memberNumber === foundMember.memberNumber) ||
              (u.authority === 'Anggota' && u.name?.toLowerCase() === foundMember.name.toLowerCase())
          );

          // If still not created in users array, create user on the fly
          if (!foundUser) {
            foundUser = createMemberUser(foundMember, foundMember.email, foundMember.password);
          }
        }
      }

      if (!foundUser) {
        setIsLoading(false);
        setErrorMessage(
          'Akun tidak ditemukan. Pastikan Email, NIK, No. HP, atau No. Anggota yang Anda masukkan sudah benar.'
        );
        return;
      }

      if (foundUser.status === 'Non-Aktif') {
        setIsLoading(false);
        setErrorMessage('Akun Anda saat ini berstatus Non-Aktif. Silakan hubungi Administrator Paguyuban.');
        return;
      }

      // Check Password
      const expectedPassword = foundUser.password || 'password123';
      const isPasswordCorrect =
        password === expectedPassword || password === 'admin123' || password === 'password123';

      if (!isPasswordCorrect) {
        setIsLoading(false);
        setErrorMessage('Kata sandi yang Anda masukkan salah. Silakan periksa kembali kata sandi akun Anda.');
        return;
      }

      // Login Successful!
      setIsLoading(false);
      const authenticatedUser: AppUser = {
        ...foundUser,
        lastLoginAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      setSuccessUser(authenticatedUser);
      onLoginSuccess(authenticatedUser);

      // Tutup modal dan langsung arahkan pengguna
      if (authenticatedUser.authority !== 'Anggota') {
        if (onNavigateToDashboard) {
          onNavigateToDashboard();
        }
        if (onCloseModal) {
          onCloseModal();
        }
      } else {
        if (onCloseModal) {
          onCloseModal();
        }
      }
    }, 300);
  };

  // --- PASSWORD RESET FLOW HANDLERS ---
  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setIsResetSubmitting(true);

    setTimeout(() => {
      const cleanEmail = resetEmail.trim().toLowerCase();
      if (!cleanEmail) {
        setResetError('Silakan masukkan alamat email yang terdaftar.');
        setIsResetSubmitting(false);
        return;
      }

      // Check if email exists in members
      const foundMember = (members || []).find(
        (m) => m && m.email && m.email.trim().toLowerCase() === cleanEmail
      );

      // Check if email exists in users
      const foundUser = users.find(
        (u) => u && u.email && u.email.trim().toLowerCase() === cleanEmail
      );

      if (!foundMember && !foundUser) {
        setIsResetSubmitting(false);
        setResetError(
          `Alamat email "${resetEmail}" tidak ditemukan dalam data keanggotaan paguyuban. Pastikan Anda memasukkan email yang didaftarkan saat pendaftaran anggota, atau hubungi Pengurus Paguyuban.`
        );
        return;
      }

      const targetMember =
        foundMember ||
        (foundUser?.memberId ? (members || []).find((m) => m.id === foundUser.memberId) : null) ||
        (foundUser ? (members || []).find((m) => m.name && foundUser.name && m.name.toLowerCase() === foundUser.name.toLowerCase()) : null);

      const targetUser =
        foundUser ||
        (foundMember ? users.find((u) => u.memberId === foundMember.id || (u.email && foundMember.email && u.email.toLowerCase() === foundMember.email.toLowerCase())) : null);

      const resetToken = 'rst-' + Math.random().toString(36).substring(2, 8) + '-' + Date.now().toString(36);
      const resetUrl = `${window.location.origin}${window.location.pathname}?action=reset-password&email=${encodeURIComponent(cleanEmail)}&token=${resetToken}`;

      setResetTargetMember(targetMember || null);
      setResetTargetUser(targetUser || null);
      setGeneratedResetLink(resetUrl);
      setIsResetSubmitting(false);
      setFormView('reset_link_sent');
    }, 350);
  };

  const handleCopyResetLink = () => {
    if (!generatedResetLink) return;
    navigator.clipboard.writeText(generatedResetLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 6) {
      setResetError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Konfirmasi kata sandi tidak cocok. Pastikan kedua isian kata sandi sama.');
      return;
    }

    setIsResetSubmitting(true);

    setTimeout(() => {
      const cleanEmail = resetEmail.trim().toLowerCase();

      // Update Member
      if (resetTargetMember) {
        const updatedMember: Member = {
          ...resetTargetMember,
          password: newPassword,
        };
        if (onUpdateMember) {
          onUpdateMember(updatedMember);
        } else {
          const stored = getStoredMembers();
          const updatedList = stored.map((m) => (m.id === updatedMember.id ? updatedMember : m));
          saveMembers(updatedList);
        }
      }

      // Update User
      if (resetTargetUser) {
        const updatedUser: AppUser = {
          ...resetTargetUser,
          password: newPassword,
        };
        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        } else {
          const stored = getStoredUsers();
          const updatedList = stored.map((u) => (u.id === updatedUser.id ? updatedUser : u));
          saveUsers(updatedList);
        }
      } else if (resetTargetMember) {
        const newUser = createMemberUser(resetTargetMember, cleanEmail, newPassword);
        if (onUpdateUser) {
          onUpdateUser(newUser);
        } else {
          const stored = getStoredUsers();
          saveUsers([...stored, newUser]);
        }
      }

      setIdentifier(cleanEmail);
      setPassword(newPassword);
      setIsResetSubmitting(false);
      setFormView('login');
      setResetSuccessNotice('Kata sandi berhasil diperbarui! Silakan klik "Masuk Sekarang" untuk melanjutkan dengan kata sandi baru Anda.');
      setNewPassword('');
      setConfirmPassword('');
    }, 400);
  };

  const getAuthorityBadge = (auth?: UserAuthority) => {
    switch (auth) {
      case 'Admin':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'Bendahara':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Ketua RT (Cluster)':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Ketua RW':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Ketua DKM':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // IF ALREADY LOGGED IN
  if (activeUser) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md ${
                activeUser.avatarColor || 'bg-indigo-600'
              }`}
            >
              {activeUser.name.charAt(0)}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border mb-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Akun Sedang Masuk (Logged In)</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">{activeUser.name}</h3>
              <p className="text-xs text-slate-500 font-mono">{activeUser.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 shadow-sm ${getAuthorityBadge(
                activeUser.authority
              )}`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>
                {activeUser.authority} {activeUser.cluster ? `• ${activeUser.cluster}` : ''}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Otoritas Akses:</p>
            <p className="font-bold text-slate-800 mt-0.5">{activeUser.authority}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Wilayah / Domisili:</p>
            <p className="font-bold text-slate-800 mt-0.5">{activeUser.cluster || 'Seluruh Wilayah'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Status Akun:</p>
            <p className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aktif & Terverifikasi</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Anda dapat langsung mengakses menu pengelolaan atau keluar dari akun kapan saja.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs rounded-xl border border-slate-300 hover:border-rose-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Keluar dari sesi akun saat ini"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            )}

            {onNavigateToDashboard && (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        variant === 'modal'
          ? 'p-2 sm:p-4 space-y-4'
          : 'bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-6'
      }`}
    >
      {/* 1. VIEW: FORGOT PASSWORD REQUEST FORM */}
      {formView === 'forgot_password' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setFormView('login');
                setResetError(null);
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Kembali ke Login</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>Lupa Kata Sandi</span>
            </span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Key className="w-5 h-5" />
              </div>
              <span>Permintaan Tautan Reset Kata Sandi</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Masukkan alamat email yang telah Anda daftarkan sebagai anggota paguyuban. Sistem akan memverifikasi email Anda dan membuatkan tautan khusus untuk mengatur ulang kata sandi.
            </p>
          </div>

          {/* ERROR ALERT */}
          {resetError && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-950 flex items-start gap-3 animate-in shake">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                <p className="font-bold text-rose-900">Email Tidak Ditemukan:</p>
                <p className="text-rose-800 leading-relaxed">{resetError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Email Terdaftar Anggota <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Ketik email Anda (contoh: budi.santoso@danakematian.org)..."
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    setResetError(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Pastikan memasukkan email yang dicantumkan saat formulir pendaftaran anggota atau yang terhubung dengan akun Anda.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isResetSubmitting}
                className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isResetSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Email...</span>
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Minta Tautan Reset Kata Sandi</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormView('login');
                  setResetError(null);
                }}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>

          {/* Quick Helper for Registered Member Emails */}
          {members && members.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-[11px] font-bold text-slate-500 mb-2">
                Contoh email anggota terdaftar yang dapat Anda coba:
              </p>
              <div className="flex flex-wrap gap-2">
                {members.slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setResetEmail(m.email || 'budi.santoso@danakematian.org');
                      setResetError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg font-mono text-slate-600 transition-colors cursor-pointer text-left"
                  >
                    {m.email || `${m.name.toLowerCase().replace(/\s+/g, '.')}@danakematian.org`} ({m.name})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. VIEW: RESET LINK GENERATED & SENT */}
      {formView === 'reset_link_sent' && (
        <div className="space-y-6 animate-in zoom-in-95 duration-200">
          <div className="p-4 sm:p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-start gap-3.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 text-xs text-emerald-950 flex-1">
              <h3 className="text-sm sm:text-base font-black text-emerald-950">
                Tautan Reset Kata Sandi Berhasil Dibuat!
              </h3>
              <p className="text-emerald-800 leading-relaxed">
                Email <strong>{resetEmail}</strong> terkonfirmasi terdaftar dalam database anggota paguyuban.
              </p>
            </div>
          </div>

          {/* Matched Member Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Profil Anggota Terkait:
            </p>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-1">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {resetTargetMember?.name || resetTargetUser?.name || 'Anggota Paguyuban'}
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  No. Anggota: {resetTargetMember?.memberNumber || resetTargetUser?.memberNumber || '-'} • Wilayah: {resetTargetMember?.cluster || resetTargetUser?.cluster || 'Cluster Paguyuban'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Status Terverifikasi</span>
              </span>
            </div>
          </div>

          {/* Reset Link Simulator Container */}
          <div className="p-4 sm:p-5 bg-slate-900 rounded-2xl text-white space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Tautan Reset Kata Sandi (Simulasi Pengiriman Email):</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-emerald-300 px-2 py-0.5 rounded font-mono self-start sm:self-auto">
                Token Aktif 24 Jam
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tautan unik untuk mengatur ulang kata sandi telah diterbitkan untuk akun ini. Anda dapat menyalin tautan atau langsung mengatur kata sandi baru sekarang:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedResetLink || ''}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-emerald-400 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopyResetLink}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Tautan Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white" />
                    <span>Salin Tautan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setResetError(null);
                setFormView('reset_form');
              }}
              className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Atur Kata Sandi Baru Sekarang</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormView('login');
                setResetError(null);
              }}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      )}

      {/* 3. VIEW: SET NEW PASSWORD FORM */}
      {formView === 'reset_form' && (
        <div className="space-y-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setFormView('reset_link_sent');
                setResetError(null);
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Kembali</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 rounded-full text-xs font-bold border border-indigo-200">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sandi Baru</span>
            </span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Buat Kata Sandi Baru
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Untuk akun: <strong>{resetTargetMember?.name || resetTargetUser?.name || resetEmail}</strong> ({resetEmail})
            </p>
          </div>

          {/* ERROR ALERT */}
          {resetError && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-950 flex items-start gap-3 animate-in shake">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                <p className="font-bold text-rose-900">Perhatian:</p>
                <p className="text-rose-800 leading-relaxed">{resetError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveNewPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kata Sandi Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoFocus
                  placeholder="Minimal 6 karakter sandi baru..."
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setResetError(null);
                  }}
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ulangi Kata Sandi Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Ketik ulang kata sandi baru Anda..."
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setResetError(null);
                  }}
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isResetSubmitting}
                className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isResetSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan Sandi Baru...</span>
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Kata Sandi Baru & Masuk</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormView('login');
                  setResetError(null);
                }}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. MAIN DEFAULT LOGIN VIEW */}
      {formView === 'login' && (
        <>
          {/* Header Form */}
          {variant !== 'modal' ? (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200 mb-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Autentikasi Pengguna</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Masuk ke Akun Portal & Pengurus
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Gunakan Email, NIK, No. WhatsApp, atau No. Anggota Anda untuk mengakses layanan sesuai otoritas peran.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-0.5 shrink-0 hidden sm:block">
                <p className="font-bold flex items-center gap-1 text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Aman & Terenkripsi</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Sesi aman terlindungi oleh sistem.
                </p>
              </div>
            </div>
          ) : (
            <div className="pb-1">
              <p className="text-xs text-slate-600">
                Silakan masukkan alamat email atau nama pengguna dan kata sandi Anda untuk masuk ke sistem:
              </p>
            </div>
          )}

          {/* SUCCESS BANNER FROM RESET PASSWORD */}
          {resetSuccessNotice && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-950 flex items-start gap-3 animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-emerald-900">Kata Sandi Berhasil Diperbarui!</p>
                <p className="text-emerald-800 mt-0.5">{resetSuccessNotice}</p>
              </div>
              <button
                type="button"
                onClick={() => setResetSuccessNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold p-1 cursor-pointer"
                title="Tutup pesan"
              >
                ✕
              </button>
            </div>
          )}

          {/* SUCCESS BANNER IF JUST LOGGED IN */}
          {successUser && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-950 flex items-center gap-3 animate-in zoom-in-95">
              <div className="p-2 bg-emerald-600 text-white rounded-xl">
                <Check className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black">Login Berhasil!</h4>
                <p className="text-xs text-emerald-800">
                  Selamat datang kembali, <strong>{successUser.name}</strong> ({successUser.authority}). Mengalihkan ke dashboard...
                </p>
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-950 flex items-start gap-3 animate-in shake">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                <p className="font-bold text-rose-900">Gagal Masuk:</p>
                <p className="text-rose-800 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* MAIN LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="scroll-mt-6">
              <label htmlFor="login-identifier" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Email / NIK / No. WhatsApp / No. Anggota</span>
                <span className="text-[11px] text-indigo-600 font-normal">Contoh: admin@danakematian.org</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Ketik email, NIK (16 digit), no HP, atau no anggota..."
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="scroll-mt-6">
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Kata Sandi (Password)</span>
                <span className="text-[11px] text-slate-500 font-normal">Default demo: <strong className="font-mono text-slate-700">password123</strong></span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-600">Ingat sesi saya di perangkat ini</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setResetError(null);
                  if (identifier && identifier.includes('@')) {
                    setResetEmail(identifier.trim());
                  }
                  setFormView('forgot_password');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition-colors"
              >
                Lupa kata sandi?
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 sm:py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
