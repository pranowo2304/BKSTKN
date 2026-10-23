import React, { useState, useEffect, useMemo } from 'react';
import { Member, Payment, SystemSettings, PaymentType, PaymentMethod, AppUser } from '../types';
import { formatIDR, getMemberForUser } from '../lib/storage';
import { getSystemConfiguredPeriod } from '../lib/receiptUtils';
import {
  CreditCard,
  Upload,
  CheckCircle2,
  QrCode,
  Building,
  AlertCircle,
  Image as ImageIcon,
  Send,
  Clock,
  ShieldCheck,
  User,
  Check,
  Camera,
  Scan,
  Sparkles,
  Eye,
  Copy,
  Landmark,
  Banknote,
  LayoutDashboard,
} from 'lucide-react';
import { KtaQrScannerModal } from './KtaQrScannerModal';

interface PaymentFormProps {
  members: Member[];
  settings: SystemSettings;
  activeUser?: AppUser;
  selectedMemberForPayment?: Member | null;
  onAddPayment: (payment: Payment) => void;
  onNavigateToValidation?: () => void;
  onNavigateToVerification?: () => void;
  onNavigateToDashboard?: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  members,
  settings,
  activeUser,
  selectedMemberForPayment,
  onAddPayment,
  onNavigateToValidation,
  onNavigateToVerification,
  onNavigateToDashboard,
}) => {
  const isAnggota = activeUser?.authority === 'Anggota';
  const isKetuaRt = activeUser?.authority === 'Ketua RT (Cluster)';
  const isReadOnlyRole = activeUser?.authority === 'Ketua RW' || activeUser?.authority === 'Ketua DKM';
  const userRtCluster = activeUser?.cluster;

  const myLinkedMember = isAnggota ? getMemberForUser(activeUser, members) || members.find(m => m?.name && activeUser?.name && m.name.toLowerCase() === activeUser.name.toLowerCase()) : null;

  const selectableMembers = useMemo(() => {
    if (isKetuaRt && userRtCluster) {
      return members.filter((m) => m.cluster === userRtCluster);
    }
    return members;
  }, [members, isKetuaRt, userRtCluster]);

  const [memberSearch, setMemberSearch] = useState('');
  const filteredSelectableMembers = useMemo(() => {
    if (!memberSearch.trim()) return selectableMembers;
    const q = memberSearch.toLowerCase();
    return selectableMembers.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.nik && m.nik.includes(q)) ||
        (m.memberNumber && m.memberNumber.toLowerCase().includes(q)) ||
        (m.cluster && m.cluster.toLowerCase().includes(q))
    );
  }, [selectableMembers, memberSearch]);

  const [memberId, setMemberId] = useState(() => {
    if (selectedMemberForPayment) return selectedMemberForPayment.id;
    if (myLinkedMember) return myLinkedMember.id;
    return selectableMembers[0]?.id || '';
  });
  const systemPeriod = useMemo(() => getSystemConfiguredPeriod(settings), [settings]);
  const [paymentType, setPaymentType] = useState<PaymentType>('Iuran Tahunan');
  const [periodMonth, setPeriodMonth] = useState(() => systemPeriod);
  const [amount, setAmount] = useState<number>(settings.annualFeeAmount || 300000);

  // Sync default period if settings change
  useEffect(() => {
    if (systemPeriod) {
      setPeriodMonth(systemPeriod);
    }
  }, [systemPeriod]);

  // Dynamic payment methods adjusted to registered bank accounts in system settings
  const paymentMethodOptions = useMemo(() => {
    const list: {
      key: string;
      id: PaymentMethod;
      label: string;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
      isBank: boolean;
      type: 'bank' | 'qris' | 'cash';
    }[] = [];

    const validBanks = (settings?.bankAccounts || []).filter(
      (b) => b && ((b.accountNumber && b.accountNumber.trim().length > 0) || (b.bankName && b.bankName.trim().length > 0))
    );

    if (validBanks.length > 0) {
      validBanks.forEach((acc, idx) => {
        const rawName = acc.bankName?.trim() || '';
        const cleanName = rawName || `Bank ${idx + 1}`;
        const methodId = cleanName.toLowerCase().startsWith('transfer')
          ? cleanName
          : `Transfer ${cleanName}`;
        list.push({
          key: `bank-method-${idx}-${acc.accountNumber || idx}`,
          id: methodId,
          label: methodId,
          bankName: acc.bankName || cleanName,
          accountNumber: acc.accountNumber,
          accountHolder: acc.accountHolder,
          isBank: true,
          type: 'bank',
        });
      });
    } else {
      list.push({
        key: 'default-transfer-bank',
        id: 'Transfer Bank',
        label: 'Transfer Bank',
        isBank: true,
        type: 'bank',
      });
    }

    list.push({
      key: 'method-qris',
      id: 'QRIS',
      label: 'QRIS Paguyuban',
      isBank: false,
      type: 'qris',
    });

    list.push({
      key: 'method-tunai',
      id: 'Tunai',
      label: 'Tunai (Langsung)',
      isBank: false,
      type: 'cash',
    });

    return list;
  }, [settings?.bankAccounts]);

  const defaultMethod = useMemo(() => {
    return paymentMethodOptions[0]?.id || 'Transfer Bank';
  }, [paymentMethodOptions]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultMethod);
  const [copiedBankAcc, setCopiedBankAcc] = useState<string | null>(null);

  const handleCopyAccount = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedBankAcc(accountNumber);
    setTimeout(() => setCopiedBankAcc(null), 2500);
  };

  // Sync if settings.bankAccounts change
  useEffect(() => {
    if (paymentMethodOptions.length > 0) {
      const exists = paymentMethodOptions.some((opt) => opt.id === paymentMethod);
      if (!exists) {
        setPaymentMethod(paymentMethodOptions[0].id);
      }
    }
  }, [paymentMethodOptions, paymentMethod]);

  const selectedBankInfo = useMemo(() => {
    if (!settings?.bankAccounts) return null;
    return settings.bankAccounts.find((acc) => {
      const cleanName = acc.bankName?.trim() || '';
      const methodId = cleanName.toLowerCase().startsWith('transfer') ? cleanName : `Transfer ${cleanName}`;
      return methodId === paymentMethod;
    }) || null;
  }, [settings?.bankAccounts, paymentMethod]);
  
  // Proof upload state
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState<boolean>(false);
  const [submittedPayment, setSubmittedPayment] = useState<Payment | null>(null);

  // KTA QR Scanner State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState<{ memberName: string; npa: string } | null>(null);

  const handleMemberIdentifiedFromQr = (member: Member) => {
    if (isKetuaRt && userRtCluster && member.cluster !== userRtCluster) {
      alert(`Warga "${member.name}" berdomisili di ${member.cluster}. Sebagai Ketua RT ${userRtCluster}, Anda hanya dapat memproses warga di wilayah RT Anda.`);
      return;
    }

    setMemberId(member.id);
    setScanToast({
      memberName: member.name,
      npa: member.memberNumber,
    });
    setTimeout(() => {
      setScanToast(null);
    }, 6000);
  };

  useEffect(() => {
    if (isAnggota && myLinkedMember) {
      setMemberId(myLinkedMember.id);
    } else if (selectedMemberForPayment) {
      setMemberId(selectedMemberForPayment.id);
    } else if (members.length > 0 && !memberId) {
      setMemberId(members[0].id);
    }
  }, [selectedMemberForPayment, members, isAnggota, myLinkedMember]);

  useEffect(() => {
    if (paymentType === 'Iuran Tahunan') {
      setAmount(settings.annualFeeAmount || 300000);
    } else if (paymentType === 'Iuran Bulanan') {
      setAmount(settings.monthlyFeeAmount || 25000);
    }
  }, [paymentType, settings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const activeMember = members.find((m) => m.id === memberId);
  const isPendingVerification = activeMember && (activeMember.status === 'Menunggu Verifikasi RT' || activeMember.verificationStatus === 'Pending');
  const isRejected = activeMember && (activeMember.status === 'Ditolak' || activeMember.verificationStatus === 'Rejected');
  const isDeceased = activeMember && activeMember.status === 'Meninggal';
  const isAwaitingPayment = activeMember && activeMember.status === 'Menunggu Pembayaran';
  const isAwaitingTreasurer = activeMember && activeMember.status === 'Menunggu Validasi Bendahara';
  const isMemberActive = activeMember && activeMember.status === 'Aktif';
  
  // Eligible to pay if verified by RT (Menunggu Pembayaran, Menunggu Validasi Bendahara, or Aktif)
  const isEligibleToPay = activeMember && !isPendingVerification && !isRejected && !isDeceased && (activeMember.verificationStatus === 'Verified' || isAwaitingPayment || isAwaitingTreasurer || isMemberActive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) {
      alert('Pilih anggota terlebih dahulu!');
      return;
    }

    if (!isEligibleToPay) {
      alert(`Pendaftar baru belum dapat melakukan pembayaran!\n\nSesuai alur resmi paguyuban, pendaftar baru bisa melakukan pembayaran setelah verifikasi dari RT (${activeMember.cluster || 'Cluster'}). Mohon tunggu verifikasi dan persetujuan dari Ketua RT.`);
      return;
    }

    if (!proofImage && paymentMethod !== 'Tunai') {
      alert('Mohon unggah bukti transfer / pembayaran terlebih dahulu.');
      return;
    }

    const nextId = 'pay-' + Date.now();
    const nextReceiptNum = `KWT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPayment: Payment = {
      id: nextId,
      receiptNumber: nextReceiptNum,
      memberId: activeMember.id,
      memberName: activeMember.name,
      memberNumber: activeMember.memberNumber,
      paymentType,
      periodMonth,
      amount,
      paymentMethod,
      proofImageUrl: proofImage || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=500&q=80',
      proofFileName: fileName || 'bukti_transfer.jpg',
      status: 'Pending', // Awaiting Admin Validation!
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    onAddPayment(newPayment);
    setSubmittedPayment(newPayment);
    setIsSuccessSubmitted(true);
  };

  const handleResetForm = () => {
    setIsSuccessSubmitted(false);
    setSubmittedPayment(null);
    setProofImage(null);
    setFileName('');
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Title Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200 mb-2">
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            <span>Formulir Pembayaran Iuran Kas Paguyuban</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Pembayaran Iuran & Upload Bukti Transfer</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Lakukan pembayaran iuran bulanan atau pendaftaran dan unggah bukti transfer untuk diverifikasi oleh admin/pengurus.
          </p>
        </div>
        {onNavigateToDashboard && (
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="self-start sm:self-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-600" />
            <span>{activeUser ? (activeUser.authority === 'Anggota' ? 'Ke Portal Warga' : 'Ke Dashboard') : '← Kembali ke Beranda'}</span>
          </button>
        )}
      </div>

      {isReadOnlyRole && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Akses Supervisi & Monitoring:</strong> Anda masuk sebagai <strong>{activeUser?.authority}</strong>. Anda memiliki kewenangan untuk memantau data dan laporan kas tanpa melakukan transaksi pembayaran langsung. Form transaksi dinonaktifkan.
            </span>
          </div>
        </div>
      )}

      {isSuccessSubmitted && submittedPayment ? (
        /* SUCCESS CONFIRMATION PANEL */
        <div className="bg-white rounded-2xl p-8 border-2 border-amber-400 shadow-xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
              KONFIRMASI TERKIRIM — MENUNGGU VALIDASI ADMIN
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-3">
              Pembayaran Berhasil Dikirim!
            </h3>
            <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
              Bukti transfer pembayaran atas nama <strong>{submittedPayment.memberName}</strong> ({submittedPayment.memberNumber}) sebesar <strong className="text-emerald-700 font-mono">{formatIDR(submittedPayment.amount)}</strong> telah tercatat dan sedang diproses verifikasi oleh Admin/Bendahara.
            </p>
          </div>

          {/* Pending Status Box */}
          <div className="max-w-md mx-auto bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Nomor Registrasi Kwitansi:</span>
              <span className="font-bold text-slate-900">{submittedPayment.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jenis Pembayaran:</span>
              <span className="font-medium text-slate-800">{submittedPayment.paymentType} ({submittedPayment.periodMonth})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Metode Bayar:</span>
              <span className="font-medium text-slate-800">{submittedPayment.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status System:</span>
              <span className="font-bold text-amber-600 uppercase">PENDING VERIFIKASI</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            💡 Kwitansi otomatis akan diterbitkan secara instan setelah Admin menyetujui (Approve) bukti pembayaran ini.
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={handleResetForm}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
            >
              + Buat Pembayaran Lain
            </button>
            {onNavigateToValidation && !isAnggota && (
              <button
                onClick={onNavigateToValidation}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-colors shadow-md shadow-indigo-900/20 inline-flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Buka Panel Validasi Admin (Uji Coba)</span>
              </button>
            )}
            {onNavigateToDashboard && (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <span>{activeUser ? (activeUser.authority === 'Anggota' ? 'Ke Portal Warga' : 'Ke Dashboard') : '← Selesai / Ke Beranda'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* PAYMENT FORM & BANK DETAILS GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Select Member / Locked Member Card */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    {isAnggota ? 'Data Diri Anggota Pembayar' : 'Pilih Anggota Bayar'} <span className="text-rose-500">*</span>
                  </label>

                  {/* Scan QR KTA Camera Button */}
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-300 transition-all inline-flex items-center gap-1.5 shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Buka kamera scanner untuk memindai QR Code pada KTA Warga"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Scan QR KTA</span>
                  </button>
                </div>

                {/* Scan Success Notification Banner */}
                {scanToast && (
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 animate-in zoom-in-95 shadow-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        KTA Terdeteksi: <strong>{scanToast.memberName}</strong> ({scanToast.npa})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScanToast(null)}
                      className="text-emerald-700 hover:text-emerald-950 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {isAnggota && activeMember ? (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                        {activeMember.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 leading-tight">{activeMember.name}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          <span className="font-mono font-bold text-emerald-800">{activeMember.memberNumber}</span> • {activeMember.cluster || 'Cluster'}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full border border-emerald-300">
                      Akun Saya
                    </span>
                  </div>
                ) : (
                  <div className="relative space-y-2">
                    {isKetuaRt && userRtCluster && (
                      <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 flex items-center justify-between">
                        <span>Pilihan Warga: Lingkungan RT {userRtCluster}</span>
                        <span className="font-extrabold text-[11px] text-amber-950">({selectableMembers.length} Terdaftar)</span>
                      </div>
                    )}
                    {selectableMembers.length > 5 && (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ketik nama warga, NIK, atau NPA untuk mencari..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                      </div>
                    )}
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                    >
                      {filteredSelectableMembers.length === 0 ? (
                        <option value="" disabled>Warga tidak ditemukan untuk pencarian '{memberSearch}'</option>
                      ) : (
                        filteredSelectableMembers.map((m) => {
                          const isMPending = m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending';
                          const isMRejected = m.status === 'Ditolak' || m.verificationStatus === 'Rejected';
                          const isMAwaitingPay = m.status === 'Menunggu Pembayaran';
                          const isMAwaitingTreas = m.status === 'Menunggu Validasi Bendahara';
                          
                          const labelStatus = isMPending 
                            ? '[⛔ Menunggu RT - Belum Bisa Bayar]' 
                            : isMRejected 
                            ? '[✕ Ditolak RT]' 
                            : isMAwaitingPay 
                            ? '[✓ Disetujui RT - Siap Bayar]'
                            : isMAwaitingTreas 
                            ? '[⏳ Menunggu Validasi Bendahara]'
                            : m.status === 'Aktif' 
                            ? '[✓ Anggota Aktif]' 
                            : `[${m.status}]`;

                          return (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.memberNumber}) • {m.cluster || 'Cluster'} {labelStatus}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                )}

                {activeMember && (
                  <div className="mt-2.5">
                    {isPendingVerification ? (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-950">⛔ Pendaftar Baru Belum Bisa Melakukan Pembayaran</p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              Pendaftar baru bisa melakukan pembayaran setelah verifikasi dari RT. Pendaftaran warga <strong>{activeMember.name}</strong> ({activeMember.cluster || 'Cluster'}) saat ini masih berstatus <em>Menunggu Verifikasi RT</em>.
                            </p>
                          </div>
                        </div>
                        {onNavigateToVerification && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={onNavigateToVerification}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <span>Buka Menu Verifikasi RT</span>
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : isRejected ? (
                      <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-rose-950">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>Pendaftaran Warga Ditolak oleh Ketua RT</span>
                        </p>
                        <p className="text-[11px] text-rose-800">
                          Alasan: "{activeMember.rejectionReason || 'Data domisili/NIK tidak valid'}". Pembayaran iuran tidak dapat diproses.
                        </p>
                      </div>
                    ) : isAwaitingPayment ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold">Pendaftaran Telah Disetujui Ketua RT ({activeMember.verifiedByRt || activeMember.cluster})</span>
                        </div>
                        <p className="text-[11px] text-emerald-800 pl-6">
                          Silakan unggah bukti transfer pembayaran iuran di bawah ini. Pembayaran akan divalidasi oleh Bendahara untuk mengaktifkan status keanggotaan dan menerbitkan KTA Digital resmi.
                        </p>
                      </div>
                    ) : isAwaitingTreasurer ? (
                      <div className="p-3 bg-sky-50 border border-sky-300 rounded-xl text-sky-950 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="font-bold">Bukti Transfer Terkirim — Menunggu Validasi Bendahara</span>
                        </div>
                        <p className="text-[11px] text-sky-800 pl-6">
                          Warga telah mengunggah bukti pembayaran. Setelah divalidasi oleh Bendahara, status anggota otomatis berubah menjadi AKTIF dan KTA Digital resmi akan terbit.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold">Anggota Terverifikasi RT & Aktif ({activeMember.cluster})</span>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-700">NIK: {activeMember.nik}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Type & Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Pembayaran
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                  >
                    <option value="Iuran Tahunan">Iuran Tahunan (1 Tahun Sekali)</option>
                    <option value="Iuran Bulanan">Iuran Bulanan</option>
                    <option value="Iuran Sukarela">Iuran Sukarela / Donasi</option>
                    <option value="Iuran Duka Khusus">Iuran Duka Khusus</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {paymentType === 'Iuran Tahunan' 
                      ? '✓ Masa pertanggungan santunan berlaku 1 tahun (12 bulan).' 
                      : 'Pilih jenis iuran yang akan disetorkan.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Periode Pembayaran (Tahun / Periode)
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Tahun 2026"
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none font-medium"
                    />
                    {settings?.membershipPeriod && (
                      <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Kwitansi resmi akan mencatat periode pembayaran sesuai Pengaturan Sistem: <strong>{systemPeriod}</strong></span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Nominal Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {/* Payment Method - Disesuaikan dengan rekening di pengaturan sistem */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Metode Pembayaran (Sesuai Rekening Sistem)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {(settings.bankAccounts || []).filter(b => b && (b.bankName?.trim() || b.accountNumber?.trim())).length} Rekening Terdaftar
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {paymentMethodOptions.map((opt, idx) => (
                    <button
                      key={`btn-paymethod-${opt.key || idx}-${opt.id}-${idx}`}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-left flex flex-col justify-between gap-1 cursor-pointer ${
                        paymentMethod === opt.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {opt.type === 'bank' ? (
                          <Landmark className={`w-3.5 h-3.5 shrink-0 ${paymentMethod === opt.id ? 'text-emerald-100' : 'text-emerald-600'}`} />
                        ) : opt.type === 'qris' ? (
                          <QrCode className={`w-3.5 h-3.5 shrink-0 ${paymentMethod === opt.id ? 'text-emerald-100' : 'text-slate-600'}`} />
                        ) : (
                          <Banknote className={`w-3.5 h-3.5 shrink-0 ${paymentMethod === opt.id ? 'text-emerald-100' : 'text-amber-600'}`} />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {opt.accountNumber && (
                        <span className={`text-[10px] font-mono truncate ${paymentMethod === opt.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {opt.accountNumber}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Feedback info kartu rekening yang sedang dipilih */}
                {selectedBankInfo && (
                  <div className="mt-3 p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950 shadow-2xs animate-in fade-in duration-200">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                        <Landmark className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Tujuan Transfer: {selectedBankInfo.bankName}</span>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-bold">Resmi</span>
                      </div>
                      <p className="text-sm font-black font-mono tracking-wider text-slate-900">
                        {selectedBankInfo.accountNumber}
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        a.n. <strong className="font-bold">{selectedBankInfo.accountHolder}</strong> • Nominal: <strong className="font-mono text-emerald-900">{formatIDR(amount)}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyAccount(selectedBankInfo.accountNumber)}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto shrink-0 transition-all"
                    >
                      {copiedBankAcc === selectedBankInfo.accountNumber ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Rekening</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {paymentMethod === 'QRIS' && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 text-xs flex items-center gap-3">
                    <QrCode className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900">Pembayaran via QRIS Resmi</p>
                      <p className="text-[11px] text-slate-500">Scan barcode QRIS di balai warga atau gunakan gambar QRIS statis paguyuban lalu upload struk pembayaran.</p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'Tunai' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-center gap-3">
                    <Banknote className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-bold text-amber-900">Pembayaran Tunai (Cash Langsung)</p>
                      <p className="text-[11px] text-amber-800">Serahkan langsung uang tunai kepada Bendahara ({settings.treasurerName || 'Pengurus'}) atau Ketua RT. Upload foto tanda terima / bukti setor.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* UPLOAD BUKTI TRANSFER */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>Upload Foto / Struk Bukti Transfer <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">JPG, PNG, GIF up to 5MB</span>
                </label>

                <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl p-4 text-center transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {proofImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={proofImage} alt="Preview Bukti" className="h-32 object-contain rounded-lg border border-slate-300 shadow-sm" />
                      <p className="text-xs font-semibold text-emerald-700">{fileName || 'Bukti_Transfer_Loaded.jpg'}</p>
                      <span className="text-[10px] text-slate-500">Klik untuk mengganti foto</span>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">Pilih Foto atau Drag & Drop Bukti Transfer</p>
                      <p className="text-[10px] text-slate-400">Pastikan tanggal, nama pengirim, dan nominal terlihat jelas.</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!isEligibleToPay || isReadOnlyRole}
                className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all inline-flex items-center justify-center gap-2 mt-4 ${
                  isEligibleToPay && !isReadOnlyRole
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isReadOnlyRole
                    ? '🔒 Mode Monitoring (Hanya Lihat Laporan)'
                    : isPendingVerification
                    ? '⛔ Menunggu Verifikasi RT (Belum Bisa Bayar)'
                    : isRejected
                    ? '✕ Pendaftaran Ditolak RT (Tidak Dapat Bayar)'
                    : isAwaitingPayment
                    ? 'Kirim Bukti Transfer (Menuju Validasi Bendahara)'
                    : isAwaitingTreasurer
                    ? 'Kirim Tambahan Bukti / Setoran Ulang'
                    : 'Kirim Konfirmasi Pembayaran'}
                </span>
              </button>
            </form>
          </div>

          {/* Destination Account Instructions Info (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <Building className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Rekening Tujuan Pembayaran</h3>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Silakan lakukan transfer sesuai nominal <strong className="text-emerald-400 font-mono text-sm">{formatIDR(amount)}</strong> ke salah satu rekening resmi pengelola:
              </p>

              <div className="space-y-3">
                {(settings.bankAccounts || []).filter(b => b && (b.bankName?.trim() || b.accountNumber?.trim())).map((bank, idx) => {
                  const cleanName = bank.bankName?.trim() || '';
                  const methodId = cleanName.toLowerCase().startsWith('transfer') ? cleanName : `Transfer ${cleanName}`;
                  const isSelected = paymentMethod === methodId;

                  return (
                    <div
                      key={`dest-bank-${idx}-${bank.accountNumber || idx}`}
                      onClick={() => setPaymentMethod(methodId)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer font-mono text-xs ${
                        isSelected
                          ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/50'
                          : 'bg-slate-800/90 border-slate-700 hover:border-slate-500'
                      }`}
                      title={`Klik untuk memilih metode ${methodId}`}
                    >
                      <div className="flex justify-between items-center text-emerald-400 font-bold mb-1">
                        <span className="flex items-center gap-1.5 font-sans">
                          <Landmark className="w-3.5 h-3.5" />
                          {bank.bankName}
                        </span>
                        {isSelected ? (
                          <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-sans font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Metode Dipilih
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase font-sans hover:text-emerald-300">
                            Pilih Rekening
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-black text-white tracking-wider">{bank.accountNumber}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAccount(bank.accountNumber);
                          }}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 text-[10px] font-sans font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors"
                          title="Salin nomor rekening"
                        >
                          {copiedBankAcc === bank.accountNumber ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">a.n. {bank.accountHolder}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-3">
                <QrCode className="w-10 h-10 text-slate-400 shrink-0" />
                <div className="text-[11px] text-slate-400">
                  <p className="font-bold text-slate-200">Pembayaran QRIS</p>
                  <p>Scan barcode QRIS di balai warga atau hubungi pengurus untuk statis QRIS.</p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-950 text-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Alur Sistem Pendaftaran & Pembayaran Iuran:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 pl-1 leading-relaxed text-[11px]">
                <li><strong className="text-slate-900">Warga mendaftar:</strong> Status awal <em>Pending</em> dan belum bisa bayar.</li>
                <li><strong className="text-slate-900">Persetujuan Ketua RT:</strong> Ketua RT memverifikasi data & domisili calon anggota.</li>
                <li><strong className="text-slate-900">Konfirmasi Pembayaran:</strong> Setelah disetujui RT, pendaftar mengunggah bukti transfer iuran.</li>
                <li><strong className="text-slate-900">Validasi Bendahara:</strong> Bendahara mengecek dan memvalidasi mutasi kas masuk.</li>
                <li><strong className="text-slate-900">Anggota Aktif:</strong> Setelah divalidasi Bendahara, status keanggotaan menjadi <em>Aktif</em>.</li>
                <li><strong className="text-slate-900">Penerbitan KTA:</strong> KTA Digital resmi bertanda QR Code Paguyuban otomatis terbit.</li>
                <li><strong className="text-slate-900">Kas Bertambah:</strong> Saldo uang kas masuk bertambah secara otomatis & tercatat di sistem.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* KTA QR SCANNER MODAL */}
      <KtaQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        members={members}
        settings={settings}
        onMemberIdentified={handleMemberIdentifiedFromQr}
      />
    </div>
  );
};
