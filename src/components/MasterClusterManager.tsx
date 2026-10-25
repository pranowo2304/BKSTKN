import React, { useState } from 'react';
import { ClusterMaster } from '../types';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Phone,
  Mail,
  User,
  Shield,
  Layers,
  ArrowUpDown,
  Building2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { cleanPhoneNumberForWhatsApp, formatPhoneDisplay } from '../lib/receiptUtils';

interface MasterClusterManagerProps {
  clusters: ClusterMaster[];
  onSaveCluster: (cluster: ClusterMaster) => void;
  onDeleteCluster: (clusterId: string) => void;
  onReorderClusters?: (clusters: ClusterMaster[]) => void;
}

export const MasterClusterManager: React.FC<MasterClusterManagerProps> = ({
  clusters,
  onSaveCluster,
  onDeleteCluster,
}) => {
  const [editingCluster, setEditingCluster] = useState<ClusterMaster | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State for new/edit
  const [formData, setFormData] = useState<Partial<ClusterMaster>>({
    name: '',
    code: '',
    rtNumber: '',
    leaderName: '',
    leaderPhone: '',
    leaderEmail: '',
    addressCoverage: '',
    isActive: true,
    notes: '',
  });

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleStartCreate = () => {
    setEditingCluster(null);
    setFormData({
      id: `cls-${Date.now()}`,
      name: '',
      code: '',
      rtNumber: '',
      leaderName: '',
      leaderPhone: '',
      leaderEmail: '',
      addressCoverage: '',
      isActive: true,
      orderIndex: clusters.length + 1,
      notes: '',
    });
    setIsCreatingNew(true);
  };

  const handleStartEdit = (cluster: ClusterMaster) => {
    setIsCreatingNew(false);
    setEditingCluster(cluster);
    setFormData({ ...cluster });
  };

  const handleCancelForm = () => {
    setIsCreatingNew(false);
    setEditingCluster(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Nama Cluster / RT wajib diisi!');
      return;
    }

    const clusterToSave: ClusterMaster = {
      id: formData.id || `cls-${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code?.trim() || '',
      rtNumber: formData.rtNumber?.trim() || '',
      leaderName: formData.leaderName?.trim() || '',
      leaderPhone: formData.leaderPhone?.trim() || '',
      leaderEmail: formData.leaderEmail?.trim() || '',
      addressCoverage: formData.addressCoverage?.trim() || '',
      isActive: formData.isActive !== false,
      orderIndex: formData.orderIndex || clusters.length + 1,
      notes: formData.notes?.trim() || '',
    };

    onSaveCluster(clusterToSave);
    showNotification(isCreatingNew ? `Berhasil menambahkan ${clusterToSave.name}` : `Berhasil memperbarui ${clusterToSave.name}`);
    setIsCreatingNew(false);
    setEditingCluster(null);
  };

  const handleToggleStatus = (cluster: ClusterMaster) => {
    const updated = { ...cluster, isActive: !cluster.isActive };
    onSaveCluster(updated);
    showNotification(`Status ${cluster.name} diubah menjadi ${updated.isActive ? 'Aktif' : 'Non-Aktif'}`);
  };

  const handleDelete = (cluster: ClusterMaster) => {
    onDeleteCluster(cluster.id);
    setDeleteConfirmId(null);
    showNotification(`Cluster ${cluster.name} telah dihapus.`);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden border border-emerald-800/60">
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-800/80 rounded-full text-emerald-300 text-xs font-bold mb-2 border border-emerald-700/60">
              <Layers className="w-3.5 h-3.5" />
              <span>Master Data Wilayah</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Struktur Cluster & RT Dinamis
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/80 mt-1 max-w-2xl leading-relaxed">
              Kelola pembagian wilayah, nama Ketua RT penanggung jawab, dan nomor kontak secara dinamis. 
              Perubahan langsung tersinkronisasi ke seluruh akun login Ketua RT (User Management), formulir pendaftaran warga, verifikasi, dan pelaporan.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartCreate}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md hover:scale-105 active:scale-95 inline-flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cluster / RT</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Form Modal / Inline Editor */}
      {(isCreatingNew || editingCluster) && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500/50 shadow-lg p-5 sm:p-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>{isCreatingNew ? 'Tambah Master Cluster / RT Baru' : `Edit ${editingCluster?.name}`}</span>
            </h4>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Cluster / RT <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cluster Pasundan RT 04"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Singkat Cluster
                </label>
                <input
                  type="text"
                  placeholder="Contoh: PSD-04 atau RNM"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor RT / RW
                </label>
                <input
                  type="text"
                  placeholder="Contoh: RT 04 / RW 05"
                  value={formData.rtNumber || ''}
                  onChange={(e) => setFormData({ ...formData, rtNumber: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Ketua RT Penanggung Jawab
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bpk. H. Sukirman"
                  value={formData.leaderName || ''}
                  onChange={(e) => setFormData({ ...formData, leaderName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp Ketua RT
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890 atau 6281234567890"
                  value={formData.leaderPhone || ''}
                  onChange={(e) => setFormData({ ...formData, leaderPhone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                />
                {(() => {
                  const clean = cleanPhoneNumberForWhatsApp(formData.leaderPhone);
                  if (clean) {
                    return (
                      <div className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center justify-between">
                        <span>Format WA: <strong>{formatPhoneDisplay(clean)}</strong></span>
                        <span className="text-slate-400 font-mono text-[10px]">wa.me/{clean}</span>
                      </div>
                    );
                  }
                  return (
                    <p className="text-[10px] text-slate-500 mt-1">
                      💡 Format: <strong>0812xxxx</strong> (otomatis dikonversi ke kode 62 saat chat) atau <strong>62812xxxx</strong>.
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Akun RT (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="rt.nama@danakematian.org"
                  value={formData.leaderEmail || ''}
                  onChange={(e) => setFormData({ ...formData, leaderEmail: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cakupan Wilayah / Blok
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Blok P (No. 81 - 110)"
                  value={formData.addressCoverage || ''}
                  onChange={(e) => setFormData({ ...formData, addressCoverage: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Wilayah
                </label>
                <select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-semibold"
                >
                  <option value="active">Aktif (Muncul di Form & Filter)</option>
                  <option value="inactive">Non-Aktif (Disembunyikan)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isCreatingNew ? 'Simpan Cluster Baru' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cluster Master Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusters.map((cluster, idx) => {
          const isDeleting = deleteConfirmId === cluster.id;

          return (
            <div
              key={cluster.id}
              className={`bg-white rounded-2xl border transition-all p-4 relative flex flex-col justify-between ${
                cluster.isActive
                  ? 'border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-md'
                  : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <div>
                {/* Top badges */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {cluster.code && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-black rounded-md border border-emerald-200">
                        {cluster.code}
                      </span>
                    )}
                    {cluster.rtNumber && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                        {cluster.rtNumber}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(cluster)}
                    className="shrink-0 text-xs inline-flex items-center gap-1 font-bold transition-colors"
                    title={cluster.isActive ? 'Klik untuk non-aktifkan' : 'Klik untuk aktifkan'}
                  >
                    {cluster.isActive ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Aktif
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] border border-slate-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Non-Aktif
                      </span>
                    )}
                  </button>
                </div>

                {/* Cluster Name */}
                <h4 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{cluster.name}</span>
                </h4>

                {cluster.addressCoverage && (
                  <p className="text-[11px] text-slate-500 mb-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 font-medium">
                    Cakupan: <strong className="text-slate-700">{cluster.addressCoverage}</strong>
                  </p>
                )}

                {/* RT Leader Info */}
                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">
                      {cluster.leaderName || 'Belum ada nama Ketua RT'}
                    </span>
                  </div>
                  {cluster.leaderPhone && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                          {cluster.leaderPhone}
                        </span>
                      </div>
                      {cleanPhoneNumberForWhatsApp(cluster.leaderPhone) && (
                        <a
                          href={`https://wa.me/${cleanPhoneNumberForWhatsApp(cluster.leaderPhone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[9px] font-bold inline-flex items-center gap-0.5 transition-colors"
                          title="Tes WhatsApp Ketua RT"
                        >
                          <MessageCircle className="w-2.5 h-2.5 text-emerald-700" />
                          <span>Tes WA</span>
                        </a>
                      )}
                    </div>
                  )}
                  {cluster.leaderEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-500 truncate">
                        {cluster.leaderEmail}
                      </span>
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-600">
                    <span className="flex items-center gap-1 text-slate-500 font-medium">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      <span>Akun Login RT:</span>
                    </span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[9px] border border-emerald-200/60">
                      Otomatis Tersinkron
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                {!isDeleting ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cluster)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 flex-1 justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Info</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(cluster.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus cluster"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2 w-full bg-rose-50 p-1.5 rounded-lg border border-rose-200 animate-in fade-in">
                    <span className="text-[10px] font-bold text-rose-800">Yakin hapus?</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(cluster)}
                        className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded hover:bg-rose-700"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
