import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';
import {
  loadLogoAsPngDataUrl,
  resolveTreasurerName,
  formatIndonesianPrintDate,
} from '../lib/treasurerPdfReport';
import {
  X,
  CreditCard,
  CheckCircle2,
  Upload,
  ShieldCheck,
  Receipt,
  QrCode,
  Copy,
  Check,
  Download,
  Landmark,
  LogIn,
  Clock,
  BookOpen,
} from 'lucide-react';

interface PaymentConfirmationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
}

export const PaymentConfirmationGuideModal: React.FC<PaymentConfirmationGuideModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!isOpen) return null;

  const orgName = settings?.communityName || 'Paguyuban Dana Kematian';
  const annualFee = formatIDR(settings?.annualFeeAmount || 300000);
  const treasurerName = resolveTreasurerName(settings);
  const treasurerPhone = settings?.treasurerPhone || '-';
  const bankAccounts = settings?.bankAccounts || [];
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const buildWhatsAppGuideText = () => {
    const bankLines =
      bankAccounts.length > 0
        ? bankAccounts
            .map(
              (b, idx) =>
                `  ${idx + 1}. *${b.bankName}* : \`${b.accountNumber}\` a.n. *${b.accountHolder}*`
            )
            .join('\n')
        : '  • Lihat nomor rekening resmi pada halaman Formulir Pembayaran di aplikasi.';

    return `*PANDUAN KONFIRMASI PEMBAYARAN IURAN CALON ANGGOTA*
*(Khusus Calon Anggota yang Sudah Diverifikasi Ketua RT)*
*${orgName.toUpperCase()}*
${appUrl ? `🔗 Link Aplikasi: ${appUrl}\n` : ''}
*A. INFORMASI IURAN & REKENING RESMI*
• Nominal Iuran Tahunan : *${annualFee}*
• Rekening Resmi Kas Paguyuban:
${bankLines}
• Bendahara Paguyuban : *${treasurerName}* (${treasurerPhone})

*B. LANGKAH-LANGKAH KONFIRMASI PEMBAYARAN DI APLIKASI*
*1. Login ke Portal Warga & Buka Menu Bayar Iuran*
• Masuk (*Login*) ke aplikasi menggunakan *Email* dan *Kata Sandi* yang didaftarkan saat registrasi.
• Pastikan status pendaftaran Anda telah *"Disetujui Ketua RT / Menunggu Pembayaran"*.
• Klik menu *"Bayar Iuran"* (atau tombol *Bayar Iuran* pada halaman Portal Anggota).

*2. Lakukan Transfer Iuran & Simpan Bukti*
• Pada halaman Pembayaran, salin nomor rekening resmi paguyuban yang tertera.
• Lakukan transfer sebesar *${annualFee}* melalui Mobile Banking / ATM / QRIS, lalu simpan tangkapan layar (*screenshot*) atau foto struk bukti transfer.

*3. Isi Formulir Konfirmasi & Unggah Bukti Transfer*
• Pastikan nama Anda terpilih pada kolom *Data Diri Anggota Pembayar* (berlabel *[✓ Disetujui RT - Siap Bayar]*).
• Pilih Jenis Pembayaran: *Iuran Tahunan*.
• Pilih *Metode Pembayaran* sesuai bank tujuan transfer.
• Klik kolom *Unggah Bukti Transfer* lalu pilih foto/screenshot struk transfer Anda.

*4. Kirim Konfirmasi Pembayaran*
• Klik tombol *"Kirim & Konfirmasi Pembayaran"*.
• Sistem otomatis mencatat transaksi Anda dengan status *"Menunggu Validasi Bendahara"* beserta Nomor Registrasi Kwitansi.

*C. PROSES VALIDASI BENDAHARA HINGGA KTA DIGITAL AKTIF*
1. *Validasi Bendahara*: Bendahara memeriksa kesesuaian mutasi rekening dan mengesahkan pembayaran Anda.
2. *Kwitansi Digital Resmi*: Setelah divalidasi Bendahara, Anda dapat langsung mengunduh *Kwitansi Resmi (.PDF)* pada menu *Riwayat Iuran*.
3. *Pengesahan Ketua & KTA Digital Aktif*: Setelah disetujui Ketua Paguyuban, status Anda resmi *AKTIF* dan *KTA Digital* ber-QR Code dapat langsung diunduh dari Portal Anggota.`;
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
      const { dateOnly, dateTime } = formatIndonesianPrintDate(new Date());

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 15;

      // Header with Logo
      if (logoPng) {
        try {
          doc.addImage(logoPng, 'PNG', margin, y - 2, 15, 15);
        } catch {
          // ignore logo error
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(orgName.toUpperCase(), pageWidth / 2, y + 1, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(4, 120, 87);
      doc.text('PANDUAN KONFIRMASI PEMBAYARAN IURAN CALON ANGGOTA', pageWidth / 2, y + 6.5, {
        align: 'center',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        '(KHUSUS CALON ANGGOTA YANG SUDAH DIVERIFIKASI KETUA RT / CLUSTER)',
        pageWidth / 2,
        y + 11.5,
        { align: 'center' }
      );

      y += 15;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      // Section A: Informasi Iuran & Rekening
      const bankCount = Math.max(bankAccounts.length, 1);
      const boxAHeight = 20 + bankCount * 5;
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin, y, contentWidth, boxAHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(6, 78, 59);
      doc.text('A. INFORMASI BESARAN IURAN & REKENING RESMI PAGUYUBAN', margin + 4, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`• Besaran Iuran Tahunan Wajib : ${annualFee}`, margin + 4, y + 11.5);
      doc.text(`• Bendahara Paguyuban : ${treasurerName} (${treasurerPhone})`, margin + 4, y + 16.5);

      let bankY = y + 21.5;
      if (bankAccounts.length > 0) {
        bankAccounts.forEach((b, idx) => {
          doc.setFont('helvetica', 'bold');
          doc.text(
            `  Rekening ${idx + 1}: ${b.bankName} - ${b.accountNumber} (a.n. ${b.accountHolder})`,
            margin + 4,
            bankY
          );
          bankY += 4.8;
        });
      } else {
        doc.text('  • Lihat daftar nomor rekening resmi pada menu Bayar Iuran di aplikasi.', margin + 4, bankY);
      }

      y += boxAHeight + 6;

      // Section B: Langkah Konfirmasi Pembayaran
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('B. LANGKAH-LANGKAH KONFIRMASI PEMBAYARAN OLEH CALON ANGGOTA', margin, y);
      y += 4.5;

      const steps = [
        {
          no: 'Langkah 1',
          title: 'Login ke Portal Warga & Buka Menu "Bayar Iuran"',
          desc: 'Masuk (Login) ke aplikasi menggunakan Email dan Kata Sandi yang telah dibuat saat registrasi. Setelah Ketua RT menyetujui berkas Anda, status berubah menjadi "Menunggu Pembayaran". Klik menu "Bayar Iuran".',
        },
        {
          no: 'Langkah 2',
          title: 'Salin Nomor Rekening Resmi & Lakukan Transfer Iuran',
          desc: `Lihat informasi rekening bank resmi paguyuban pada halaman pembayaran, tekan tombol "Salin", lalu transfer iuran sebesar ${annualFee} melalui Mobile Banking / ATM / QRIS. Simpan foto atau screenshot bukti transfer.`,
        },
        {
          no: 'Langkah 3',
          title: 'Pilih Metode Pembayaran & Unggah Foto Bukti Transfer',
          desc: 'Pastikan nama Anda sudah terpilih pada kolom Data Diri Anggota Pembayar ([Disetujui RT - Siap Bayar]), pilih Jenis Pembayaran "Iuran Tahunan", pilih Metode Pembayaran (Bank Tujuan / QRIS), lalu unggah foto bukti transfer.',
        },
        {
          no: 'Langkah 4',
          title: 'Klik "Kirim & Konfirmasi Pembayaran"',
          desc: 'Tekan tombol "Kirim & Konfirmasi Pembayaran" di bagian bawah formulir. Sistem akan menerbitkan Nomor Registrasi Kwitansi dengan status "Menunggu Validasi Bendahara".',
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

        y += 23.5;
      });

      y += 2;

      // Section C: Proses Validasi Bendahara & KTA
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('C. VALIDASI BENDAHARA, KWITANSI RESMI & PENERBITAN KTA DIGITAL', margin, y);
      y += 4.5;

      const afterSteps = [
        '1. Validasi Mutasi oleh Bendahara: Bendahara memeriksa bukti transfer yang Anda unggah dan mencocokkannya dengan mutasi rekening kas paguyuban.',
        '2. Penerbitan Kwitansi Digital (.PDF): Segera setelah disetujui Bendahara, Kwitansi Digital resmi berstempel & bertanda tangan digital langsung terbit dan dapat diunduh pada menu "Riwayat Iuran".',
        '3. Pengesahan Ketua & KTA Digital Aktif: Setelah disahkan Ketua Paguyuban, status keanggotaan Anda menjadi AKTIF dan Kartu Tanda Anggota (KTA) Digital resmi ber-QR Code dapat diunduh dari Portal Anggota.',
      ];

      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(252, 211, 77);
      doc.roundedRect(margin, y, contentWidth, 35, 2, 2, 'FD');

      let wfY = y + 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(30, 41, 59);
      afterSteps.forEach((item) => {
        const wrapped = doc.splitTextToSize(item, contentWidth - 8);
        doc.text(wrapped, margin + 4, wfY);
        wfY += wrapped.length * 4 + 1.5;
      });

      y += 42;

      // Footer: Tanggal Cetak & Nama Bendahara
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Tanggal Cetak : ${dateTime}`, margin, y + 4);

      const sigX = pageWidth - margin - 32;
      doc.text(`Dicetak tanggal, ${dateOnly}`, sigX, y + 4, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text('Bendahara,', sigX, y + 9, { align: 'center' });
      doc.text(`( ${treasurerName} )`, sigX, y + 23, { align: 'center' });
      const tw = doc.getTextWidth(`( ${treasurerName} )`);
      doc.line(sigX - tw / 2, y + 24, sigX + tw / 2, y + 24);

      doc.save('Panduan_Konfirmasi_Pembayaran_Calon_Anggota.pdf');
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
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Panduan Konfirmasi Pembayaran Calon Anggota
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase rounded-full">
                  Setelah Diverifikasi RT
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Petunjuk langkah demi langkah pembayaran iuran & unggah bukti transfer bagi calon anggota yang telah disetujui Ketua RT.
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
          {/* A. INFORMASI IURAN & REKENING RESMI */}
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-600" />
                <span>A. Syarat & Rekening Resmi Kas Paguyuban</span>
              </h3>
              <span className="px-2.5 py-1 bg-emerald-600 text-white font-mono font-black text-xs rounded-lg">
                Iuran Tahunan: {annualFee}
              </span>
            </div>

            <p className="text-xs text-emerald-900 leading-relaxed">
              Calon anggota yang berkasnya telah <strong>Disetujui oleh Ketua RT</strong> (status berubah menjadi <em>"Menunggu Pembayaran"</em>) dapat langsung melakukan transfer iuran ke rekening resmi berikut:
            </p>

            {bankAccounts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {bankAccounts.map((acc, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-emerald-700">
                        {acc.bankName}
                      </p>
                      <p className="text-xs sm:text-sm font-mono font-black text-slate-900">
                        {acc.accountNumber}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        a.n. {acc.accountHolder}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B. 4 LANGKAH KONFIRMASI PEMBAYARAN */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>B. 4 Langkah Konfirmasi Pembayaran di Aplikasi</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Login & Buka Menu "Bayar Iuran"
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Masuk (<strong>Login</strong>) menggunakan Email & Kata Sandi Anda. Pada halaman Portal Anggota, klik tombol <strong>Bayar Iuran</strong>.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Salin Rekening & Transfer Iuran
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Salin nomor rekening resmi pada panel informasi bank, lakukan transfer sebesar <strong>{annualFee}</strong>, lalu simpan <strong>foto/screenshot bukti transfer</strong>.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Pilih Metode & Unggah Bukti Transfer
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Pastikan nama Anda terpilih (berstatus <em>[✓ Disetujui RT - Siap Bayar]</em>), pilih <strong>Iuran Tahunan</strong>, pilih <strong>Metode Pembayaran</strong> (Bank tujuan / QRIS), lalu <strong>Unggah Foto Bukti Transfer</strong>.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    4
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Klik "Kirim & Konfirmasi Pembayaran"
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Tekan tombol <strong>Kirim & Konfirmasi Pembayaran</strong>. Bukti pembayaran Anda langsung masuk ke antrean validasi Bendahara.
                </p>
              </div>
            </div>
          </div>

          {/* C. PROSES VALIDASI BENDAHARA & PENERBITAN KTA */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3 shadow-xs">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>C. Proses Selanjutnya Setelah Bukti Transfer Dikirim</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">1. Validasi Mutasi oleh Bendahara:</span>{' '}
                  <span className="text-slate-600">
                    Bendahara ({treasurerName}) akan memeriksa bukti transfer Anda dan mencocokkannya dengan mutasi rekening kas paguyuban.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-50/70 border border-sky-200/80">
                <Receipt className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">2. Penerbitan Kwitansi Resmi Digital (.PDF):</span>{' '}
                  <span className="text-slate-600">
                    Begitu disetujui Bendahara, <strong>Kwitansi Resmi Digital</strong> lengkap dengan tanda tangan digital dan QR Verifikasi otomatis terbit serta dapat diunduh pada menu <em>Riwayat Iuran</em>.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <QrCode className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">3. Pengesahan Ketua & KTA Digital Aktif:</span>{' '}
                  <span className="text-slate-600">
                    Setelah disahkan oleh Ketua Paguyuban, status Anda resmi <strong>AKTIF</strong> dan <strong>KTA Digital</strong> ber-QR Code dapat langsung diunduh dari Portal Anggota.
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

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
