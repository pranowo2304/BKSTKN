import React, { useState, useEffect } from 'react';
import { AppUser, Member, SystemSettings } from '../types';
import {
  getAdminContacts,
  AdminContact,
  MessageTopic,
  buildAdminContactMessage,
  createAdminWhatsAppUrl,
} from '../lib/contactAdminUtils';
import {
  X,
  Send,
  Phone,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  UserCheck,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  HeartHandshake,
  CreditCard,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface ContactAdminModalProps {
  users?: AppUser[];
  member: Member | null | undefined;
  settings?: SystemSettings;
  isOpen: boolean;
  onClose: () => void;
  defaultAdminRole?: 'Admin' | 'Bendahara' | 'RT';
  defaultTopic?: MessageTopic;
}

export const ContactAdminModal: React.FC<ContactAdminModalProps> = ({
  users = [],
  member,
  settings,
  isOpen,
  onClose,
  defaultAdminRole,
  defaultTopic = 'iuran',
}) => {
  const adminContacts = getAdminContacts(users, settings, member?.cluster);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [topic, setTopic] = useState<MessageTopic>(defaultTopic);
  const [customNote, setCustomNote] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (adminContacts.length > 0) {
      if (defaultAdminRole === 'Bendahara') {
        const bendahara = adminContacts.find((c) => c.authority === 'Bendahara');
        if (bendahara) setSelectedAdminId(bendahara.id);
        else setSelectedAdminId(adminContacts[0].id);
      } else if (defaultAdminRole === 'RT') {
        const rt = adminContacts.find((c) => c.authority === 'Ketua RT (Cluster)');
        if (rt) setSelectedAdminId(rt.id);
        else setSelectedAdminId(adminContacts[0].id);
      } else if (!selectedAdminId) {
        setSelectedAdminId(adminContacts[0].id);
      }
    }
  }, [isOpen, defaultAdminRole, adminContacts.length]);

  if (!isOpen) return null;

  const fallbackPhone = settings?.treasurerPhone || '0812-3456-7890';
  const currentAdmin =
    adminContacts.find((c) => c.id === selectedAdminId) ||
    adminContacts[0] || {
      id: 'fallback',
      name: 'Admin Paguyuban',
      role: 'Pengurus Kas Kematian',
      authority: 'Admin',
      phone: fallbackPhone,
      cleanPhone: fallbackPhone.replace(/[^0-9]/g, '') || '6281234567890',
      displayPhone: fallbackPhone,
      description: 'Layanan administrasi',
    };

  const previewMessage = buildAdminContactMessage(
    topic,
    member,
    currentAdmin,
    customNote,
    settings
  );

  const handleSendWhatsApp = () => {
    const waUrl = createAdminWhatsAppUrl(currentAdmin.phone, previewMessage);
    setSendSuccess(true);
    setTimeout(() => {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }, 150);
    setTimeout(() => {
      setSendSuccess(false);
    }, 3000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(previewMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const topicOptions: { id: MessageTopic; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'iuran',
      label: 'Konfirmasi / Info Iuran',
      icon: <CreditCard className="w-3.5 h-3.5" />,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    },
    {
      id: 'duka',
      label: 'Laporan Duka / Santunan',
      icon: <HeartHandshake className="w-3.5 h-3.5" />,
      color: 'bg-rose-50 text-rose-800 border-rose-300',
    },
    {
      id: 'keluarga',
      label: 'Data Tanggungan Keluarga',
      icon: <Users className="w-3.5 h-3.5" />,
      color: 'bg-blue-50 text-blue-800 border-blue-300',
    },
    {
      id: 'verifikasi',
      label: 'Status Akun / Domisili',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      color: 'bg-amber-50 text-amber-800 border-amber-300',
    },
    {
      id: 'umum',
      label: 'Pertanyaan Umum / Lainnya',
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      color: 'bg-slate-100 text-slate-800 border-slate-300',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-6">
        
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center border border-emerald-700 shadow-inner">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Hubungi Admin & Pengurus via WhatsApp
              </h3>
              <p className="text-[11px] text-emerald-300/80">
                Pesan otomatis terhubung langsung ke nomor WhatsApp pengurus resmi paguyuban.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Identity Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Pengirim (Anggota):</span>
            <strong className="text-slate-900">{member?.name || 'Warga Paguyuban'}</strong>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono text-[10px] rounded font-bold">
              {member?.memberNumber || '-'}
            </span>
            {member?.cluster && (
              <span className="hidden sm:inline-block text-[11px] text-emerald-700 font-semibold">
                • {member.cluster}
              </span>
            )}
          </div>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
            Otomatis
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* STEP 1: Select Admin Destination */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              1. Pilih Pengurus / Admin Tujuan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {adminContacts.map((contact) => {
                const isSelected = contact.id === selectedAdminId;
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedAdminId(contact.id)}
                    className={`text-left p-3 rounded-xl border transition-all relative ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full ${
                          contact.avatarColor || 'bg-slate-700'
                        } text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-xs text-slate-900 truncate">
                            {contact.name}
                          </p>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-700 font-semibold truncate">
                          {contact.role}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-slate-400" />
                          <span>{contact.displayPhone}</span>
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Choose Topic / Template */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              2. Pilih Keperluan / Topik Pesan
            </label>
            <div className="flex flex-wrap gap-2">
              {topicOptions.map((opt) => {
                const isSelected = topic === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTopic(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? `${opt.color} ring-2 ring-emerald-500/20 shadow-2xs font-extrabold`
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Optional Details / Custom Note */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              3. Catatan / Rincian Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder={
                topic === 'iuran'
                  ? 'Contoh: Saya sudah transfer iuran tahun 2026 sebesar Rp 300.000 via m-BCA tadi pagi.'
                  : topic === 'duka'
                  ? 'Contoh: Telah berpulang Ayahanda Bpk. Sastro di RSUD tadi siang jam 11:30.'
                  : topic === 'keluarga'
                  ? 'Contoh: Ingin menambahkan anak ke-3 bernama Ahmad (usia 2 tahun).'
                  : 'Tuliskan pesan atau pertanyaan Anda di sini...'
              }
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* STEP 4: Live Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pratinjau Format Pesan Otomatis:</span>
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>Salin Format</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800 selection:bg-emerald-500 selection:text-white">
              {previewMessage}
            </div>
          </div>

        </div>

        {/* Footer Action */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Kirim ke: <strong className="text-slate-900">{currentAdmin.name}</strong> ({currentAdmin.displayPhone})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 bg-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-950/20 inline-flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Buka WhatsApp Sekarang</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
