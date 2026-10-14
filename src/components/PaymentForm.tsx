import React, { useState, useEffect, useMemo } from 'react';
import { Member, Payment, SystemSettings, PaymentType, PaymentMethod, AppUser } from '../types';
import { formatIDR, getMemberForUser } from '../lib/storage';
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
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  members,
  settings,
  activeUser,
  selectedMemberForPayment,
  onAddPayment,
  onNavigateToValidation,
  onNavigateToVerification,
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

  const [memberId, setMemberId] = useState(() => {
    if (selectedMemberForPayment) return selectedMemberForPayment.id;
    if (myLinkedMember) return myLinkedMember.id;
    return selectableMembers[0]?.id || '';
  });
  const [paymentType, setPaymentType] = useState<PaymentType>('Iuran Tahunan');
  const [periodMonth, setPeriodMonth] = useState('Tahun 2026');
  const [amount, setAmount] = useState<number>(settings.annualFeeAmount || 300000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Transfer BCA');
  
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
    } else if (paymentType === 'Iuran Pendaftaran') {
      setAmount(settings.registrationFeeAmount || 50000);
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Title Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-emerald-600" />
          <span>Pembayaran Iuran & Upload Bukti Transfer</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Lakukan pembayaran iuran bulanan atau pendaftaran dan unggah bukti transfer untuk diverifikasi oleh admin/pengurus.
        </p>
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
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
            >
              + Buat Pembayaran Lain
            </button>
            {onNavigateToValidation && !isAnggota && (
              <button
                onClick={onNavigateToValidation}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-colors shadow-md shadow-indigo-900/20 inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Buka Panel Validasi Admin (Uji Coba)</span>
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
                  <div className="relative">
                    {isKetuaRt && userRtCluster && (
                      <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 flex items-center justify-between">
                        <span>Pilihan Warga: Lingkungan RT {userRtCluster}</span>
                        <span className="font-extrabold text-[11px] text-amber-950">({selectableMembers.length} Terdaftar)</span>
                      </div>
                    )}
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                    >
                      {selectableMembers.map((m) => {
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
                      })}
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
                    <option value="Iuran Pendaftaran">Iuran Pendaftaran Anggota</option>
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
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-slate-400 font-semibold">Pilih Cepat:</span>
                      {['Tahun 2026', 'Tahun 2027', 'Tahun 2025'].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setPeriodMonth(yr)}
                          className={`px-2 py-0.5 rounded border transition-colors ${
                            periodMonth === yr 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' 
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
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

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['Transfer BCA', 'Transfer Mandiri', 'Transfer BRI', 'QRIS', 'Tunai'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left ${
                        paymentMethod === method
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
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
                {settings.bankAccounts.map((bank, idx) => (
                  <div key={idx} className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-emerald-400 font-bold">
                      <span>{bank.bankName}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Official</span>
                    </div>
                    <p className="text-base font-black text-white tracking-wider">{bank.accountNumber}</p>
                    <p className="text-[10px] text-slate-400">a.n. {bank.accountHolder}</p>
                  </div>
                ))}
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
