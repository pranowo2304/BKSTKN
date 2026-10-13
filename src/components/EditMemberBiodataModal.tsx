import React, { useState, useEffect } from 'react';
import { Member, Dependent, ClusterType, CLUSTERS, SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';
import {
  X,
  User,
  Phone,
  MapPin,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  HeartHandshake,
  Edit3,
  Calendar,
  Home,
  FileText,
  Camera,
  Upload,
  Check
} from 'lucide-react';
import { FamilyCardUploader } from './FamilyCardUploader';
import { MemberPhotoCaptureModal } from './MemberPhotoCaptureModal';
import { checkDuplicateMember, findDuplicateNikMember, findDuplicateKkMember } from '../lib/duplicateValidator';

interface EditMemberBiodataModalProps {
  isOpen: boolean;
  member: Member | null;
  members?: Member[];
  settings?: SystemSettings;
  onClose: () => void;
  onSave: (updatedMember: Member) => void;
}

export const EditMemberBiodataModal: React.FC<EditMemberBiodataModalProps> = ({
  isOpen,
  member,
  members = [],
  settings,
  onClose,
  onSave,
}) => {
  if (!isOpen || !member) return null;

  const [activeTab, setActiveTab] = useState<'biodata' | 'dependents' | 'kartu-keluarga'>('biodata');

  // Biodata fields
  const [name, setName] = useState(member.name || '');
  const [nik, setNik] = useState(member.nik || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [address, setAddress] = useState(member.address || '');
  const [cluster, setCluster] = useState<string>(member.cluster || 'Cluster Sanur');
  const [photoUrl, setPhotoUrl] = useState<string>(member.photoUrl || '');
  const [isPhotoCaptureModalOpen, setIsPhotoCaptureModalOpen] = useState<boolean>(false);
  const [familyCardFile, setFamilyCardFile] = useState<File | null>(null);
  const [familyCardPhotoUrl, setFamilyCardPhotoUrl] = useState(member.familyCardPhotoUrl || '');
  const [familyCardFileName, setFamilyCardFileName] = useState(member.familyCardFileName || '');
  const [familyCardNumber, setFamilyCardNumber] = useState(member.familyCardNumber || '');

  // Dependents fields
  const [dependents, setDependents] = useState<Dependent[]>(() => {
    if (member.dependentsList && member.dependentsList.length > 0) {
      return [...member.dependentsList];
    }
    return [];
  });

  // Form for adding a new dependent
  const [newDepName, setNewDepName] = useState('');
  const [newDepRel, setNewDepRel] = useState('Suami/Istri');
  const [newDepAge, setNewDepAge] = useState('');

  // Duplicate checks against other members
  const duplicateNikMember = React.useMemo(() => {
    if (!members || members.length === 0) return undefined;
    return findDuplicateNikMember(members, nik, member.id);
  }, [members, nik, member.id]);

  const duplicateKkMember = React.useMemo(() => {
    if (!members || members.length === 0) return undefined;
    return findDuplicateKkMember(members, familyCardNumber, member.id);
  }, [members, familyCardNumber, member.id]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state whenever member changes
  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setNik(member.nik || '');
      setPhone(member.phone || '');
      setAddress(member.address || '');
      setCluster(member.cluster || 'Cluster Sanur');
      setPhotoUrl(member.photoUrl || '');
      setFamilyCardPhotoUrl(member.familyCardPhotoUrl || '');
      setFamilyCardFileName(member.familyCardFileName || '');
      setFamilyCardNumber(member.familyCardNumber || '');
      setDependents(member.dependentsList ? [...member.dependentsList] : []);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [member]);

  const handleAddDependent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDepName.trim()) {
      setErrorMessage('Nama anggota keluarga wajib diisi.');
      return;
    }

    const newDep: Dependent = {
      id: 'dep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: newDepName.trim(),
      relationship: newDepRel,
      age: newDepAge ? parseInt(newDepAge, 10) : undefined,
    };

    setDependents([...dependents, newDep]);
    setNewDepName('');
    setNewDepAge('');
    setErrorMessage(null);
  };

  const handleRemoveDependent = (id: string) => {
    setDependents(dependents.filter((d) => d.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Nama lengkap tidak boleh kosong.');
      setActiveTab('biodata');
      return;
    }

    if (!phone.trim()) {
      setErrorMessage('Nomor WhatsApp / HP wajib diisi untuk koordinasi darurat.');
      setActiveTab('biodata');
      return;
    }

    if (!address.trim()) {
      setErrorMessage('Alamat lengkap rumah wajib diisi.');
      setActiveTab('biodata');
      return;
    }

    // Clean NIK
    const cleanNik = nik.trim();
    if (cleanNik && cleanNik.length !== 16) {
      setErrorMessage('Nomor NIK harus berjumlah 16 digit angka.');
      setActiveTab('biodata');
      return;
    }

    // Validasi pencegahan data double NIK & No. KK pada anggota lain
    if (members && members.length > 0) {
      const dupCheck = checkDuplicateMember(members, cleanNik, familyCardNumber, member.id);
      if (dupCheck.isDuplicate) {
        setErrorMessage(dupCheck.message || 'Data double terdeteksi');
        setActiveTab('biodata');
        return;
      }
    }

    const updatedMember: Member = {
      ...member,
      name: name.trim(),
      nik: cleanNik,
      phone: phone.trim(),
      address: address.trim(),
      cluster: cluster,
      photoUrl: photoUrl || undefined,
      familyCardPhotoUrl,
      familyCardFileName,
      familyCardNumber: familyCardNumber.trim() || undefined,
      dependentsList: dependents,
      dependentsCount: dependents.length,
    };

    onSave(updatedMember);
    setSuccessMessage('Biodata dan data keluarga berhasil diperbarui!');
    
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const dependentBenefit = settings?.dependentBenefitAmount || 6000000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Perbarui Data Diri & Keluarga</span>
                <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono rounded border border-emerald-500/30">
                  {member.memberNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Ubah informasi kontak, alamat, dan tambahkan anggota keluarga serumah.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('biodata')}
            className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'biodata'
                ? 'border-emerald-600 text-emerald-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. Biodata Anggota</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dependents')}
            className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'dependents'
                ? 'border-emerald-600 text-emerald-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Data Keluarga & Tanggungan ({dependents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kartu-keluarga')}
            className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'kartu-keluarga'
                ? 'border-emerald-600 text-emerald-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3. Kartu Keluarga (KK)</span>
            {familyCardPhotoUrl ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Foto KK Terlampir"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Belum Ada Foto KK"></span>
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* TAB 1: BIODATA */}
          {activeTab === 'biodata' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Anggota (Kepala Keluarga) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                    placeholder="Contoh: Bpk. Bambang Pamungkas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NIK */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Nomor NIK (KTP 16 Digit) <span className="text-rose-500">*</span></span>
                    {duplicateNikMember && (
                      <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                        Data Double Terdeteksi
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                    className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm font-mono transition-all outline-none ${
                      duplicateNikMember
                        ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-500 font-bold'
                        : nik && nik.length === 16
                        ? 'border-emerald-400 bg-emerald-50/50 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500'
                    }`}
                    placeholder="16 digit angka NIK"
                  />
                  {duplicateNikMember ? (
                    <span className="text-[11px] text-rose-700 font-bold mt-1 block">
                      ⚠️ NIK sudah dipakai oleh warga {duplicateNikMember.name} ({duplicateNikMember.cluster || 'Cluster'})
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {nik.length}/16 digit
                    </span>
                  )}
                </div>

                {/* No. WhatsApp / HP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. WhatsApp / HP Aktif <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                      placeholder="0812-xxxx-xxxx"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Digunakan untuk pengiriman kwitansi & koordinasi darurat
                  </span>
                </div>
              </div>

              {/* Cluster RT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Wilayah Cluster RT
                </label>
                <select
                  value={cluster}
                  onChange={(e) => setCluster(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                >
                  {CLUSTERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alamat Lengkap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap Rumah (Blok / No. Rumah) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                    placeholder="Contoh: Jl. Sanur Raya Blok C2 No. 15, RT 01"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  Pastikan nomor telepon WhatsApp dan alamat rumah selalu akurat agar pengurus paguyuban dan tim ambulans dapat merespons cepat saat dibutuhkan.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: DATA KELUARGA & TANGGUNGAN */}
          {activeTab === 'dependents' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Info Perlindungan Santunan */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-3">
                <HeartHandshake className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-emerald-900">Perlindungan Santunan Seluruh Keluarga</h4>
                  <p className="mt-0.5 leading-relaxed text-emerald-800">
                    Setiap tanggungan keluarga serumah yang didaftarkan berhak memperoleh santunan duka sebesar{' '}
                    <strong className="font-mono text-emerald-950">{formatIDR(dependentBenefit)}</strong> serta pendampingan pengurusan fardhu kifayah jenazah.
                  </p>
                </div>
              </div>

              {/* Form Tambah Anggota Keluarga Baru */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tambah Anggota Keluarga Baru</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Nama */}
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      placeholder="Nama istri / anak / orang tua..."
                      value={newDepName}
                      onChange={(e) => setNewDepName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Hubungan */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Hubungan Keluarga</label>
                    <select
                      value={newDepRel}
                      onChange={(e) => setNewDepRel(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Suami/Istri">Suami / Istri</option>
                      <option value="Anak Kandung">Anak Kandung</option>
                      <option value="Orang Tua">Orang Tua</option>
                      <option value="Mertua">Mertua</option>
                      <option value="Saudara Kandung">Saudara Kandung</option>
                      <option value="Lainnya">Lainnya (Serumah)</option>
                    </select>
                  </div>

                  {/* Usia */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Usia (Thn)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      placeholder="Usia"
                      value={newDepAge}
                      onChange={(e) => setNewDepAge(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddDependent}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan ke Daftar</span>
                  </button>
                </div>
              </div>

              {/* Daftar Tanggungan yang Sudah Ada */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span>Daftar Tanggungan Terdaftar</span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-[10px] font-bold rounded-full">
                      {dependents.length} Jiwa
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Total Jiwa Terlindungi: <strong>{dependents.length + 1} Jiwa</strong> (Termasuk Kepala Keluarga)
                  </span>
                </div>

                {dependents.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 space-y-1">
                    <Users className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">Belum ada anggota keluarga tanggungan yang didaftarkan</p>
                    <p className="text-[11px] text-slate-400">Gunakan form di atas untuk mendaftarkan istri, anak, atau orang tua serumah.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    {dependents.map((dep, idx) => (
                      <div key={dep.id || idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{dep.name}</div>
                            <div className="text-[11px] text-slate-500">
                              <span className="font-medium text-emerald-700">{dep.relationship}</span>
                              {dep.age ? ` • ${dep.age} Tahun` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                            Terlindungi
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDependent(dep.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus tanggungan ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: KARTU KELUARGA */}
          {activeTab === 'kartu-keluarga' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                <FamilyCardUploader
                  file={familyCardFile}
                  onFileSelect={(f) => setFamilyCardFile(f)}
                  photoUrl={familyCardPhotoUrl}
                  fileName={familyCardFileName}
                  kkNumber={familyCardNumber}
                  memberName={name || member.name}
                  cluster={cluster}
                  required={false}
                  onChange={({ photoUrl, fileName, kkNumber, file }) => {
                    if (file !== undefined) setFamilyCardFile(file);
                    setFamilyCardPhotoUrl(photoUrl);
                    setFamilyCardFileName(fileName);
                    if (kkNumber !== undefined) setFamilyCardNumber(kkNumber);
                  }}
                  onClear={() => {
                    setFamilyCardFile(null);
                    setFamilyCardPhotoUrl('');
                    setFamilyCardFileName('');
                  }}
                  onKkNumberChange={(kkNum) => setFamilyCardNumber(kkNum)}
                  duplicateKkError={
                    duplicateKkMember
                      ? `Nomor KK ini sudah terdaftar atas nama Kepala Keluarga "${duplicateKkMember.name}" (${duplicateKkMember.cluster || 'Cluster'}, No. Anggota: ${duplicateKkMember.memberNumber || '-'}).`
                      : null
                  }
                />
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Foto Kartu Keluarga disimpan sebagai berkas validasi resmi hak santunan duka anggota dan keluarga terlindungi.</span>
              </p>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
            >
              Batal
            </button>

            <div className="flex items-center gap-2">
              {activeTab === 'biodata' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dependents')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors"
                >
                  Lanjut ke Data Keluarga &rarr;
                </button>
              )}

              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-900/20 inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
