import React, { useState, useMemo } from 'react';
import {
  FuneralSchedule,
  FuneralStatus,
  AppUser,
  Member,
  BenefitClaim,
  AmbulanceOrder,
  SystemSettings,
} from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Edit3,
  Trash2,
  Heart,
  ChevronDown,
  Navigation,
  Check,
  Sparkles,
  Ambulance,
  FileText,
  Volume2,
  Layers,
  ArrowRight,
  Send,
  MessageCircle,
  Boxes,
} from 'lucide-react';

interface FuneralScheduleProps {
  schedules: FuneralSchedule[];
  members?: Member[];
  claims?: BenefitClaim[];
  ambulanceOrders?: AmbulanceOrder[];
  currentUser: AppUser | null;
  settings?: SystemSettings;
  onAddSchedule: (schedule: FuneralSchedule) => void;
  onUpdateSchedule: (schedule: FuneralSchedule) => void;
  onDeleteSchedule: (id: string) => void;
  onNavigateToAmbulance?: (orderId?: string) => void;
  onNavigateToClaims?: (claimId?: string) => void;
  onNavigateToInventory?: (scheduleId?: string) => void;
}

export const FuneralScheduleSection: React.FC<FuneralScheduleProps> = ({
  schedules = [],
  members = [],
  claims = [],
  ambulanceOrders = [],
  currentUser,
  settings,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onNavigateToAmbulance,
  onNavigateToClaims,
  onNavigateToInventory,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | FuneralStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FuneralSchedule | null>(null);
  const [copiedScheduleId, setCopiedScheduleId] = useState<string | null>(null);

  const isRt =
    currentUser?.authority === 'Ketua RT (Cluster)' ||
    currentUser?.authority === 'Ketua RT' ||
    Boolean(currentUser?.authority?.includes('RT'));
  const isBendahara = currentUser?.authority === 'Bendahara';
  const isAdmin = currentUser?.authority === 'Admin';
  const canManage = isRt || isAdmin || isBendahara || currentUser?.authority === 'Ketua DKM' || currentUser?.authority === 'Petugas Staf';

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: schedules.length,
      active: schedules.filter((s) => s.status === 'ACTIVE').length,
      upcoming: schedules.filter((s) => s.status === 'UPCOMING').length,
      past: schedules.filter((s) => s.status === 'PAST').length,
    };
  }, [schedules]);

  // Extract unique clusters
  const clusters = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => {
      if (s.cluster) set.add(s.cluster);
    });
    return Array.from(set);
  }, [schedules]);

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const matchTab = activeTab === 'ALL' || s.status === activeTab;
      const matchCluster = clusterFilter === 'ALL' || s.cluster === clusterFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.deceasedName.toLowerCase().includes(q) ||
        s.familyContactName.toLowerCase().includes(q) ||
        s.cluster.toLowerCase().includes(q) ||
        s.cemeteryName.toLowerCase().includes(q) ||
        s.coordinatorName.toLowerCase().includes(q) ||
        (s.scheduleCode && s.scheduleCode.toLowerCase().includes(q));

      return matchTab && matchCluster && matchSearch;
    });
  }, [schedules, activeTab, clusterFilter, searchQuery]);

  // Form State for Add / Edit
  const defaultFormData: Omit<FuneralSchedule, 'id'> = {
    scheduleCode: `JKM-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
    deceasedName: '',
    familyContactName: '',
    familyContactPhone: '',
    cluster: currentUser?.cluster || 'Cluster RT 01',
    status: 'ACTIVE',
    date: new Date().toISOString().split('T')[0],
    timeDeparture: '10:00 WIB',
    timePrayer: "Ba'da Sholat Dzuhur (12:30 WIB)",
    timeBurial: '13:30 WIB',
    homeAddress: '',
    prayerLocation: 'Masjid Jami Lingkungan',
    cemeteryName: 'TPU Muslim Lingkungan',
    cemeteryPlot: '',
    googleMapsUrl: '',
    coordinatorName: currentUser?.name || 'Ketua RT Setempat',
    coordinatorPhone: currentUser?.phone || '',
    coordinatorRole: isRt ? 'Ketua RT' : 'Koordinator Pemakaman',
    prayerImamName: 'Ustadz DKM Setempat',
    talkinOfficerName: 'Petugas Doa Paguyuban',
    bathingTeam: 'Tim Pemulasaraan Fardhu Kifayah Lingkungan',
    driverName: '',
    vehiclePlate: '',
    ambulanceStatus: 'Siaga',
    equipmentNeeded: ['Keranda Jenazah Stainless', 'Tenda Duka RT', 'Kursi Warga 50 Buah', 'Sound System', 'Bendera Kuning'],
    notes: 'Mohon warga membawa peralatan sholat dan membantu kelancaran prosesi fardhu kifayah.',
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };

  const [formData, setFormData] = useState<Omit<FuneralSchedule, 'id'>>(defaultFormData);

  // Auto-fill from selected member or claim
  const handleSelectMemberForSchedule = (memberId: string) => {
    const mem = members.find((m) => m.id === memberId);
    if (!mem) return;
    setFormData((prev) => ({
      ...prev,
      memberId: mem.id,
      memberNumber: mem.memberNumber,
      deceasedName: prev.deceasedName || `Almarhum/ah ${mem.name}`,
      familyContactName: mem.name,
      familyContactPhone: mem.phone || prev.familyContactPhone,
      cluster: mem.cluster || prev.cluster,
      homeAddress: mem.address ? `Blok ${mem.address}, ${mem.cluster || ''}` : prev.homeAddress,
    }));
  };

  const handleSelectClaimForSchedule = (claimId: string) => {
    const clm = claims.find((c) => c.id === claimId);
    if (!clm) return;
    const mem = members.find((m) => m.id === clm.memberId);
    setFormData((prev) => ({
      ...prev,
      claimId: clm.id,
      claimNumber: clm.claimNumber,
      deceasedName: clm.deceasedName,
      familyContactName: clm.memberName,
      familyContactPhone: mem?.phone || prev.familyContactPhone,
      cluster: clm.cluster || prev.cluster,
      homeAddress: mem?.address ? `Kediaman Almarhum/ah: ${mem.address}` : prev.homeAddress,
      notes: `Terhubung dengan Klaim Santunan Kematian RT (${clm.claimNumber}). Sebab wafat: ${clm.causeOfDeath || 'Sakit/Usia Lanjut'}.`,
    }));
  };

  const handleOpenAddModal = () => {
    setFormData({
      ...defaultFormData,
      scheduleCode: `JKM-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
      coordinatorName: currentUser?.name || 'Ketua RT Setempat',
      coordinatorPhone: currentUser?.phone || '',
      cluster: currentUser?.cluster || 'Cluster RT 01',
    });
    setEditingSchedule(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (sched: FuneralSchedule) => {
    setEditingSchedule(sched);
    setFormData({ ...sched });
    setShowAddModal(true);
  };

  const handleSubmitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.deceasedName.trim()) {
      alert('Nama almarhum/almarhumah wajib diisi!');
      return;
    }
    if (!formData.homeAddress.trim()) {
      alert('Alamat rumah duka wajib diisi!');
      return;
    }

    if (editingSchedule) {
      const updated: FuneralSchedule = {
        ...formData,
        id: editingSchedule.id,
        updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      onUpdateSchedule(updated);
    } else {
      const newSched: FuneralSchedule = {
        ...formData,
        id: `jkm-${Date.now()}`,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      onAddSchedule(newSched);
    }

    setShowAddModal(false);
    setEditingSchedule(null);
  };

  // Helper to copy WhatsApp broadcast message
  const handleCopyWhatsAppBroadcast = (sched: FuneralSchedule) => {
    const text = `*BERITA DUKA CITA & JADWAL PEMAKAMAN (FARDHU KIFAYAH)*
*${settings?.communityName || 'PAGUYUBAN DANA KEMATIAN'}*
====================================
_Innalillahi wa inna ilaihi raji'un_

Telah berpulang ke rahmatullah warga kita:
*${sched.deceasedName}*
Keluarga: *${sched.familyContactName}*
Lingkungan: *${sched.cluster}*

*RINCIAN LOGISTIK & PROSESI PEMAKAMAN:*
🗓️ *Hari/Tanggal:* ${sched.date}
🏠 *Rumah Duka:* ${sched.homeAddress}
⏱️ *Pelepasan Jenazah:* ${sched.timeDeparture || 'Sesuai kesiapan keluarga'}
🕌 *Sholat Jenazah:* ${sched.timePrayer || "Ba'da Sholat Fardhu"} di *${sched.prayerLocation}*
⚰️ *Imam Sholat:* ${sched.prayerImamName || 'Ustadz DKM Setempat'}
🪦 *Tempat Pemakaman:* ${sched.cemeteryName} ${sched.cemeteryPlot ? `(${sched.cemeteryPlot})` : ''}
⏰ *Waktu Pemakaman:* ${sched.timeBurial || '-'}

*KOORDINASI LAPANGAN & LOGISTIK:*
👤 *Koordinator RT/Fardhu Kifayah:* ${sched.coordinatorName}
📞 *Kontak Koordinator:* ${sched.coordinatorPhone || '-'}
🚑 *Armada Ambulans:* ${sched.driverName ? `${sched.driverName} (${sched.vehiclePlate || 'Unit Paguyuban'})` : 'Ambulans Jenazah Paguyuban'}
${sched.equipmentNeeded && sched.equipmentNeeded.length > 0 ? `📦 *Logistik Warga Disiapkan:* ${sched.equipmentNeeded.join(', ')}` : ''}

${sched.notes ? `*Catatan Tambahan:*\n${sched.notes}\n` : ''}
${sched.googleMapsUrl ? `📍 *Peta Lokasi:* ${sched.googleMapsUrl}\n` : ''}
Semoga almarhum/ah husnul khotimah, diampuni segala dosanya, dan keluarga yang ditinggalkan diberikan ketabahan serta keikhlasan. Aamiin ya Rabbal 'Alamin.`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedScheduleId(sched.id);
      setTimeout(() => setCopiedScheduleId(null), 3500);
    } else {
      alert('Teks siaran takziah telah disiapkan!');
    }
  };

  const getStatusBadge = (status: FuneralStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Sedang Berlangsung (Aktif)
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Akan Datang / Terjadwal
          </span>
        );
      case 'PAST':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
            Selesai (Riwayat)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Hero Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5" />
              <span>Pusat Koordinasi Fardhu Kifayah & Takziah Warga</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Jadwal Pemakaman & Logistik</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-slate-200 font-mono font-bold">
                {schedules.length} Agenda
              </span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Pantau jadwal prosesi pemakaman aktif, koordinasi logistik tenda/kursi RT, jam pelepasan jenazah, masjid sholat jenazah, serta armada ambulans secara terintegrasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg hover:shadow-emerald-500/20 transition-all transform active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Tambah Jadwal Pemakaman</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-400'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-400">Total Semua Agenda</div>
          <div className="text-2xl font-black mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Seluruh arsip layanan</div>
        </div>

        <div
          onClick={() => setActiveTab('ACTIVE')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'ACTIVE'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
              : 'bg-white text-slate-800 border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
            <span>Sedang Berlangsung</span>
            {stats.active > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>}
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-700">{stats.active}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Hari ini / prosesi aktif</div>
        </div>

        <div
          onClick={() => setActiveTab('UPCOMING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'UPCOMING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
              : 'bg-white text-slate-800 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="text-xs font-bold text-amber-600">Akan Datang / Siaga</div>
          <div className="text-2xl font-black mt-1 text-amber-700">{stats.upcoming}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Terjadwal esok / bertahap</div>
        </div>

        <div
          onClick={() => setActiveTab('PAST')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'PAST'
              ? 'bg-slate-700 text-white border-slate-700 shadow-md'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">Riwayat Selesai</div>
          <div className="text-2xl font-black mt-1 text-slate-700">{stats.past}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Prosesi rampung</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari almarhum, keluarga, TPU, RT, atau koordinator..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Semua Cluster / RT</option>
            {clusters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule Items List */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <Calendar className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">Tidak ada jadwal pemakaman yang cocok</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || clusterFilter !== 'ALL' || activeTab !== 'ALL'
              ? 'Coba atur ulang filter pencarian atau pilih tab status lain.'
              : 'Belum ada agenda pemakaman aktif saat ini. Seluruh warga dalam keadaan sehat wal afiat.'}
          </p>
          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              + Tambah Jadwal Pemakaman Baru
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSchedules.map((sched) => {
            const isCopied = copiedScheduleId === sched.id;
            return (
              <div
                key={sched.id}
                className={`bg-white rounded-3xl border transition-all shadow-xs hover:shadow-md overflow-hidden ${
                  sched.status === 'ACTIVE'
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                    : sched.status === 'UPCOMING'
                    ? 'border-amber-200'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Header bar of Card */}
                <div className="bg-slate-50/90 px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                      {sched.scheduleCode}
                    </span>
                    <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                      {sched.cluster}
                    </span>
                    {getStatusBadge(sched.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Broadcast WhatsApp button */}
                    <button
                      type="button"
                      onClick={() => handleCopyWhatsAppBroadcast(sched)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                      title="Salin pesan pengumuman takziah dan pemakaman siap kirim ke WhatsApp Group warga"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Salin Format WA Warga</span>
                        </>
                      )}
                    </button>

                    {/* Manage buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sched)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Rincian Logistik & Waktu"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Hapus jadwal pemakaman "${sched.deceasedName}"?`)) {
                              onDeleteSchedule(sched.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Body */}
                <div className="p-5 sm:p-6 space-y-6">
                  {/* Deceased & Family Banner */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Almarhum / Almarhumah:
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">
                        {sched.deceasedName}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                        <span>
                          Ahli Waris: <strong className="text-slate-800">{sched.familyContactName}</strong>
                        </span>
                        {sched.familyContactPhone && (
                          <a
                            href={`https://wa.me/${sched.familyContactPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WA Keluarga</span>
                          </a>
                        )}
                        {sched.memberNumber && (
                          <span className="font-mono text-slate-400">({sched.memberNumber})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {sched.ambulanceOrderId && (
                        <button
                          type="button"
                          onClick={() => onNavigateToAmbulance && onNavigateToAmbulance(sched.ambulanceOrderId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-bold cursor-pointer"
                        >
                          <Ambulance className="w-3.5 h-3.5 text-red-600" />
                          <span>Ambulans: {sched.ambulanceOrderCode || 'Aktif'}</span>
                        </button>
                      )}

                      {sched.claimNumber && (
                        <button
                          type="button"
                          onClick={() => onNavigateToClaims && onNavigateToClaims(sched.claimId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>Klaim Duka: {sched.claimNumber}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Step Process & Logistics Timeline Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Rumah Duka */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                        <MapPin className="w-4 h-4 text-indigo-600" />
                        <span>1. Rumah Duka</span>
                      </div>
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">
                        {sched.homeAddress}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Pelepasan: <strong className="text-slate-800">{sched.timeDeparture || '10:00 WIB'}</strong></span>
                      </div>
                    </div>

                    {/* 2. Sholat Jenazah */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                        <Heart className="w-4 h-4 text-emerald-600" />
                        <span>2. Sholat Jenazah</span>
                      </div>
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">
                        {sched.prayerLocation}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Waktu: <strong className="text-slate-800">{sched.timePrayer || "Ba'da Dzuhur"}</strong></span>
                      </div>
                      {sched.prayerImamName && (
                        <div className="text-[11px] text-slate-600">
                          Imam: <span className="font-semibold">{sched.prayerImamName}</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Armada & Fardhu Kifayah */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                        <Ambulance className="w-4 h-4 text-red-600" />
                        <span>3. Iring-iringan Ambulans</span>
                      </div>
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">
                        {sched.driverName
                          ? `${sched.driverName} (${sched.vehiclePlate || 'Unit Ambulans Paguyuban'})`
                          : 'Armada Ambulans Jenazah Paguyuban'}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span>Status: <strong className="text-red-700">{sched.ambulanceStatus || 'Siaga Melayani'}</strong></span>
                      </div>
                      {sched.bathingTeam && (
                        <div className="text-[11px] text-slate-600 truncate" title={sched.bathingTeam}>
                          Tim Mandi: <span className="font-semibold">{sched.bathingTeam}</span>
                        </div>
                      )}
                    </div>

                    {/* 4. Pemakaman di TPU */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
                        <Navigation className="w-4 h-4 text-purple-600" />
                        <span>4. Pemakaman TPU</span>
                      </div>
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">
                        {sched.cemeteryName}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Jam Makam: <strong className="text-slate-800">{sched.timeBurial || '13:30 WIB'}</strong></span>
                      </div>
                      {sched.cemeteryPlot && (
                        <div className="text-[11px] text-slate-600">
                          Kavling: <span className="font-mono font-bold text-slate-800">{sched.cemeteryPlot}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coordination & Logistik Warga Badges */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Koordinator Lapangan & Kontak Takziah:</span>
                      </div>
                      <div className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span>{sched.coordinatorName}</span>
                        {sched.coordinatorRole && (
                          <span className="text-xs font-normal text-slate-300">({sched.coordinatorRole})</span>
                        )}
                      </div>
                      {sched.notes && (
                        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed italic">
                          "{sched.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {sched.coordinatorPhone && (
                        <a
                          href={`https://wa.me/${sched.coordinatorPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Hubungi Koordinator</span>
                        </a>
                      )}

                      {sched.googleMapsUrl && (
                        <a
                          href={sched.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Peta Google Maps</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Equipment & Logistik Checklist badges */}
                  <div className="pt-2 space-y-3">
                    {sched.equipmentNeeded && sched.equipmentNeeded.length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Kebutuhan Logistik Lapangan:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sched.equipmentNeeded.map((eq, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{eq}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Modul Inventaris Duka Direct Integration */}
                    <div className="bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-teal-600 text-white shrink-0">
                          <Boxes className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-teal-950 dark:text-teal-200">
                            Inventaris Peralatan Duka Paguyuban
                          </div>
                          <p className="text-[11px] text-teal-700 dark:text-teal-400">
                            {sched.allocatedInventorySummary
                              ? `Teralokasi: ${sched.allocatedInventorySummary}`
                              : 'Alokasikan tenda, kursi, keranda & perlengkapan mandi dari gudang untuk prosesi ini.'}
                          </p>
                        </div>
                      </div>

                      {onNavigateToInventory && (
                        <button
                          type="button"
                          onClick={() => onNavigateToInventory(sched.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                        >
                          <span>{sched.allocatedInventorySummary ? 'Kelola Alokasi' : 'Alokasikan Peralatan'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT JADWAL PEMAKAMAN */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <span>{editingSchedule ? 'Perbarui Jadwal Pemakaman' : 'Tambah Jadwal Pemakaman Baru'}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Koordinasikan logistik pelepasan, sholat jenazah, ambulans, dan pemakaman di TPU.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="space-y-4">
              {/* Auto-fill from Death Claim or Member */}
              {!editingSchedule && (
                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Auto-Fill Cepat dari Pengajuan Klaim Duka RT / Data Anggota:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {claims.length > 0 && (
                      <select
                        onChange={(e) => handleSelectClaimForSchedule(e.target.value)}
                        className="px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          -- Pilih dari Klaim Santunan RT --
                        </option>
                        {claims.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.claimNumber} - {c.deceasedName} ({c.cluster})
                          </option>
                        ))}
                      </select>
                    )}

                    <select
                      onChange={(e) => handleSelectMemberForSchedule(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        -- Pilih dari Data Anggota --
                      </option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.memberNumber}) - {m.cluster}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Status & Kode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Prosesi Pemakaman <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as FuneralStatus }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">🚨 SEDANG BERLANGSUNG (Hari Ini / Aktif)</option>
                    <option value="UPCOMING">⏰ AKAN DATANG / TERJADWAL (Esok / Siaga)</option>
                    <option value="PAST">✅ SELESAI (Riwayat Prosesi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wilayah / Cluster RT <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.cluster}
                    onChange={(e) => setFormData((p) => ({ ...p, cluster: e.target.value }))}
                    placeholder="Contoh: Cluster Sanur / RT 04"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Deceased & Family */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Almarhum / Almarhumah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.deceasedName}
                    onChange={(e) => setFormData((p) => ({ ...p, deceasedName: e.target.value }))}
                    placeholder="Contoh: Bpk. H. Sutrisno (68 thn)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Ahli Waris / Kontak Keluarga
                  </label>
                  <input
                    type="text"
                    value={formData.familyContactName}
                    onChange={(e) => setFormData((p) => ({ ...p, familyContactName: e.target.value }))}
                    placeholder="Contoh: Bpk. Budi Santoso"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Rumah Duka & Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Rumah Duka <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.homeAddress}
                    onChange={(e) => setFormData((p) => ({ ...p, homeAddress: e.target.value }))}
                    placeholder="Blok S-12 No. 04, Cluster Sanur"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pemakaman
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Waktu & Lokasi Sholat & TPU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Pelepasan Rumah Duka
                  </label>
                  <input
                    type="text"
                    value={formData.timeDeparture}
                    onChange={(e) => setFormData((p) => ({ ...p, timeDeparture: e.target.value }))}
                    placeholder="10:00 WIB"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Sholat Jenazah
                  </label>
                  <input
                    type="text"
                    value={formData.timePrayer}
                    onChange={(e) => setFormData((p) => ({ ...p, timePrayer: e.target.value }))}
                    placeholder="Ba'da Dzuhur (12:30 WIB)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Pemakaman di TPU
                  </label>
                  <input
                    type="text"
                    value={formData.timeBurial}
                    onChange={(e) => setFormData((p) => ({ ...p, timeBurial: e.target.value }))}
                    placeholder="13:30 WIB"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lokasi Sholat Jenazah (Masjid/Musholla)
                  </label>
                  <input
                    type="text"
                    value={formData.prayerLocation}
                    onChange={(e) => setFormData((p) => ({ ...p, prayerLocation: e.target.value }))}
                    placeholder="Masjid Jami Al-Ikhlas"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama TPU & Kavling Makam
                  </label>
                  <input
                    type="text"
                    value={formData.cemeteryName}
                    onChange={(e) => setFormData((p) => ({ ...p, cemeteryName: e.target.value }))}
                    placeholder="TPU Giri Mulya (Kav. B-14)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Koordinator Lapangan & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Koordinator Lapangan / RT
                  </label>
                  <input
                    type="text"
                    value={formData.coordinatorName}
                    onChange={(e) => setFormData((p) => ({ ...p, coordinatorName: e.target.value }))}
                    placeholder="Ketua RT 04 / Bpk. Dicky"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. WhatsApp Koordinator
                  </label>
                  <input
                    type="text"
                    value={formData.coordinatorPhone}
                    onChange={(e) => setFormData((p) => ({ ...p, coordinatorPhone: e.target.value }))}
                    placeholder="081234567801"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan & Informasi Khusus Warga
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Informasi tambahan untuk warga yang hendak bertakziah..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {editingSchedule ? 'Simpan Perubahan' : 'Terbitkan Jadwal Pemakaman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
