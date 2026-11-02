import React, { useState, useMemo } from 'react';
import {
  Member,
  AppUser,
  SystemSettings,
  AmbulanceOrder,
  AmbulanceServiceType,
  AmbulanceUrgency,
  AmbulanceOrderStatus,
  AmbulanceVehicle,
  AmbulanceDriver,
  DEFAULT_AMBULANCE_VEHICLES,
  DEFAULT_AMBULANCE_DRIVERS,
} from '../types';
import { formatIDR } from '../lib/storage';
import {
  Ambulance,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  MapPin,
  Calendar,
  Plus,
  Search,
  Filter,
  Check,
  X,
  FileText,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building,
  UserCheck,
  Navigation,
  Car,
  Fuel,
  HeartHandshake,
  Activity,
  AlertCircle,
  Eye,
  Trash2,
  Share2,
} from 'lucide-react';

interface AmbulanceManagementProps {
  orders: AmbulanceOrder[];
  members: Member[];
  currentUser: AppUser | null;
  settings: SystemSettings;
  onAddOrder: (order: AmbulanceOrder) => void;
  onUpdateOrder: (order: AmbulanceOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onSwitchUser?: (user: AppUser) => void;
  availableUsers?: AppUser[];
}

export const AmbulanceManagement: React.FC<AmbulanceManagementProps> = ({
  orders,
  members,
  currentUser,
  settings,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onSwitchUser,
  availableUsers = [],
}) => {
  // State for tabs & filters
  const [activeTab, setActiveTab] = useState<'orders' | 'fleet' | 'guide'>('orders');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [showDriverResponseModal, setShowDriverResponseModal] = useState<boolean>(false);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showSuratJalanModal, setShowSuratJalanModal] = useState<boolean>(false);

  // Selected Order for Modal actions
  const [selectedOrder, setSelectedOrder] = useState<AmbulanceOrder | null>(null);

  // Vehicles and Drivers registry
  const [vehicles] = useState<AmbulanceVehicle[]>(DEFAULT_AMBULANCE_VEHICLES);
  const [drivers] = useState<AmbulanceDriver[]>(DEFAULT_AMBULANCE_DRIVERS);

  // Form states for Create Request (RT)
  const [formData, setFormData] = useState({
    serviceType: 'KEMATIAN' as AmbulanceServiceType,
    urgency: 'DARURAT_TINGGI' as AmbulanceUrgency,
    memberId: '',
    patientName: '',
    patientStatus: 'ANGGOTA' as 'ANGGOTA' | 'KELUARGA' | 'WARGA',
    clusterName: currentUser?.cluster || (currentUser as any)?.clusterName || (members[0]?.cluster || 'RT 01'),
    pickupAddress: '',
    pickupContactName: '',
    pickupContactPhone: '',
    destinationAddress: '',
    destinationContactName: '',
    destinationContactPhone: '',
    equipmentNeeded: ['Keranda Jenazah', 'Kain Penutup'],
    notes: '',
  });

  // Approval Form states (Bendahara)
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [fuelSubsidyAmount, setFuelSubsidyAmount] = useState<number>(100000);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Assignment Form states (Petugas Staf)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '');
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');

  // Driver response state
  const [driverAction, setDriverAction] = useState<'ACCEPT' | 'REJECT'>('ACCEPT');
  const [driverDeclineReason, setDriverDeclineReason] = useState<string>('');

  // Next status action state
  const [nextTripStatus, setNextTripStatus] = useState<AmbulanceOrderStatus>('MENUJU_LOKASI');
  const [tripNotes, setTripNotes] = useState<string>('');

  // Role detection
  const userAuthority = currentUser?.authority || 'Anggota';
  const isRT = userAuthority === 'Ketua RT (Cluster)' || userAuthority === 'Ketua RT' || userAuthority.includes('RT');
  const isBendahara = userAuthority === 'Bendahara' || userAuthority === 'Admin' || userAuthority === 'Ketua Paguyuban';
  const isStaf = userAuthority === 'Petugas Staf' || userAuthority === 'Admin' || userAuthority === 'Ketua Paguyuban';
  const isDriver = userAuthority === 'Driver' || userAuthority === 'Admin';
  const isAdmin = userAuthority === 'Admin' || userAuthority === 'Ketua Paguyuban';

  // Compute status metrics
  const stats = useMemo(() => {
    const total = orders.length;
    const pendingBendahara = orders.filter((o) => o.status === 'MENUNGGU_BENDAHARA').length;
    const pendingStaf = orders.filter(
      (o) => o.status === 'DISETUJUI_BENDAHARA' || o.status === 'PENUGASAN_ULANG_STAF'
    ).length;
    const pendingDriver = orders.filter((o) => o.status === 'MENUNGGU_KONFIRMASI_DRIVER').length;
    const inProgress = orders.filter(
      (o) => o.status === 'DRIVER_BERSIAP' || o.status === 'MENUJU_LOKASI' || o.status === 'MEMBAWA_PASIEN'
    ).length;
    const completed = orders.filter((o) => o.status === 'SELESAI').length;

    return { total, pendingBendahara, pendingStaf, pendingDriver, inProgress, completed };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (filterStatus === 'pending_bendahara' && order.status !== 'MENUNGGU_BENDAHARA') return false;
      if (filterStatus === 'pending_staf' && order.status !== 'DISETUJUI_BENDAHARA' && order.status !== 'PENUGASAN_ULANG_STAF') return false;
      if (filterStatus === 'pending_driver' && order.status !== 'MENUNGGU_KONFIRMASI_DRIVER') return false;
      if (filterStatus === 'active' && !['DRIVER_BERSIAP', 'MENUJU_LOKASI', 'MEMBAWA_PASIEN'].includes(order.status)) return false;
      if (filterStatus === 'completed' && order.status !== 'SELESAI') return false;
      if (filterStatus === 'rejected' && !['DITOLAK_BENDAHARA', 'DIBATALKAN'].includes(order.status)) return false;

      // Service type filter
      if (filterType !== 'all' && order.serviceType !== filterType) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = order.patientName.toLowerCase().includes(q);
        const matchCode = order.orderCode.toLowerCase().includes(q);
        const matchRT = order.clusterName.toLowerCase().includes(q);
        const matchDest = order.destinationAddress.toLowerCase().includes(q);
        const matchDriver = order.driverName?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchRT && !matchDest && !matchDriver) return false;
      }

      return true;
    });
  }, [orders, filterStatus, filterType, searchQuery]);

  // Handle member selection in Create Form
  const handleMemberSelect = (memberId: string) => {
    if (!memberId) {
      setFormData((prev) => ({
        ...prev,
        memberId: '',
        patientName: '',
        patientStatus: 'WARGA',
      }));
      return;
    }
    const selected = members.find((m) => m.id === memberId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        memberId: selected.id,
        patientName: selected.name || (selected as any).fullName || '',
        patientStatus: 'ANGGOTA',
        clusterName: selected.cluster || prev.clusterName,
        pickupAddress: selected.address || prev.pickupAddress,
        pickupContactName: selected.name || (selected as any).fullName || '',
        pickupContactPhone: selected.phone || prev.pickupContactPhone,
      }));
    }
  };

  // Toggle equipment needed
  const toggleEquipment = (eq: string) => {
    setFormData((prev) => {
      const exists = prev.equipmentNeeded.includes(eq);
      return {
        ...prev,
        equipmentNeeded: exists
          ? prev.equipmentNeeded.filter((item) => item !== eq)
          : [...prev.equipmentNeeded, eq],
      };
    });
  };

  // Generate new unique Order Code
  const generateOrderCode = () => {
    const year = new Date().getFullYear();
    const count = orders.length + 1;
    return `AMB-${year}-${String(count).padStart(3, '0')}`;
  };

  // Submit Create Request (RT)
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName.trim()) {
      alert('Mohon masukkan nama pasien atau jenazah.');
      return;
    }
    if (!formData.pickupAddress.trim()) {
      alert('Mohon masukkan alamat penjemputan.');
      return;
    }
    if (!formData.destinationAddress.trim()) {
      alert('Mohon masukkan alamat tujuan pengantaran.');
      return;
    }

    const newOrder: AmbulanceOrder = {
      id: `amb-${Date.now()}`,
      orderCode: generateOrderCode(),
      serviceType: formData.serviceType,
      urgency: formData.urgency,
      status: 'MENUNGGU_BENDAHARA',
      patientName: formData.patientName,
      patientStatus: formData.patientStatus,
      memberId: formData.memberId || undefined,
      clusterName: formData.clusterName,
      rtSubmittingUserId: currentUser?.id || 'usr-rt-01',
      rtSubmittingUserName: currentUser?.name || (currentUser as any)?.fullName || 'Ketua RT 01',
      pickupAddress: formData.pickupAddress,
      pickupContactName: formData.pickupContactName || formData.patientName,
      pickupContactPhone: formData.pickupContactPhone,
      destinationAddress: formData.destinationAddress,
      destinationContactName: formData.destinationContactName,
      destinationContactPhone: formData.destinationContactPhone,
      equipmentNeeded: formData.equipmentNeeded,
      notes: formData.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddOrder(newOrder);
    setShowCreateModal(false);

    // Reset form
    setFormData({
      serviceType: 'KEMATIAN',
      urgency: 'DARURAT_TINGGI',
      memberId: '',
      patientName: '',
      patientStatus: 'ANGGOTA',
      clusterName: currentUser?.cluster || (currentUser as any)?.clusterName || 'RT 01',
      pickupAddress: '',
      pickupContactName: '',
      pickupContactPhone: '',
      destinationAddress: '',
      destinationContactName: '',
      destinationContactPhone: '',
      equipmentNeeded: ['Keranda Jenazah', 'Kain Penutup'],
      notes: '',
    });
  };

  // Submit Approval (Bendahara)
  const handleApproveByBendahara = (approve: boolean) => {
    if (!selectedOrder) return;
    const now = new Date().toISOString();

    const updated: AmbulanceOrder = {
      ...selectedOrder,
      status: approve ? 'DISETUJUI_BENDAHARA' : 'DITOLAK_BENDAHARA',
      treasurerApprovedAt: approve ? now : undefined,
      treasurerApprovedBy: approve ? (currentUser?.name || (currentUser as any)?.fullName || 'Bendahara Paguyuban') : undefined,
      treasurerNotes: approvalNotes,
      fuelSubsidyAmount: approve ? fuelSubsidyAmount : 0,
      rejectionReason: !approve ? (rejectionReason || 'Ditolak oleh Bendahara') : undefined,
      updatedAt: now,
    };

    onUpdateOrder(updated);
    setShowApprovalModal(false);
    setSelectedOrder(null);
    setApprovalNotes('');
    setRejectionReason('');
  };

  // Submit Driver Assignment (Petugas Staf)
  const handleAssignDriver = () => {
    if (!selectedOrder) return;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const driver = drivers.find((d) => d.id === selectedDriverId);

    if (!vehicle || !driver) {
      alert('Pilih armada kendaraan dan petugas driver.');
      return;
    }

    const now = new Date().toISOString();
    const updated: AmbulanceOrder = {
      ...selectedOrder,
      status: 'MENUNGGU_KONFIRMASI_DRIVER',
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plateNumber,
      vehicleModel: vehicle.model,
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      staffAssignedAt: now,
      staffAssignedBy: currentUser?.name || (currentUser as any)?.fullName || 'Petugas Staf Paguyuban',
      staffNotes: assignmentNotes,
      updatedAt: now,
    };

    onUpdateOrder(updated);
    setShowAssignModal(false);
    setSelectedOrder(null);
    setAssignmentNotes('');
  };

  // Submit Driver Response (Driver: Bisa / Tidak Bisa)
  const handleDriverResponse = () => {
    if (!selectedOrder) return;
    const now = new Date().toISOString();

    if (driverAction === 'ACCEPT') {
      const updated: AmbulanceOrder = {
        ...selectedOrder,
        status: 'DRIVER_BERSIAP',
        driverConfirmedAt: now,
        driverResponseNotes: 'Driver siap bertugas dan melakukan persiapan armada.',
        updatedAt: now,
      };
      onUpdateOrder(updated);
    } else {
      if (!driverDeclineReason.trim()) {
        alert('Mohon cantumkan alasan penolakan/ketidaksediaan bertugas.');
        return;
      }
      const updated: AmbulanceOrder = {
        ...selectedOrder,
        status: 'PENUGASAN_ULANG_STAF',
        driverConfirmedAt: undefined,
        driverResponseNotes: `Ditolak oleh driver (${selectedOrder.driverName}): ${driverDeclineReason}`,
        updatedAt: now,
      };
      onUpdateOrder(updated);
    }

    setShowDriverResponseModal(false);
    setSelectedOrder(null);
    setDriverDeclineReason('');
  };

  // Update Trip Progress (Driver / Staf)
  const handleUpdateTripProgress = () => {
    if (!selectedOrder) return;
    const now = new Date().toISOString();

    const updated: AmbulanceOrder = {
      ...selectedOrder,
      status: nextTripStatus,
      departureTime: nextTripStatus === 'MENUJU_LOKASI' && !selectedOrder.departureTime ? now : selectedOrder.departureTime,
      patientPickedUpTime: nextTripStatus === 'MEMBAWA_PASIEN' && !selectedOrder.patientPickedUpTime ? now : selectedOrder.patientPickedUpTime,
      completedAt: nextTripStatus === 'SELESAI' ? now : selectedOrder.completedAt,
      tripNotes: tripNotes ? `${selectedOrder.tripNotes ? selectedOrder.tripNotes + ' | ' : ''}${tripNotes}` : selectedOrder.tripNotes,
      updatedAt: now,
    };

    onUpdateOrder(updated);
    setShowStatusUpdateModal(false);
    setSelectedOrder(null);
    setTripNotes('');
  };

  // Helper for status badge presentation
  const renderStatusBadge = (status: AmbulanceOrderStatus) => {
    switch (status) {
      case 'MENUNGGU_BENDAHARA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            1. Menunggu Bendahara
          </span>
        );
      case 'DISETUJUI_BENDAHARA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Check className="w-3.5 h-3.5 text-blue-600" />
            2. Disetujui Bendahara (Butuh Staf)
          </span>
        );
      case 'DITOLAK_BENDAHARA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-500" />
            Ditolak Bendahara
          </span>
        );
      case 'MENUNGGU_KONFIRMASI_DRIVER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            3. Menunggu Konfirmasi Driver
          </span>
        );
      case 'PENUGASAN_ULANG_STAF':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-300">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600" />
            Driver Menolak (Tugaskan Ulang)
          </span>
        );
      case 'DRIVER_BERSIAP':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <Car className="w-3.5 h-3.5 text-teal-600" />
            4. Driver Siap / Bersiap
          </span>
        );
      case 'MENUJU_LOKASI':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Navigation className="w-3.5 h-3.5 text-cyan-600 animate-bounce" />
            5. Menuju Lokasi Jemput
          </span>
        );
      case 'MEMBAWA_PASIEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            <Ambulance className="w-3.5 h-3.5 text-violet-600" />
            6. Membawa Pasien/Jenazah
          </span>
        );
      case 'SELESAI':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            7. Pelayanan Selesai
          </span>
        );
      case 'DIBATALKAN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Dibatalkan
          </span>
        );
      default:
        return null;
    }
  };

  // WhatsApp link generator
  const getWhatsAppLink = (phone: string, text: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <Ambulance className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wide backdrop-blur-sm">
              <Activity className="w-3.5 h-3.5 animate-pulse text-amber-300" />
              LAYANAN TANGGAP DARURAT 24 JAM
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Pelayanan Ambulans Paguyuban
            </h1>
            <p className="text-rose-100 text-sm max-w-2xl leading-relaxed">
              Fasilitas siaga darurat fardhu kifayah antar jenazah & pasien rujukan sakit bagi warga dan anggota.
              Alur terintegrasi: <span className="font-semibold text-white">RT Mengajukan</span> →{' '}
              <span className="font-semibold text-white">Bendahara Menyetujui</span> →{' '}
              <span className="font-semibold text-white">Staf Memilih Driver</span> →{' '}
              <span className="font-semibold text-white">Driver Konfirmasi Bisa/Tidak</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setFormData({
                  serviceType: 'KEMATIAN',
                  urgency: 'DARURAT_TINGGI',
                  memberId: '',
                  patientName: '',
                  patientStatus: 'ANGGOTA',
                  clusterName: currentUser?.cluster || (currentUser as any)?.clusterName || 'RT 01',
                  pickupAddress: '',
                  pickupContactName: '',
                  pickupContactPhone: '',
                  destinationAddress: '',
                  destinationContactName: '',
                  destinationContactPhone: '',
                  equipmentNeeded: ['Keranda Jenazah', 'Kain Penutup'],
                  notes: '',
                });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-red-700 font-bold hover:bg-rose-50 transition-all shadow-lg hover:shadow-xl transform active:scale-95 text-sm"
            >
              <Plus className="w-5 h-5 text-red-600" />
              Pesan Ambulans Darurat (RT)
            </button>
          </div>
        </div>

        {/* Quick Role Switcher (Crucial for testability and seamless demo) */}
        {availableUsers.length > 0 && onSwitchUser && (
          <div className="mt-6 pt-5 border-t border-white/20 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-rose-200 font-medium">Beralih Cepat Peran Demo:</span>
            {availableUsers
              .filter((u) =>
                ['Ketua RT', 'Bendahara', 'Petugas Staf', 'Driver', 'Super Admin', 'Admin'].some((role) =>
                  u.authority?.includes(role)
                )
              )
              .slice(0, 8)
              .map((u) => {
                const isActive = currentUser?.id === u.id;
                const displayName = u.name || (u as any)?.fullName || 'Pengguna';
                const shortName = displayName.split(' ')[0] || displayName;
                return (
                  <button
                    key={u.id}
                    onClick={() => onSwitchUser(u)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white text-rose-800 font-bold shadow-md ring-2 ring-amber-300'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    <User className="w-3 h-3" />
                    <span>{u.authority}</span>
                    <span className="opacity-75 text-[10px]">({shortName})</span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div
          onClick={() => setFilterStatus('all')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-medium text-slate-400 mb-1">Semua Layanan</div>
          <div className="text-2xl font-black">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Total riwayat</div>
        </div>

        <div
          onClick={() => setFilterStatus('pending_bendahara')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'pending_bendahara'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-white text-slate-800 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 mb-1">
            <span>Menunggu Bendahara</span>
            {stats.pendingBendahara > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.pendingBendahara}</div>
          <div className="text-[11px] text-slate-500 mt-1">Persetujuan & BBM</div>
        </div>

        <div
          onClick={() => setFilterStatus('pending_staf')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'pending_staf'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white text-slate-800 border-blue-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-600 mb-1">
            <span>Butuh Penugasan Staf</span>
            {stats.pendingStaf > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            )}
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.pendingStaf}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pilih Driver & Mobil</div>
        </div>

        <div
          onClick={() => setFilterStatus('pending_driver')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'pending_driver'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
              : 'bg-white text-slate-800 border-indigo-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 mb-1">
            <span>Konfirmasi Driver</span>
            {stats.pendingDriver > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            )}
          </div>
          <div className="text-2xl font-black text-indigo-700">{stats.pendingDriver}</div>
          <div className="text-[11px] text-slate-500 mt-1">Bisa / Tidak</div>
        </div>

        <div
          onClick={() => setFilterStatus('active')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'active'
              ? 'bg-cyan-600 text-white border-cyan-600 shadow-md'
              : 'bg-white text-slate-800 border-cyan-200 hover:border-cyan-300'
          }`}
        >
          <div className="text-xs font-semibold text-cyan-600 mb-1">Sedang Bertugas</div>
          <div className="text-2xl font-black text-cyan-700">{stats.inProgress}</div>
          <div className="text-[11px] text-slate-500 mt-1">Perjalanan di jalan</div>
        </div>

        <div
          onClick={() => setFilterStatus('completed')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'completed'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white text-slate-800 border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-xs font-semibold text-emerald-600 mb-1">Selesai</div>
          <div className="text-2xl font-black text-emerald-700">{stats.completed}</div>
          <div className="text-[11px] text-slate-500 mt-1">Layanan tuntas</div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ambulance className="w-4 h-4" />
            Daftar Pemesanan & Alur Tugas
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 font-bold text-slate-600">
              {filteredOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'fleet'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            Armada Ambulans & Driver Siaga
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Bagan Alur 4 Tahap
          </button>
        </div>
      </div>

      {/* TAB 1: ORDERS LIST */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kode booking, nama pasien, RT, alamat tujuan, atau driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Semua Jenis Layanan</option>
                <option value="KEMATIAN">⚰️ Fardhu Kifayah / Jenazah</option>
                <option value="SAKIT">🏥 Pasien Sakit / Rujukan RS</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Semua Status</option>
                <option value="pending_bendahara">1. Menunggu Bendahara</option>
                <option value="pending_staf">2. Butuh Penugasan Staf</option>
                <option value="pending_driver">3. Menunggu Konfirmasi Driver</option>
                <option value="active">4. Sedang Dalam Perjalanan</option>
                <option value="completed">5. Selesai</option>
                <option value="rejected">Ditolak / Batal</option>
              </select>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Ambulance className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-lg">Tidak ada data pemesanan</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Belum ada pemesanan ambulans yang cocok dengan kriteria pencarian atau filter yang dipilih.
                </p>
              </div>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterType('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 rounded-lg"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isDeath = order.serviceType === 'KEMATIAN';
                const isMyDriverTask =
                  isDriver &&
                  (order.driverId === currentUser?.id ||
                    (order.driverName &&
                      currentUser?.name &&
                      order.driverName.toLowerCase().includes(currentUser.name.toLowerCase())));

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Header bar */}
                    <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-800">
                          {order.orderCode}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isDeath
                              ? 'bg-slate-900 text-white'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isDeath ? '⚰️ Jenazah / Fardhu Kifayah' : '🏥 Pasien Sakit / RS'}
                        </span>
                        {order.urgency === 'DARURAT_TINGGI' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" />
                            DARURAT TINGGI
                          </span>
                        )}
                        {order.claimNumber && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            <span>🏛️ Otomatis dari Klaim Duka RT ({order.claimNumber})</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {renderStatusBadge(order.status)}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
                      {/* Left: Patient & Route */}
                      <div className="md:col-span-5 space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Pasien / Jenazah
                          </div>
                          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                            {order.patientName}
                            <span className="text-xs px-2 py-0.5 font-normal rounded bg-slate-100 text-slate-600">
                              {order.clusterName} ({order.patientStatus})
                            </span>
                          </div>
                        </div>

                        {/* Route Details */}
                        <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-slate-800">Titik Jemput:</div>
                              <div>{order.pickupAddress}</div>
                              {order.pickupContactPhone && (
                                <div className="text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                                  <span>Kontak: {order.pickupContactName}</span> ({order.pickupContactPhone})
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                            <Navigation className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-slate-800">Tujuan Pengantaran:</div>
                              <div className="font-medium text-slate-900">{order.destinationAddress}</div>
                            </div>
                          </div>
                        </div>

                        {/* Equipment */}
                        {order.equipmentNeeded && order.equipmentNeeded.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {order.equipmentNeeded.map((eq, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium"
                              >
                                {eq}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Middle: Workflow Stage Summary */}
                      <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5 space-y-2.5 text-xs">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Perkembangan Alur Tugas
                        </div>

                        {/* Step 1: RT Submitter */}
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[10px]">
                            1
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Diajukan RT:</span>{' '}
                            <span className="text-slate-600">{order.rtSubmittingUserName} ({order.clusterName})</span>
                            <div className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleString('id-ID')}</div>
                          </div>
                        </div>

                        {/* Step 2: Bendahara */}
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] ${
                              order.treasurerApprovedAt
                                ? 'bg-emerald-100 text-emerald-700'
                                : order.status === 'DITOLAK_BENDAHARA'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            2
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Bendahara:</span>{' '}
                            {order.treasurerApprovedAt ? (
                              <span className="text-emerald-700 font-medium">
                                Disetujui (Subsidi BBM: {formatIDR(order.fuelSubsidyAmount || 0)})
                              </span>
                            ) : order.status === 'DITOLAK_BENDAHARA' ? (
                              <span className="text-rose-600 font-medium">Ditolak: {order.rejectionReason}</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Menunggu Verifikasi</span>
                            )}
                          </div>
                        </div>

                        {/* Step 3: Staf & Armada */}
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] ${
                              order.driverName
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            3
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Staf & Armada:</span>{' '}
                            {order.driverName ? (
                              <span className="text-slate-700">
                                <span className="font-bold text-slate-900">{order.driverName}</span> ({order.vehiclePlate} - {order.vehicleModel})
                              </span>
                            ) : (
                              <span className="text-slate-400">Belum ditugaskan staf</span>
                            )}
                          </div>
                        </div>

                        {/* Step 4: Konfirmasi Driver */}
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] ${
                              ['DRIVER_BERSIAP', 'MENUJU_LOKASI', 'MEMBAWA_PASIEN', 'SELESAI'].includes(order.status)
                                ? 'bg-emerald-100 text-emerald-700'
                                : order.status === 'PENUGASAN_ULANG_STAF'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            4
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Respon Driver:</span>{' '}
                            {order.status === 'MENUNGGU_KONFIRMASI_DRIVER' ? (
                              <span className="text-indigo-600 font-semibold animate-pulse">Menunggu respon driver...</span>
                            ) : order.status === 'PENUGASAN_ULANG_STAF' ? (
                              <span className="text-purple-700 font-medium">Driver Tidak Bisa ({order.driverResponseNotes})</span>
                            ) : ['DRIVER_BERSIAP', 'MENUJU_LOKASI', 'MEMBAWA_PASIEN', 'SELESAI'].includes(order.status) ? (
                              <span className="text-emerald-700 font-medium">Driver Bersedia & Siap</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions Column based on Role */}
                      <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          {/* Role 1: BENDAHARA APPROVAL BUTTON */}
                          {isBendahara && order.status === 'MENUNGGU_BENDAHARA' && (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setFuelSubsidyAmount(100000);
                                setApprovalNotes('Subsidi kas paguyuban telah diverifikasi.');
                                setShowApprovalModal(true);
                              }}
                              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Review & Setujui (Bendahara)
                            </button>
                          )}

                          {/* Role 2: STAF ASSIGN DRIVER BUTTON */}
                          {isStaf &&
                            (order.status === 'DISETUJUI_BENDAHARA' ||
                              order.status === 'PENUGASAN_ULANG_STAF') && (
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowAssignModal(true);
                                }}
                                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all"
                              >
                                <Car className="w-4 h-4" />
                                {order.status === 'PENUGASAN_ULANG_STAF'
                                  ? 'Tugaskan Driver Lain (Staf)'
                                  : 'Pilih Driver & Mobil (Staf)'}
                              </button>
                            )}

                          {/* Role 3: DRIVER CONFIRMATION BUTTON (Bisa / Tidak Bisa) */}
                          {(isDriver || isAdmin) &&
                            order.status === 'MENUNGGU_KONFIRMASI_DRIVER' && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Tugas Ditujukan ke Driver:
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setDriverAction('ACCEPT');
                                      setShowDriverResponseModal(true);
                                    }}
                                    className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Bisa / Siap
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setDriverAction('REJECT');
                                      setShowDriverResponseModal(true);
                                    }}
                                    className="py-2 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Tidak Bisa
                                  </button>
                                </div>
                              </div>
                            )}

                          {/* Role 4: ACTIVE TRIP STATUS UPDATE (Driver / Staf) */}
                          {['DRIVER_BERSIAP', 'MENUJU_LOKASI', 'MEMBAWA_PASIEN'].includes(
                            order.status
                          ) && (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                if (order.status === 'DRIVER_BERSIAP') {
                                  setNextTripStatus('MENUJU_LOKASI');
                                } else if (order.status === 'MENUJU_LOKASI') {
                                  setNextTripStatus('MEMBAWA_PASIEN');
                                } else if (order.status === 'MEMBAWA_PASIEN') {
                                  setNextTripStatus('SELESAI');
                                }
                                setShowStatusUpdateModal(true);
                              }}
                              className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all"
                            >
                              <Navigation className="w-4 h-4 animate-spin text-teal-200" />
                              Update Status Perjalanan
                            </button>
                          )}

                          {/* WhatsApp Shortcut to Patient/Family */}
                          {order.pickupContactPhone && (
                            <a
                              href={getWhatsAppLink(
                                order.pickupContactPhone,
                                `Halo Bpk/Ibu ${order.pickupContactName}, terkait permohonan Ambulans Paguyuban untuk pasien/jenazah ${order.patientName} (${order.orderCode}). Armada dan petugas kami sedang berkoordinasi.`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              Chat WA Keluarga Pasien
                            </a>
                          )}

                          {/* WhatsApp Shortcut to Driver if assigned */}
                          {order.driverPhone && (
                            <a
                              href={getWhatsAppLink(
                                order.driverPhone,
                                `Halo Driver ${order.driverName}, tugas pelayanan ambulans #${order.orderCode} untuk ${order.patientName}. Mohon konfirmasi kesiapan Anda.`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              <Phone className="w-3.5 h-3.5 text-blue-600" />
                              Chat WA Driver ({order.driverName})
                            </a>
                          )}
                        </div>

                        {/* Footer card actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDetailModal(true);
                            }}
                            className="font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>

                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowSuratJalanModal(true);
                            }}
                            className="font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Surat Jalan
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (confirm(`Hapus riwayat pemesanan ambulans ${order.orderCode}?`)) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600"
                              title="Hapus Pemesanan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* TAB 2: FLEET & DRIVERS */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vehicles Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-slate-800 text-base">Armada Ambulans Siaga</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {vehicles.length} Unit Armada
              </span>
            </div>

            <div className="space-y-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{v.name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {v.plateNumber} • {v.model}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        v.status === 'SIAGA'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : v.status === 'DALAM_TUGAS'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {v.status === 'SIAGA'
                        ? 'Siaga Siap Pakai'
                        : v.status === 'DALAM_TUGAS'
                        ? 'Sedang Bertugas'
                        : 'Dalam Servis'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600">
                    <span className="font-semibold">Fasilitas Khusus:</span> {(v.equipmentList || v.equipment || []).join(', ') || 'Standar Medis & Jenazah Paguyuban'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drivers Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Petugas Driver Siaga</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {drivers.length} Driver Terdaftar
              </span>
            </div>

            <div className="space-y-3">
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{d.name}</div>
                      <div className="text-xs text-slate-500">
                        {d.isPrimaryDriver ? 'Driver Utama' : 'Driver Cadangan'} • No SIM: {d.simType}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        d.status === 'SIAGA'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : d.status === 'BERTUGAS'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d.status === 'SIAGA' ? 'Siaga' : d.status === 'BERTUGAS' ? 'Sedang Bertugas' : 'Libur'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="font-mono text-slate-600">{d.phone}</span>
                    <a
                      href={getWhatsAppLink(d.phone, `Halo Bpk ${d.name}, cek kesiagaan ambulans paguyuban.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WORKFLOW GUIDE */}
      {activeTab === 'guide' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">
              SOP & Standar Alur Pelayanan Ambulans Paguyuban
            </h2>
            <p className="text-slate-500 text-sm">
              Panduan 4 tahap verifikasi dan pengiriman darurat sesuai ketentuan AD/ART paguyuban.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white font-black flex items-center justify-center text-sm">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Tahap 1: Pengajuan oleh RT</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ketua RT atau perwakilan lingkungan menginput data permohonan ambulans saat ada warga/anggota darurat
                kematian fardhu kifayah atau sakit kritis rujukan rumah sakit.
              </p>
              <div className="text-[11px] font-semibold text-red-700">Aktor: Ketua RT</div>
            </div>

            <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-black flex items-center justify-center text-sm">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Tahap 2: Persetujuan Bendahara</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bendahara memvalidasi status iuran anggota (layanan gratis/subsidi penuh bagi anggota aktif) dan
                menetapkan alokasi subsidi BBM operasional ambulans dari kas paguyuban.
              </p>
              <div className="text-[11px] font-semibold text-amber-700">Aktor: Bendahara</div>
            </div>

            <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Tahap 3: Penugasan Staf</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Petugas staf paguyuban memeriksa armada mobil yang siap (mobil jenazah APV atau ambulans medis HiAce)
                dan menunjuk petugas driver yang bertugas piket hari itu.
              </p>
              <div className="text-[11px] font-semibold text-blue-700">Aktor: Petugas Staf</div>
            </div>

            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm">
                4
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Tahap 4: Konfirmasi & Tugas Driver</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Driver yang ditunjuk mengonfirmasi <strong>Bisa</strong> (segera meluncur jemput) atau{' '}
                <strong>Tidak Bisa</strong> (menolak dengan alasan valid sehingga staf dapat menugaskan driver pengganti).
              </p>
              <div className="text-[11px] font-semibold text-emerald-700">Aktor: Driver Ambulans</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORM PENGAJUAN AMBULANS (RT) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ambulance className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">Pengajuan Layanan Ambulans Darurat (RT)</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/80 hover:text-white rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-sm">
              {/* Jenis Layanan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Jenis Kebutuhan Pelayanan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({
                        ...p,
                        serviceType: 'KEMATIAN',
                        equipmentNeeded: ['Keranda Jenazah', 'Kain Penutup'],
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      formData.serviceType === 'KEMATIAN'
                        ? 'border-red-600 bg-red-50/60 ring-2 ring-red-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">⚰️</span>
                    <div>
                      <div className="font-bold text-slate-900">Kematian / Jenazah</div>
                      <div className="text-xs text-slate-500">Fardhu kifayah, pemakaman & rumah duka</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({
                        ...p,
                        serviceType: 'SAKIT',
                        equipmentNeeded: ['Tabung Oksigen', 'Stretcher / Tandu Dorong'],
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      formData.serviceType === 'SAKIT'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">🏥</span>
                    <div>
                      <div className="font-bold text-slate-900">Anggota Sakit / Rujukan</div>
                      <div className="text-xs text-slate-500">Antar jemput pasien kritis IGD / RS</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Urgensi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tingkat Urgensi
                </label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData((p) => ({ ...p, urgency: e.target.value as AmbulanceUrgency }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-red-500"
                >
                  <option value="DARURAT_TINGGI">🚨 DARURAT TINGGI (Segera Meluncur / Emergency)</option>
                  <option value="SIAGA_TERJADWAL">⏰ SIAGA TERJADWAL (Sesuai Jam Pemakaman / Rujukan)</option>
                </select>
              </div>

              {/* Pilih Anggota (Opsional) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Pilih Data Anggota Terdaftar (Opsional):
                  </label>
                  <span className="text-[11px] text-slate-500">Auto-fill data alamat & kontak</span>
                </div>
                <select
                  value={formData.memberId}
                  onChange={(e) => handleMemberSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Pilih Anggota atau Isi Manual di Bawah --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || (m as any).fullName} ({(m as any).membershipNumber || m.memberNumber || m.id}) - {m.cluster || 'RT'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detail Pasien */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Pasien / Almarhum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.patientName}
                    onChange={(e) => setFormData((p) => ({ ...p, patientName: e.target.value }))}
                    placeholder="Contoh: Bpk. H. Sutrisno"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wilayah Lingkungan / RT <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clusterName}
                    onChange={(e) => setFormData((p) => ({ ...p, clusterName: e.target.value }))}
                    placeholder="Contoh: RT 01 / Blok Anggrek"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Titik Jemput */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  Lokasi Titik Jemput Pasien/Jenazah <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.pickupAddress}
                  onChange={(e) => setFormData((p) => ({ ...p, pickupAddress: e.target.value }))}
                  placeholder="Alamat lengkap penjemputan (Rumah duka / IGD RS / Alamat warga)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-red-500"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={formData.pickupContactName}
                      onChange={(e) => setFormData((p) => ({ ...p, pickupContactName: e.target.value }))}
                      placeholder="Nama Kontak Keluarga Penjemput"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.pickupContactPhone}
                      onChange={(e) => setFormData((p) => ({ ...p, pickupContactPhone: e.target.value }))}
                      placeholder="No. WhatsApp Keluarga (08... / 62...)"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Titik Tujuan */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  Lokasi Tujuan Pengantaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.destinationAddress}
                  onChange={(e) => setFormData((p) => ({ ...p, destinationAddress: e.target.value }))}
                  placeholder="Contoh: TPU Selapajang Jaya / RSUD Tangerang / Rumah Duka"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Fasilitas & Perlengkapan */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Peralatan yang Diperlukan:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Keranda Jenazah',
                    'Tabung Oksigen',
                    'Stretcher / Tandu Dorong',
                    'Kain Penutup',
                    'Kursi Roda',
                    'Payung & Terpal',
                  ].map((eq) => {
                    const isChecked = formData.equipmentNeeded.includes(eq);
                    return (
                      <button
                        type="button"
                        key={eq}
                        onClick={() => toggleEquipment(eq)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium text-left flex items-center justify-between ${
                          isChecked
                            ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>{eq}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-rose-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catatan Khusus */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan untuk Petugas
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Contoh: Jenazah rencana diberangkatkan bakda dzuhur..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md"
                >
                  Kirim Pengajuan ke Bendahara
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PERSETUJUAN BENDAHARA */}
      {/* ========================================================================= */}
      {showApprovalModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-base">Verifikasi & Persetujuan Bendahara</h3>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-amber-900">{selectedOrder.orderCode}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                    {selectedOrder.serviceType === 'KEMATIAN' ? 'Fardhu Kifayah Jenazah' : 'Pasien Sakit'}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  Pasien: {selectedOrder.patientName} ({selectedOrder.clusterName})
                </div>
                <div className="text-xs text-slate-600">
                  Titik Jemput: {selectedOrder.pickupAddress}
                </div>
                <div className="text-xs text-slate-600">
                  Tujuan: {selectedOrder.destinationAddress}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alokasi Subsidi Kas Paguyuban (BBM & Biaya Operasional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="25000"
                    value={fuelSubsidyAmount}
                    onChange={(e) => setFuelSubsidyAmount(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bagi anggota aktif, operasional disubsidi penuh dari dana sosial kematian kas paguyuban.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Bendahara (Disetujui)
                </label>
                <input
                  type="text"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Contoh: Anggota aktif, subsidi BBM Rp 100.000 dialokasikan..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2">
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-semibold text-rose-600 hover:text-rose-700">
                    Opsi Tolak Permohonan
                  </summary>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Masukkan alasan jika permohonan ditolak..."
                      className="w-full px-3 py-2 rounded-lg border border-rose-200 text-xs focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleApproveByBendahara(false)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                    >
                      Konfirmasi Tolak Pengajuan
                    </button>
                  </div>
                </details>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveByBendahara(true)}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Setujui & Teruskan ke Staf
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PENUGASAN DRIVER OLEH STAF */}
      {/* ========================================================================= */}
      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                <h3 className="font-bold text-base">Penugasan Armada & Driver (Petugas Staf)</h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-xs space-y-1">
                <div className="font-bold text-blue-900">
                  Target Pelayanan: {selectedOrder.patientName} ({selectedOrder.orderCode})
                </div>
                <div className="text-slate-600">
                  {selectedOrder.serviceType === 'KEMATIAN' ? '⚰️ Fardhu Kifayah Jenazah' : '🏥 Pasien Sakit'} • Tujuan: {selectedOrder.destinationAddress}
                </div>
                <div className="text-emerald-700 font-semibold mt-1">
                  Disetujui Bendahara (BBM: {formatIDR(selectedOrder.fuelSubsidyAmount || 0)})
                </div>
              </div>

              {/* Pilih Armada */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Armada Kendaraan Ambulans <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {vehicles.map((v) => (
                    <label
                      key={v.id}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedVehicleId === v.id
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="vehicle"
                          checked={selectedVehicleId === v.id}
                          onChange={() => setSelectedVehicleId(v.id)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{v.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {v.plateNumber} • {v.model}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {v.status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pilih Driver */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Driver yang Bertugas <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {drivers.map((d) => (
                    <label
                      key={d.id}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedDriverId === d.id
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="driver"
                          checked={selectedDriverId === d.id}
                          onChange={() => setSelectedDriverId(d.id)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{d.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            WA: {d.phone} • SIM: {d.simType}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {d.status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Catatan Penugasan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instruksi / Catatan Staf
                </label>
                <input
                  type="text"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Contoh: Harap jemput tepat pukul 13.00, koordinasi dg pak RT..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAssignDriver}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Kirim Penugasan ke Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: KONFIRMASI DRIVER (BISA / TIDAK BISA) */}
      {/* ========================================================================= */}
      {showDriverResponseModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div
              className={`px-6 py-4 flex items-center justify-between text-white ${
                driverAction === 'ACCEPT' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {driverAction === 'ACCEPT' ? 'Konfirmasi Kesiapan Driver' : 'Penolakan Penugasan Driver'}
                </h3>
              </div>
              <button
                onClick={() => setShowDriverResponseModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">
                  Tugas: #{selectedOrder.orderCode} - {selectedOrder.patientName}
                </div>
                <div className="text-slate-600">
                  Armada: {selectedOrder.vehiclePlate} ({selectedOrder.vehicleModel})
                </div>
                <div className="text-slate-600">
                  Jemput: {selectedOrder.pickupAddress}
                </div>
              </div>

              {driverAction === 'ACCEPT' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
                    Dengan menyetujui, Anda menyatakan <strong>BISA & SIAP BERTUGAS</strong> mengemudikan ambulans paguyuban untuk penjemputan ini.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Alasan Tidak Bisa / Menolak <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={driverDeclineReason}
                    onChange={(e) => setDriverDeclineReason(e.target.value)}
                    placeholder="Contoh: Sedang sakit mendadak / sedang di luar kota / ada rujukan medis darurat lain..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Status akan dialihkan kembali ke Petugas Staf untuk menunjuk driver cadangan lainnya.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDriverResponseModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDriverResponse}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-md text-white ${
                    driverAction === 'ACCEPT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {driverAction === 'ACCEPT' ? 'Saya Siap Bertugas' : 'Kirim Penolakan ke Staf'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: UPDATE STATUS PERJALANAN (DRIVER / STAF) */}
      {/* ========================================================================= */}
      {showStatusUpdateModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                <h3 className="font-bold text-base">Update Tahap Perjalanan Ambulans</h3>
              </div>
              <button
                onClick={() => setShowStatusUpdateModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Pilih Milestone / Status Saat Ini:
                </label>
                <div className="space-y-2">
                  {[
                    {
                      status: 'MENUJU_LOKASI' as AmbulanceOrderStatus,
                      label: '5. Meluncur ke Lokasi Jemput',
                      desc: 'Driver dan armada telah berangkat menuju alamat keluarga/pasien.',
                    },
                    {
                      status: 'MEMBAWA_PASIEN' as AmbulanceOrderStatus,
                      label: '6. Membawa Pasien/Jenazah',
                      desc: 'Tiba di lokasi, jenazah/pasien dinaikkan ke ambulans dan bergerak ke tujuan.',
                    },
                    {
                      status: 'SELESAI' as AmbulanceOrderStatus,
                      label: '7. Pelayanan Selesai & Kembali',
                      desc: 'Tiba di TPU/RS tujuan, serah terima selesai dan ambulans kembali ke pos.',
                    },
                  ].map((s) => (
                    <label
                      key={s.status}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        nextTripStatus === s.status
                          ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tripStatus"
                        checked={nextTripStatus === s.status}
                        onChange={() => setNextTripStatus(s.status)}
                        className="text-teal-600 focus:ring-teal-500 mt-1"
                      />
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{s.label}</div>
                        <div className="text-[11px] text-slate-500">{s.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Perjalanan (Opsional)
                </label>
                <input
                  type="text"
                  value={tripNotes}
                  onChange={(e) => setTripNotes(e.target.value)}
                  placeholder="Contoh: Terjebak macet sebentar di Jl. Daan Mogot..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStatusUpdateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUpdateTripProgress}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md"
                >
                  Simpan Status Perjalanan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DETAIL LENGKAP AUDIT PEMESANAN */}
      {/* ========================================================================= */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Detail Lengkap Pelayanan Ambulans</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Kode Pemesanan</div>
                  <div className="font-mono font-bold text-slate-900 text-base">{selectedOrder.orderCode}</div>
                </div>
                <div>{renderStatusBadge(selectedOrder.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold text-slate-500">Pasien/Jenazah</div>
                  <div className="font-bold text-slate-900 text-sm">{selectedOrder.patientName}</div>
                  <div className="text-slate-500">{selectedOrder.clusterName} ({selectedOrder.patientStatus})</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Jenis Layanan</div>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedOrder.serviceType === 'KEMATIAN' ? '⚰️ Fardhu Kifayah Jenazah' : '🏥 Pasien Sakit'}
                  </div>
                  <div className="text-slate-500">Urgensi: {selectedOrder.urgency}</div>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="font-bold text-slate-800">Alamat Jemput:</span> {selectedOrder.pickupAddress}
                </div>
                {selectedOrder.pickupContactPhone && (
                  <div>
                    <span className="font-bold text-slate-800">Kontak Jemput:</span> {selectedOrder.pickupContactName} ({selectedOrder.pickupContactPhone})
                  </div>
                )}
                <div>
                  <span className="font-bold text-slate-800">Alamat Tujuan:</span> {selectedOrder.destinationAddress}
                </div>
              </div>

              {/* Log Timeline */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Audit Jejak Waktu & Tanggung Jawab:
                </div>
                <div className="space-y-1.5 text-slate-600">
                  <div>• Diajukan oleh: {selectedOrder.rtSubmittingUserName} ({selectedOrder.createdAt})</div>
                  {selectedOrder.treasurerApprovedAt && (
                    <div>• Disetujui Bendahara: {selectedOrder.treasurerApprovedBy} ({selectedOrder.treasurerApprovedAt}) - Subsidi: {formatIDR(selectedOrder.fuelSubsidyAmount || 0)}</div>
                  )}
                  {selectedOrder.staffAssignedAt && (
                    <div>• Ditugaskan Staf: {selectedOrder.staffAssignedBy} ({selectedOrder.staffAssignedAt}) → Mobil: {selectedOrder.vehiclePlate}, Driver: {selectedOrder.driverName}</div>
                  )}
                  {selectedOrder.driverConfirmedAt && (
                    <div>• Driver Konfirmasi: {selectedOrder.driverConfirmedAt} ({selectedOrder.driverResponseNotes})</div>
                  )}
                  {selectedOrder.departureTime && (
                    <div>• Driver Berangkat Menuju Lokasi: {selectedOrder.departureTime}</div>
                  )}
                  {selectedOrder.patientPickedUpTime && (
                    <div>• Pasien/Jenazah Naik Ambulans: {selectedOrder.patientPickedUpTime}</div>
                  )}
                  {selectedOrder.completedAt && (
                    <div className="font-bold text-emerald-700">• Pelayanan Tuntas Selesai: {selectedOrder.completedAt}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: SURAT JALAN & TUGAS RESMI AMBULANS (PRINTABLE) */}
      {/* ========================================================================= */}
      {showSuratJalanModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Surat Jalan Pelayanan Ambulans</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Simpan PDF
                </button>
                <button
                  onClick={() => setShowSuratJalanModal(false)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 space-y-6 text-slate-800 font-sans text-xs">
              {/* Kop Surat */}
              <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
                <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                  {settings.organizationName || 'PAGUYUBAN DANA KEMATIAN WARGA'}
                </h2>
                <div className="text-xs font-semibold text-slate-700 uppercase">
                  UNIT PELAYANAN AMBULANS SIAGA 24 JAM
                </div>
                <div className="text-[11px] text-slate-500">
                  Sekretariat: {settings.contactAddress || 'Pondok Sejahtera, Tangerang'} • Telp/WA:{' '}
                  {settings.contactPhone || '0812-3456-7890'}
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="font-black text-sm uppercase underline decoration-2">
                  SURAT TUGAS & JALAN AMBULANS
                </div>
                <div className="font-mono text-xs text-slate-600">
                  Nomor: ST-AMB/{selectedOrder.orderCode}/{new Date().getFullYear()}
                </div>
              </div>

              <div className="space-y-2 leading-relaxed">
                <p>
                  Yang bertanda tangan di bawah ini Pengurus Paguyuban memberikan tugas pelayanan ambulans siaga kepada:
                </p>

                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="w-40 py-1 font-semibold text-slate-600">Nama Petugas Driver:</td>
                      <td className="font-bold text-slate-900">{selectedOrder.driverName || 'Petugas Siaga'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold text-slate-600">Armada Ambulans:</td>
                      <td className="font-bold text-slate-900">{selectedOrder.vehiclePlate} ({selectedOrder.vehicleModel})</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold text-slate-600">Jenis Layanan:</td>
                      <td className="font-bold text-slate-900">
                        {selectedOrder.serviceType === 'KEMATIAN'
                          ? 'Pelayanan Antar Jenazah / Fardhu Kifayah'
                          : 'Rujukan Medis / Pasien Sakit'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold text-slate-600">Nama Pasien/Jenazah:</td>
                      <td className="font-bold text-slate-900">{selectedOrder.patientName} ({selectedOrder.clusterName})</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold text-slate-600">Lokasi Penjemputan:</td>
                      <td className="text-slate-800">{selectedOrder.pickupAddress}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold text-slate-600">Lokasi Tujuan:</td>
                      <td className="text-slate-800">{selectedOrder.destinationAddress}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold text-slate-600">Alokasi Subsidi BBM Kas:</td>
                      <td className="font-bold text-emerald-800">{formatIDR(selectedOrder.fuelSubsidyAmount || 0)}</td>
                    </tr>
                  </tbody>
                </table>

                <p className="pt-2 text-slate-600 italic text-[11px]">
                  Kepada pihak keluarga, aparat kepolisian, dinas perhubungan, pengelola jalan tol, dan rumah sakit mohon
                  dapat memberikan kelancaran dan bantuan kepada petugas kami dalam menjalankan tugas kemanusiaan ini.
                </p>
              </div>

              {/* Tanda Tangan */}
              <div className="pt-8 grid grid-cols-3 text-center text-xs">
                <div>
                  <div className="text-slate-500 mb-12">Ketua RT Pemohon</div>
                  <div className="font-bold text-slate-900 border-b border-slate-400 pb-0.5 inline-block">
                    {selectedOrder.rtSubmittingUserName}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 mb-12">Bendahara Paguyuban</div>
                  <div className="font-bold text-slate-900 border-b border-slate-400 pb-0.5 inline-block">
                    {selectedOrder.treasurerApprovedBy || 'Bendahara'}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 mb-12">Driver Bertugas</div>
                  <div className="font-bold text-slate-900 border-b border-slate-400 pb-0.5 inline-block">
                    {selectedOrder.driverName || 'Driver Ambulans'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
