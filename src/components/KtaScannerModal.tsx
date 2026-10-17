import React, { useState } from 'react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { formatIDR } from '../lib/storage';
import {
  X,
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  ShieldCheck,
  HeartHandshake,
  Calendar,
  Home,
  UserCheck,
  CreditCard,
  ArrowRight
} from 'lucide-react';

interface KtaScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  payments: Payment[];
  settings: SystemSettings;
  onOpenKtaModal?: (member: Member) => void;
  onSelectMember?: (member: Member) => void;
  onSelectMemberForPayment?: (member: Member) => void;
}

export const KtaScannerModal: React.FC<KtaScannerModalProps> = ({
  isOpen,
  onClose,
  members,
  payments,
  settings,
  onOpenKtaModal,
  onSelectMember,
  onSelectMemberForPayment,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [rawQrInput, setRawQrInput] = useState('');

  // Handle manual search or QR Code text parsing
  const handleProcessInput = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Check if Receipt Verification URL or number
    if (trimmed.includes('verify=receipt') || trimmed.includes('receiptNumber=')) {
      const match = trimmed.match(/(?:receiptNumber|receipt|no)=([^&]+)/i);
      const receiptNo = match ? decodeURIComponent(match[1]) : '';
      if (receiptNo) {
        window.location.search = `?verify=receipt&receiptNumber=${encodeURIComponent(receiptNo)}`;
        return;
      }
    }

    // Check if JSON payload from QR Code
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const match = members.find(
          (m) =>
            (parsed.npa && m.memberNumber.toLowerCase() === parsed.npa.toLowerCase()) ||
            (parsed.nik && m.nik === parsed.nik) ||
            (parsed.name && m.name.toLowerCase() === parsed.name.toLowerCase())
        );
        if (match) {
          setSelectedMember(match);
          return;
        }
      } catch (e) {
        // Fallback to normal string match
      }
    }

    // Direct search by NPA, NIK, or Name
    const found = members.find(
      (m) =>
        m.memberNumber.toLowerCase() === trimmed.toLowerCase() ||
        m.nik.toLowerCase() === trimmed.toLowerCase() ||
        m.name.toLowerCase().includes(trimmed.toLowerCase())
    );

    setSelectedMember(found || null);
  };

  const currentMember = selectedMember;
  const expiry = currentMember ? calculateMemberExpiry(currentMember, payments, new Date(), settings) : null;
  const memberPayments = currentMember
    ? payments.filter((p) => p.memberId === currentMember.id || p.memberNumber === currentMember.memberNumber)
    : [];
  const verifiedPayments = memberPayments.filter((p) => p.status === 'Verified');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Verifikasi & Cek Keaslian KTA</h3>
              <p className="text-xs text-slate-400">
                Pindai QR Code atau cari nomor anggota (NPA) warga
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search / Scan Input Bar */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleProcessInput(e.target.value);
              }}
              placeholder="Ketik No. Anggota (e.g. ADK-001) / NIK / Nama Warga..."
              className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-300 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
              autoFocus
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          {/* Quick Member Preset Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500">Contoh Cek:</span>
            {members.slice(0, 4).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSearchQuery(m.memberNumber);
                  setSelectedMember(m);
                }}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-emerald-300 transition-all font-mono"
              >
                {m.memberNumber} ({m.name.split(' ')[0]})
              </button>
            ))}
          </div>
        </div>

        {/* Result Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!currentMember ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 space-y-2">
              <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Belum Ada Anggota Dipilih</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Silakan ketik nomor anggota (NPA), NIK warga, atau tempelkan data hasil scan QR Code untuk memvalidasi hak santunan pemakaman.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Member Card Result */}
              <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500/30 shadow-md space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-lg flex items-center justify-center font-mono shrink-0 border border-emerald-200">
                      {currentMember.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-base">{currentMember.name}</h4>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full font-mono">
                          {currentMember.memberNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        NIK: {currentMember.nik} • {currentMember.cluster || 'Cluster'}
                      </p>
                    </div>
                  </div>

                  {expiry?.isExpired ? (
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-extrabold rounded-full flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Jatuh Tempo</span>
                    </span>
                  ) : currentMember.status === 'Aktif' ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Valid & Terdaftar</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-extrabold rounded-full flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{currentMember.status}</span>
                    </span>
                  )}
                </div>

                {/* Grid Verification Info */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Status Iuran Kas:</span>
                    <span className="font-bold text-slate-900">{expiry?.statusLabel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Masa Berlaku Iuran:</span>
                    <span className="font-mono font-bold text-emerald-700">{expiry?.expiryDateFormatted}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Verifikasi RT:</span>
                    <span className="font-medium text-slate-800">{currentMember.verifiedByRt || `Ketua RT ${currentMember.cluster}`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Tanggungan Dilindungi:</span>
                    <span className="font-bold text-slate-900">{currentMember.dependentsCount + 1} Jiwa Total</span>
                  </div>
                </div>

                {/* Covered Dependents */}
                {currentMember.dependentsList && currentMember.dependentsList.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Daftar Tanggungan Sah ({currentMember.dependentsList.length} Jiwa):</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentMember.dependentsList.map((dep, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200">
                          {dep.name} <span className="text-emerald-700 font-mono text-[10px]">({dep.relationship})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {onOpenKtaModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenKtaModal(currentMember);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Buka KTA Digital & QR Code Lengkap</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {onSelectMember && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMember(currentMember);
                      }}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-slate-600" />
                      <span>Lihat Profil Warga</span>
                    </button>
                  )}

                  {onSelectMemberForPayment && currentMember.status === 'Aktif' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMemberForPayment(currentMember);
                      }}
                      className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Bayar Iuran Kas</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Sistem Verifikasi KTA • {settings.communityName}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
