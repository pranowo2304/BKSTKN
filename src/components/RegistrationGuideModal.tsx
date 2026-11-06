import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';
import { loadLogoAsPngDataUrl } from '../lib/treasurerPdfReport';
import {
  X,
  BookOpen,
  UserPlus,
  Users,
  FileCheck,
  ShieldCheck,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Download,
  CheckCircle2,
  Clock,
  HelpCircle,
  LogIn,
} from 'lucide-react';

interface RegistrationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onStartRegistration?: () => void;
}

export const RegistrationGuideModal: React.FC<RegistrationGuideModalProps> = ({
  isOpen,
  onClose,
  settings,
  onStartRegistration,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!isOpen) return null;

  const orgName = settings?.communityName || 'Paguyuban Dana Kematian';
  const annualFee = formatIDR(settings?.annualFeeAmount || 300000);
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const buildWhatsAppGuideText = () => {
    return `*PANDUAN CARA REGISTRASI ANGGOTA BARU*
*${orgName.toUpperCase()}*
${appUrl ? `🔗 Link Aplikasi: ${appUrl}\n` : ''}
*A. PERSIAPAN SEBELUM MENDAFTAR*
1. Siapkan *KTP Kepala Keluarga* (16 digit NIK).
2. Siapkan *Kartu Keluarga (KK)* asli/jelas untuk difoto atau diunggah (16 digit Nomor KK).
3. Siapkan *Alamat Email aktif* & *Nomor WhatsApp aktif* (digunakan untuk akun login & notifikasi KTA).

*B. LANGKAH-LANGKAH PENGISIAN FORMULIR*
*1. Buka Menu Pendaftaran*
• Buka halaman utama aplikasi, lalu klik menu *"Daftar Warga"* / *"Pendaftaran Anggota Baru"*.

*2. Isi Data Kepala Keluarga (Bagian 1)*
• Isi *Nama Lengkap* sesuai KTP.
• Masukkan *16 digit NIK* dan *16 digit Nomor KK* (sistem otomatis memeriksa agar tidak terjadi data ganda).
• Masukkan *Nomor WhatsApp Aktif*, pilih *Cluster / RT Domisili*, dan tulis *Alamat Lengkap (Blok & No. Rumah)*.
• Masukkan *Alamat Email* dan buat *Kata Sandi* (minimal 6 karakter) untuk akun login Anda.

*3. Tambahkan Anggota Keluarga Tanggungan (Bagian 2)*
• Masukkan nama anggota keluarga satu rumah yang tercantum di KK (Suami/Istri, Anak Kandung, Orang Tua/Mertua), pilih hubungan keluarga, lalu klik tombol *"+ Tambah"*.

*4. Unggah Foto Kartu Keluarga / KK (Bagian 3)*
• Unggah foto KK dari galeri HP atau gunakan fitur *Kamera Dokumen* langsung dari aplikasi.
• Pastikan foto KK terang, lurus, dan tulisan terbaca jelas, lalu klik *"Kirim Pendaftaran Anggota"*.

*C. ALUR SETELAH PENDAFTARAN TERKIRIM (SAMPAI KTA TERBIT)*
1. *Login untuk Pantau Progres*: Setelah sukses mendaftar, silakan *Login* menggunakan Email & Kata Sandi yang telah dibuat.
2. *Verifikasi Ketua RT (Tahap 1)*: Berkas pendaftaran dan foto KK Anda akan diperiksa oleh Ketua RT sesuai Cluster domisili.
3. *Pembayaran Iuran (Tahap 2)*: Setelah disetujui Ketua RT, lakukan pembayaran iuran tahunan (${annualFee}) dan unggah bukti transfer pada menu *Bayar Iuran*.
4. *Validasi Bendahara & Pengesahan Ketua (Tahap 3 & 4)*: Bendahara memvalidasi bukti transfer dan Ketua Paguyuban mengesahkan kepesertaan Anda.
5. *KTA Digital Resmi Terbit*: Status Anda menjadi *AKTIF* dan *Kartu Tanda Anggota (KTA) Digital* ber-QR Code dapat diunduh langsung dari Portal Anggota.`;
  };

  const handleCopyGuide = () => {
    navigator.clipboard.writeText(buildWhatsAppGuideText());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadPdfGuide = async () => {
    try {
      setDownloadingPdf(true);
      const logoPng = await loadLogoAsPngDataUrl(settings?.logoUrl || '/app-icon.svg');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 16;

      // Header with Logo
      if (logoPng) {
        try {
          doc.addImage(logoPng, 'PNG', margin, y - 3, 15, 15);
        } catch {
          // ignore logo error
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(orgName.toUpperCase(), pageWidth / 2, y + 1, { align: 'center' });

      doc.setFontSize(13);
      doc.setTextColor(4, 120, 87);
      doc.text('PANDUAN RESMI CARA REGISTRASI ANGGOTA BARU', pageWidth / 2, y + 7, {
        align: 'center',
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        settings?.communityAddress || 'Sekretariat Pengurus Paguyuban Dana Kematian Warga',
        pageWidth / 2,
        y + 12,
        { align: 'center' }
      );

      y += 16;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // Section A: Persiapan
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(6, 78, 59);
      doc.text('A. PERSIAPAN BERKAS & DATA SEBELUM MENDAFTAR', margin + 4, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('1. KTP Kepala Keluarga (16 digit NIK yang belum pernah didaftarkan sebelumnya).', margin + 4, y + 11.5);
      doc.text('2. Foto / Scan Kartu Keluarga (KK) asli yang jelas dan terbaca (16 digit Nomor KK).', margin + 4, y + 16.5);
      doc.text('3. Alamat Email aktif & Nomor WhatsApp aktif (untuk akun login warga & notifikasi status).', margin + 4, y + 21.5);
      y += 30;

      // Section B: Langkah Pendaftaran
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('B. LANGKAH-LANGKAH PENGISIAN FORMULIR REGISTRASI ONLINE', margin, y);
      y += 5;

      const steps = [
        {
          no: 'Langkah 1',
          title: 'Buka Menu "Daftar Warga" pada Halaman Utama',
          desc: 'Akses tautan aplikasi paguyuban melalui browser HP/Komputer, kemudian pilih ikon menu "Daftar Warga" untuk membuka Formulir Pendaftaran Anggota Baru.',
        },
        {
          no: 'Langkah 2',
          title: 'Lengkapi Data Kepala Keluarga & Buat Akun Login (Bagian 1)',
          desc: 'Isi Nama Lengkap sesuai KTP, 16 digit NIK, 16 digit Nomor KK, Nomor WhatsApp, pilih Cluster/RT domisili, dan Alamat Rumah (Blok & Nomor). Masukkan juga Alamat Email dan Kata Sandi (minimal 6 karakter) yang akan dipakai untuk Login.',
        },
        {
          no: 'Langkah 3',
          title: 'Tambahkan Daftar Tanggungan Keluarga Serumah (Bagian 2)',
          desc: 'Ketik nama anggota keluarga yang tercantum dalam satu Kartu Keluarga (Suami/Istri, Anak Kandung, Orang Tua/Mertua), pilih hubungan keluarga serta usia, lalu tekan tombol "+ Tambah".',
        },
        {
          no: 'Langkah 4',
          title: 'Unggah Foto Kartu Keluarga (KK) & Kirim Formulir (Bagian 3)',
          desc: 'Pilih file foto KK dari HP atau ambil foto langsung menggunakan Kamera Dokumen. Pastikan teks KK terbaca jelas, kemudian tekan tombol "Kirim Pendaftaran Anggota".',
        },
      ];

      steps.forEach((st) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, 21, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(4, 120, 87);
        doc.text(`${st.no}: ${st.title}`, margin + 4, y + 5.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(st.desc, contentWidth - 8);
        doc.text(lines, margin + 4, y + 10.5);

        y += 24;
      });

      y += 2;

      // Section C: Alur Verifikasi & Pembayaran
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('C. ALUR VERIFIKASI BERJENJANG HINGGA KTA DIGITAL TERBIT', margin, y);
      y += 5;

      const workflow = [
        '1. Login Akun Warga: Setelah registrasi berhasil, klik "Login Sekarang" menggunakan Email & Kata Sandi Anda untuk memonitor progres pendaftaran.',
        '2. Verifikasi Ketua RT: Ketua RT sesuai Cluster domisili akan memeriksa kesesuaian data diri dan lampiran Kartu Keluarga (KK) Anda.',
        `3. Pembayaran Iuran Kas: Setelah disetujui Ketua RT, fitur pembayaran akan terbuka. Transfer iuran sebesar ${annualFee} ke rekening resmi paguyuban dan unggah foto struk/bukti transfer.`,
        '4. Validasi Bendahara & Pengesahan Ketua: Bendahara memverifikasi mutasi kas dan menerbitkan Kwitansi Digital, dilanjutkan pengesahan oleh Ketua Paguyuban.',
        '5. KTA Digital Resmi Aktif: Kartu Tanda Anggota (KTA) Digital ber-QR Code resmi terbit dan dapat langsung dilihat atau diunduh dari Portal Anggota.',
      ];

      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(252, 211, 77);
      doc.roundedRect(margin, y, contentWidth, 48, 2, 2, 'FD');

      let wfY = y + 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(30, 41, 59);
      workflow.forEach((item) => {
        const wrapped = doc.splitTextToSize(item, contentWidth - 8);
        doc.text(wrapped, margin + 4, wfY);
        wfY += wrapped.length * 4 + 1.5;
      });

      y += 54;

      // Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Dicetak dari Sistem Informasi ${orgName} pada ${new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}`,
        pageWidth / 2,
        285,
        { align: 'center' }
      );

      doc.save('Panduan_Registrasi_Anggota_Dana_Kematian.pdf');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Panduan Cara Registrasi Anggota Baru
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase rounded-full">
                  Langkah demi Langkah
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Petunjuk lengkap pendaftaran mandiri warga hingga penerbitan Kartu Tanda Anggota (KTA) Digital.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/70">
          {/* PERSIAPAN BERKAS */}
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>A. Persiapan Sebelum Mendaftar</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                <p className="font-extrabold text-slate-900">1. KTP Kepala Keluarga</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Siapkan 16 digit Nomor Induk Kependudukan (NIK) Kepala Keluarga.
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                <p className="font-extrabold text-slate-900">2. Foto Kartu Keluarga (KK)</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Siapkan 16 digit No. KK & foto lembar KK yang jelas serta mudah dibaca.
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                <p className="font-extrabold text-slate-900">3. Email & No. WhatsApp</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Digunakan sebagai akun Login Warga dan penerima notifikasi WhatsApp.
                </p>
              </div>
            </div>
          </div>

          {/* 4 LANGKAH PENGISIAN FORMULIR */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>B. 4 Langkah Pengisian Formulir Pendaftaran</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Buka Menu "Daftar Warga"
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Pada halaman depan aplikasi, tekan tombol <strong>Daftar Warga</strong> untuk membuka formulir registrasi online.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Isi Data Diri & Buat Akun Login
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Isi <strong>Nama Lengkap</strong>, <strong>NIK (16 digit)</strong>, <strong>No. KK (16 digit)</strong>, <strong>No. WA</strong>, pilih <strong>Cluster/RT</strong>, <strong>Alamat Rumah</strong>, serta buat <strong>Email & Kata Sandi</strong>.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Input Anggota Keluarga (Tanggungan)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Masukkan nama anggota keluarga serumah yang tertera di KK (Suami/Istri, Anak, Orang Tua/Mertua), lalu klik <strong>+ Tambah</strong>.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    4
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Unggah Foto KK & Kirim Pendaftaran
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Lampirkan foto Kartu Keluarga (bisa unggah dari galeri atau foto langsung via kamera aplikasi), lalu klik <strong>Kirim Pendaftaran Anggota</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* ALUR SETELAH MENDAFTAR */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3.5 shadow-xs">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>C. Alur Setelah Mendaftar (Sampai KTA Digital Aktif)</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <LogIn className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">1. Login ke Portal Anggota:</span>{' '}
                  <span className="text-slate-600">
                    Setelah formulir terkirim, Anda akan diarahkan untuk <strong>Login</strong> menggunakan Email dan Kata Sandi yang baru dibuat guna memantau progres verifikasi.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">2. Verifikasi Ketua RT / Cluster:</span>{' '}
                  <span className="text-slate-600">
                    Ketua RT domisili Anda akan memverifikasi kebenaran data warga dan berkas Kartu Keluarga (KK).
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-50/70 border border-sky-200/80">
                <CreditCard className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">3. Pembayaran Iuran & Validasi Bendahara:</span>{' '}
                  <span className="text-slate-600">
                    Setelah disetujui Ketua RT, silakan transfer iuran sebesar <strong>{annualFee}</strong> ke rekening resmi paguyuban dan unggah bukti transfer. Bendahara akan memvalidasi dan menerbitkan Kwitansi Digital.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <QrCode className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">4. Pengesahan Ketua & KTA Digital Terbit:</span>{' '}
                  <span className="text-slate-600">
                    Setelah disahkan Ketua Paguyuban, status keanggotaan menjadi <strong>AKTIF</strong> dan <strong>KTA Digital</strong> resmi ber-QR Code dapat langsung diunduh dari Portal Anggota.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyGuide}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin untuk WA!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Salin Teks (Share ke WA)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdfGuide}
              disabled={downloadingPdf}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? 'Menyiapkan PDF...' : 'Unduh Panduan (.PDF)'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onStartRegistration && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartRegistration();
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Mulai Daftar Sekarang</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
