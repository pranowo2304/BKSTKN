import React, { useState, useRef } from 'react';
import { Member, SystemSettings } from '../types';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Users, 
  FileText, 
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';

interface CsvMemberImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportMembers: (importedMembers: Member[]) => void;
  existingMembers: Member[];
  settings: SystemSettings;
}

interface ParsedMemberRow {
  rowIndex: number;
  name: string;
  nik: string;
  phone: string;
  cluster: string;
  address: string;
  dependentsCount: number;
  familyCardNumber?: string;
  joinDate: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export const CsvMemberImportModal: React.FC<CsvMemberImportModalProps> = ({
  isOpen,
  onClose,
  onImportMembers,
  existingMembers,
  settings,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedMemberRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'invalid'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Function to download pre-formatted CSV template
  const handleDownloadTemplate = () => {
    const headers = 'nama,nik,no_kk,no_hp,cluster,alamat,jumlah_tanggungan,tgl_bergabung,catatan';
    const sampleRows = [
      'Budi Santoso,3201123456780001,3201123456780099,081234567890,Cluster Sanur,"Blok S-12 No. 04",3,2026-08-01,Kepala Keluarga',
      'Siti Aminah,3201123456780002,3201123456780088,081398765432,Cluster Mataram,"Blok M-05 No. 18",2,2026-08-01,Warga RT 05',
      'Ahmad Fauzi,3201123456780003,3201123456780077,085611223344,Cluster Pasundan RT 01,"Blok P-08 No. 02",0,2026-08-01,',
      'Dewi Lestari,3201123456780004,3201123456780066,087811223344,Cluster Ranah Minang,"Blok RM-19 No. 11",1,2026-08-01,',
    ].join('\n');

    const csvContent = `${headers}\n${sampleRows}`;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `template_import_anggota_${settings.communityName.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust CSV parser supporting quotes and comma or semicolon delimiters
  const parseCSVContent = (text: string): ParsedMemberRow[] => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      throw new Error('File CSV kosong atau hanya berisi baris header.');
    }

    // Determine delimiter (comma or semicolon)
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';

    // Parse a single CSV line accounting for quotes
    const parseLine = (lineStr: string): string[] => {
      const result: string[] = [];
      let current = '';
      let insideQuote = false;

      for (let i = 0; i < lineStr.length; i++) {
        const char = lineStr[i];
        if (char === '"') {
          if (insideQuote && lineStr[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuote = !insideQuote;
          }
        } else if (char === delimiter && !insideQuote) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headerCols = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_]/g, ''));
    
    // Map column indices
    const nameIdx = headerCols.findIndex((h) => h.includes('nama') || h.includes('name'));
    const nikIdx = headerCols.findIndex((h) => h.includes('nik') || h.includes('ktp'));
    const kkIdx = headerCols.findIndex((h) => h.includes('kk') || h.includes('keluarga') || h.includes('familycard'));
    const phoneIdx = headerCols.findIndex((h) => h.includes('hp') || h.includes('telepon') || h.includes('phone') || h.includes('wa'));
    const clusterIdx = headerCols.findIndex((h) => h.includes('cluster') || h.includes('kluster') || h.includes('wilayah'));
    const addrIdx = headerCols.findIndex((h) => h.includes('alamat') || h.includes('address') || h.includes('blok'));
    const depIdx = headerCols.findIndex((h) => h.includes('tanggung') || h.includes('dependent') || h.includes('jiwa'));
    const dateIdx = headerCols.findIndex((h) => h.includes('tgl') || h.includes('tanggal') || h.includes('date') || h.includes('join'));
    const notesIdx = headerCols.findIndex((h) => h.includes('catatan') || h.includes('note') || h.includes('keterangan'));

    if (nameIdx === -1 || nikIdx === -1) {
      throw new Error('Format CSV tidak valid: Header wajib mengandung kolom "nama" dan "nik". Kolom opsional: "no_kk", "no_hp", dll.');
    }

    const existingNikMap = new Map<string, string>();
    const existingKkMap = new Map<string, string>();
    existingMembers.forEach((m) => {
      const cleanNik = (m.nik || '').trim().replace(/[\s.\-_]/g, '');
      if (cleanNik) existingNikMap.set(cleanNik, m.name);
      const cleanKk = (m.familyCardNumber || '').trim().replace(/[\s.\-_]/g, '');
      if (cleanKk) existingKkMap.set(cleanKk, m.name);
    });

    const seenNikInBatch = new Set<string>();
    const seenKkInBatch = new Set<string>();
    const results: ParsedMemberRow[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const rawName = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : '';
      const rawNik = nikIdx !== -1 && cols[nikIdx] ? cols[nikIdx].replace(/[^\d]/g, '') : '';
      const rawKk = kkIdx !== -1 && cols[kkIdx] ? cols[kkIdx].replace(/[^\d]/g, '') : '';
      const rawPhone = phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : '';
      let rawCluster = clusterIdx !== -1 && cols[clusterIdx] ? cols[clusterIdx].trim() : '';
      const rawAddr = addrIdx !== -1 && cols[addrIdx] ? cols[addrIdx] : 'RT 05 / RW 03';
      const rawDep = depIdx !== -1 && cols[depIdx] ? parseInt(cols[depIdx].replace(/[^\d]/g, ''), 10) : 0;
      const rawDate = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : todayStr;
      const rawNotes = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : '';

      // Auto-normalize cluster
      const lowerAddr = rawAddr.toLowerCase();
      const lowerCluster = rawCluster.toLowerCase();
      if (!rawCluster) {
        if (lowerAddr.includes('sanur')) rawCluster = 'Cluster Sanur';
        else if (lowerAddr.includes('mataram')) rawCluster = 'Cluster Mataram';
        else if (lowerAddr.includes('pasundan') || lowerAddr.includes('blok p-')) {
          if (lowerAddr.includes('rt 02') || lowerAddr.includes('rt 2') || lowerAddr.includes('rt.02') || lowerAddr.includes('rt.2')) rawCluster = 'Cluster Pasundan RT 02';
          else if (lowerAddr.includes('rt 03') || lowerAddr.includes('rt 3') || lowerAddr.includes('rt.03') || lowerAddr.includes('rt.3')) rawCluster = 'Cluster Pasundan RT 03';
          else rawCluster = 'Cluster Pasundan RT 01';
        }
        else if (lowerAddr.includes('minang') || lowerAddr.includes('rm-') || lowerAddr.includes('tm-')) rawCluster = 'Cluster Ranah Minang';
        else rawCluster = 'Cluster Sanur';
      } else {
        if (lowerCluster === 'sanur' || lowerCluster === 'cluster sanur') rawCluster = 'Cluster Sanur';
        else if (lowerCluster === 'mataram' || lowerCluster === 'cluster mataram') rawCluster = 'Cluster Mataram';
        else if (lowerCluster.includes('pasundan')) {
          if (lowerCluster.includes('02') || lowerCluster.includes('rt 2') || lowerCluster.includes('rt.2') || lowerCluster.includes('rt 02') || lowerCluster.includes('rt.02')) rawCluster = 'Cluster Pasundan RT 02';
          else if (lowerCluster.includes('03') || lowerCluster.includes('rt 3') || lowerCluster.includes('rt.3') || lowerCluster.includes('rt 03') || lowerCluster.includes('rt.03')) rawCluster = 'Cluster Pasundan RT 03';
          else rawCluster = 'Cluster Pasundan RT 01';
        }
        else if (lowerCluster.includes('minang') || lowerCluster.includes('ranah minang') || lowerCluster.includes('tanah minang')) rawCluster = 'Cluster Ranah Minang';
      }

      const errors: string[] = [];

      // Name validation
      if (!rawName || rawName.trim().length < 2) {
        errors.push('Nama wajib diisi (minimal 2 karakter)');
      }

      // NIK validation & Double Check
      if (!rawNik) {
        errors.push('NIK wajib diisi');
      } else if (rawNik.length < 10) {
        errors.push('NIK terlalu pendek (minimal 10-16 digit angka)');
      } else if (existingNikMap.has(rawNik)) {
        errors.push(`DATA DOUBLE NIK: NIK ${rawNik} sudah terdaftar atas nama "${existingNikMap.get(rawNik)}"`);
      } else if (seenNikInBatch.has(rawNik)) {
        errors.push(`DATA DOUBLE NIK: NIK ${rawNik} duplikat di baris lain dalam file CSV ini`);
      } else {
        seenNikInBatch.add(rawNik);
      }

      // Nomor KK validation & Double Check (jika ada)
      if (rawKk) {
        if (rawKk.length < 10) {
          errors.push('Nomor KK terlalu pendek (minimal 10-16 digit angka)');
        } else if (existingKkMap.has(rawKk)) {
          errors.push(`DATA DOUBLE KK: No. KK ${rawKk} sudah terdaftar atas nama Kepala Keluarga "${existingKkMap.get(rawKk)}"`);
        } else if (seenKkInBatch.has(rawKk)) {
          errors.push(`DATA DOUBLE KK: No. KK ${rawKk} duplikat di baris lain dalam file CSV ini`);
        } else {
          seenKkInBatch.add(rawKk);
        }
      }

      // Date validation
      let formattedDate = todayStr;
      if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        formattedDate = rawDate;
      }

      results.push({
        rowIndex: i,
        name: rawName.trim(),
        nik: rawNik.trim(),
        familyCardNumber: rawKk ? rawKk.trim() : undefined,
        phone: rawPhone.trim() || '-',
        cluster: rawCluster,
        address: rawAddr.trim(),
        dependentsCount: isNaN(rawDep) ? 0 : Math.max(0, rawDep),
        joinDate: formattedDate,
        notes: rawNotes.trim(),
        isValid: errors.length === 0,
        errors,
      });
    }

    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setErrorMsg(null);
    setFile(uploadedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSVContent(text);
        setParsedRows(parsed);
      } catch (err: any) {
        setErrorMsg(err.message || 'Gagal membaca atau memproses file CSV.');
        setParsedRows([]);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file dari komputer/perangkat.');
      setIsProcessing(false);
    };
    reader.readAsText(uploadedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.csv') && !droppedFile.name.endsWith('.txt')) {
        setErrorMsg('Harap pilih file dengan format .csv');
        return;
      }
      setErrorMsg(null);
      setFile(droppedFile);
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = parseCSVContent(text);
          setParsedRows(parsed);
        } catch (err: any) {
          setErrorMsg(err.message || 'Gagal memproses file CSV.');
          setParsedRows([]);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsText(droppedFile);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const displayedRows = parsedRows.filter((r) => {
    if (filterView === 'valid') return r.isValid;
    if (filterView === 'invalid') return !r.isValid;
    return true;
  });

  const handleExecuteImport = () => {
    if (validRows.length === 0) return;

    let baseNumber = existingMembers.length;
    const newMembersList: Member[] = validRows.map((row, idx) => {
      const num = (baseNumber + idx + 1).toString().padStart(3, '0');
      const memberNumber = `ADK-2026-${num}`;

      return {
        id: 'mem-imp-' + Date.now() + '-' + idx,
        memberNumber,
        name: row.name,
        nik: row.nik,
        familyCardNumber: row.familyCardNumber,
        phone: row.phone === '-' ? '' : row.phone,
        cluster: row.cluster as any,
        address: row.address,
        joinDate: row.joinDate,
        status: 'Aktif',
        dependentsCount: row.dependentsCount,
        notes: row.notes ? `Imported CSV: ${row.notes}` : 'Onboarding massal via CSV',
      };
    });

    onImportMembers(newMembersList);
    onClose();
  };

  const handleResetFile = () => {
    setFile(null);
    setParsedRows([]);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Import Data Anggota Massal (CSV Onboarding)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Daftarkan data warga secara massal dari file spreadsheet Excel / CSV dengan validasi otomatis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">

          {/* STEP 1: DOWNLOAD TEMPLATE & UPLOAD BOX */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Download Template Box */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
              <div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-md">
                  Langkah 1
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-2">Unduh Format Template</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Gunakan format kolom baku agar sistem membaca Nama, NIK, No. HP, Alamat, dan Tanggungan secara tepat.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Template CSV (.csv)</span>
              </button>
            </div>

            {/* Upload Area Box */}
            <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-md">
                  Langkah 2: Pilih / Seret File
                </span>
                {file && (
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Ganti File</span>
                  </button>
                )}
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  file
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, text/csv, text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} baris terdeteksi
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Klik di sini atau seret file CSV ke area ini
                    </p>
                    <p className="text-[11px] text-slate-400">Mendukung format .csv (Koma / Titik Koma)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs animate-in zoom-in-95">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal Memproses File CSV:</p>
                <p className="mt-0.5 text-rose-700">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION TABLE */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>Pratinjau & Hasil Validasi Data ({parsedRows.length} Baris)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Periksa data sebelum dimasukkan ke database sistem.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterView === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('valid')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterView === 'valid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  {invalidRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterView('invalid')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        filterView === 'invalid' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      Error ({invalidRows.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-900 text-white uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">Baris</th>
                        <th className="py-3 px-4">Status Validasi</th>
                        <th className="py-3 px-4">Nama Lengkap</th>
                        <th className="py-3 px-4">NIK</th>
                        <th className="py-3 px-4">Cluster</th>
                        <th className="py-3 px-4">Alamat</th>
                        <th className="py-3 px-4">No. HP</th>
                        <th className="py-3 px-4">Tanggungan</th>
                        <th className="py-3 px-4">Tgl Daftar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            Tidak ada baris data pada filter ini.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={`transition-colors ${
                              row.isValid ? 'hover:bg-emerald-50/40' : 'bg-rose-50/30 hover:bg-rose-50/60'
                            }`}
                          >
                            <td className="py-2.5 px-4 text-slate-500 font-bold">#{row.rowIndex}</td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {row.isValid ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1 font-sans">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Siap Impor</span>
                                </span>
                              ) : (
                                <div className="space-y-0.5 font-sans">
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    <span>Error</span>
                                  </span>
                                  <p className="text-[10px] text-rose-600 font-semibold max-w-xs">
                                    {row.errors.join(', ')}
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-sans font-bold text-slate-900 whitespace-nowrap">
                              {row.name || <span className="text-rose-500 italic">[Kosong]</span>}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                              {row.nik || <span className="text-rose-500 italic">[Kosong]</span>}
                            </td>
                            <td className="py-2.5 px-4 font-sans whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold text-[10px] rounded-md border border-slate-200">
                                {row.cluster}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-sans text-slate-600 max-w-xs truncate">
                              {row.address}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{row.phone}</td>
                            <td className="py-2.5 px-4 text-slate-800 font-bold">{row.dependentsCount} Jiwa</td>
                            <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{row.joinDate}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notice when some rows are invalid */}
              {invalidRows.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-medium">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Terdapat <strong>{invalidRows.length}</strong> baris yang tidak valid dan akan dilewati otomatis jika Anda melanjutkan proses impor.
                  </span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-slate-500">
            {validRows.length > 0 ? (
              <span>
                <strong>{validRows.length}</strong> anggota valid siap diterbitkan nomor anggotanya.
              </span>
            ) : (
              <span>Silakan pilih file CSV terlebih dahulu.</span>
            )}
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={validRows.length === 0}
              onClick={handleExecuteImport}
              className={`w-full sm:w-auto px-6 py-2.5 text-xs font-black text-white rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2 ${
                validRows.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20'
                  : 'bg-slate-300 cursor-not-allowed text-slate-500'
              }`}
            >
              <span>Impor {validRows.length} Anggota Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
