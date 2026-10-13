import React, { useState } from 'react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry, generateOutreachWhatsAppUrl, generateOutreachTextMessage, MemberAnnualExpiryInfo } from '../lib/expiryUtils';
import { formatIDR } from '../lib/storage';
import { 
  X, 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Copy, 
  Check, 
  Calendar, 
  CreditCard, 
  User, 
  Home, 
  ShieldAlert,
  Send,
  Clock,
  ExternalLink
} from 'lucide-react';

interface EarlyOutreachModalProps {
  isOpen: boolean;
  member: Member | null;
  payments: Payment[];
  settings: SystemSettings;
  onClose: () => void;
  onSelectMemberForPayment?: (member: Member) => void;
}

export const EarlyOutreachModal: React.FC<EarlyOutreachModalProps> = ({
  isOpen,
  member,
  payments,
  settings,
  onClose,
  onSelectMemberForPayment,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !member) return null;

  const expiryInfo: MemberAnnualExpiryInfo = calculateMemberExpiry(member, payments, new Date(), settings);
  const waUrl = generateOutreachWhatsAppUrl(member, expiryInfo, settings);
  const textMessage = generateOutreachTextMessage(member, expiryInfo, settings);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(textMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePayRenewal = () => {
    if (onSelectMemberForPayment) {
      onSelectMemberForPayment(member);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/30 rounded-xl border border-amber-400/40">
              <AlertTriangle className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                Penjangkauan Warga (Early Outreach)
              </h3>
              <p className="text-xs text-amber-100/90">
                Pemberitahuan masa iuran tahunan yang segera jatuh tempo (≤ 30 Hari)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-amber-800/40 hover:bg-amber-800 text-amber-100 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Member Card Summary */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 bg-amber-200/80 text-amber-900 font-mono font-black text-xs rounded-md">
                  {member.memberNumber}
                </span>
                <h4 className="text-base font-extrabold text-slate-900 mt-1">{member.name}</h4>
                <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>{member.cluster} • {member.address}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-full shadow-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{expiryInfo.daysRemaining > 0 ? `Sisa ${expiryInfo.daysRemaining} Hari` : 'Jatuh Tempo'}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-amber-200/60 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Batas Masa Aktif</span>
                <p className="font-extrabold text-amber-900 mt-0.5">{expiryInfo.expiryDateFormatted}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tarif Iuran Tahunan</span>
                <p className="font-extrabold text-emerald-800 mt-0.5">{formatIDR(settings.annualFeeAmount || 300000)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">No. WhatsApp/HP</span>
                <p className="font-bold text-slate-900 font-mono mt-0.5">{member.phone}</p>
              </div>
            </div>
          </div>

          {/* Outreach Actions & Message Preview */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Template Pesan WhatsApp / SMS Pengingat</span>
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-xs font-bold text-slate-600 hover:text-emerald-700 inline-flex items-center gap-1 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono whitespace-pre-line leading-relaxed border border-slate-800 max-h-48 overflow-y-auto">
              {textMessage}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-900/20 text-center"
            >
              <Send className="w-4 h-4" />
              <span>Kirim Pengingat via WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-75" />
            </a>

            <button
              type="button"
              onClick={handlePayRenewal}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Input Iuran Perpanjangan</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center italic">
            💡 Early outreach membantu warga melakukan perpanjangan tepat waktu sehingga manfaat santunan tidak terputus.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
