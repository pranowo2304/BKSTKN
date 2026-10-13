import { AppUser, Member, SystemSettings, ClusterType } from '../types';
import { cleanPhoneNumberForWhatsApp, formatPhoneDisplay } from './receiptUtils';

export interface AdminContact {
  id: string;
  name: string;
  role: string;
  authority: string;
  phone: string;
  cleanPhone: string;
  displayPhone: string;
  cluster?: string;
  description: string;
  isPrimary?: boolean;
  avatarColor?: string;
}

export type MessageTopic = 'iuran' | 'duka' | 'keluarga' | 'verifikasi' | 'umum';

/**
 * Returns prioritized admin and management contacts based on active registered users and system settings.
 */
export const getAdminContacts = (
  users: AppUser[] = [],
  settings?: SystemSettings,
  memberCluster?: ClusterType | string
): AdminContact[] => {
  const contacts: AdminContact[] = [];

  // 1. Super Admin / Admin Utama
  const primaryAdmin = users.find((u) => u.authority === 'Admin' && u.phone && u.status !== 'Non-Aktif');
  if (primaryAdmin && primaryAdmin.phone) {
    contacts.push({
      id: primaryAdmin.id,
      name: primaryAdmin.name,
      role: 'Admin Utama Paguyuban',
      authority: 'Admin',
      phone: primaryAdmin.phone,
      cleanPhone: cleanPhoneNumberForWhatsApp(primaryAdmin.phone),
      displayPhone: formatPhoneDisplay(primaryAdmin.phone),
      description: 'Pusat bantuan sistem, administrasi data, dan pertanyaan umum',
      isPrimary: true,
      avatarColor: primaryAdmin.avatarColor || 'bg-indigo-600',
    });
  } else if (settings?.treasurerPhone) {
    // Fallback if no admin user found
    contacts.push({
      id: 'admin-fallback',
      name: 'Sekretariat / Admin Paguyuban',
      role: 'Admin Utama Paguyuban',
      authority: 'Admin',
      phone: settings.treasurerPhone,
      cleanPhone: cleanPhoneNumberForWhatsApp(settings.treasurerPhone),
      displayPhone: formatPhoneDisplay(settings.treasurerPhone),
      description: 'Layanan administrasi dan informasi paguyuban',
      isPrimary: true,
      avatarColor: 'bg-indigo-600',
    });
  }

  // 2. Bendahara Paguyuban (Kas & Verifikasi Pembayaran)
  const treasurerUser = users.find((u) => u.authority === 'Bendahara' && u.phone && u.status !== 'Non-Aktif');
  const treasurerPhone = treasurerUser?.phone || settings?.treasurerPhone || '';
  const treasurerName = treasurerUser?.name || settings?.treasurerName || 'Bendahara Paguyuban';

  if (treasurerPhone) {
    contacts.push({
      id: treasurerUser ? treasurerUser.id : 'contact-bendahara',
      name: treasurerName,
      role: 'Bendahara Kas Paguyuban',
      authority: 'Bendahara',
      phone: treasurerPhone,
      cleanPhone: cleanPhoneNumberForWhatsApp(treasurerPhone),
      displayPhone: formatPhoneDisplay(treasurerPhone),
      description: 'Konfirmasi pembayaran iuran, rekening kas, dan kwitansi',
      avatarColor: treasurerUser?.avatarColor || 'bg-emerald-600',
    });
  }

  // 3. Ketua RT Cluster Setempat (Prioritized matching member's cluster!)
  if (memberCluster) {
    const rtUser = users.find(
      (u) =>
        u.authority === 'Ketua RT (Cluster)' &&
        u.cluster &&
        u.cluster.toLowerCase() === memberCluster.toLowerCase() &&
        u.phone &&
        u.status !== 'Non-Aktif'
    );

    if (rtUser && rtUser.phone) {
      contacts.push({
        id: rtUser.id,
        name: rtUser.name,
        role: `Ketua RT ${memberCluster}`,
        authority: 'Ketua RT (Cluster)',
        phone: rtUser.phone,
        cleanPhone: cleanPhoneNumberForWhatsApp(rtUser.phone),
        displayPhone: formatPhoneDisplay(rtUser.phone),
        cluster: memberCluster,
        description: `Verifikasi pendaftaran warga & domisili di wilayah ${memberCluster}`,
        avatarColor: rtUser.avatarColor || 'bg-amber-600',
      });
    }
  }

  // 4. Other Ketua RT (if not matching or all)
  users
    .filter(
      (u) =>
        u.authority === 'Ketua RT (Cluster)' &&
        u.phone &&
        u.status !== 'Non-Aktif' &&
        (!memberCluster || u.cluster?.toLowerCase() !== memberCluster.toLowerCase())
    )
    .slice(0, 2)
    .forEach((u) => {
      if (u.phone) {
        contacts.push({
          id: u.id,
          name: u.name,
          role: `Ketua RT ${u.cluster || ''}`,
          authority: 'Ketua RT (Cluster)',
          phone: u.phone,
          cleanPhone: cleanPhoneNumberForWhatsApp(u.phone),
          displayPhone: formatPhoneDisplay(u.phone),
          cluster: u.cluster,
          description: `Pengurus RT ${u.cluster || ''}`,
          avatarColor: u.avatarColor || 'bg-teal-600',
        });
      }
    });

  // 5. Ketua DKM / Pelayanan Fardhu Kifayah & Santunan Duka
  const dkmUser = users.find((u) => u.authority === 'Ketua DKM' && u.phone && u.status !== 'Non-Aktif');
  if (dkmUser && dkmUser.phone) {
    contacts.push({
      id: dkmUser.id,
      name: dkmUser.name,
      role: 'Ketua DKM / Pelayanan Fardhu Kifayah',
      authority: 'Ketua DKM',
      phone: dkmUser.phone,
      cleanPhone: cleanPhoneNumberForWhatsApp(dkmUser.phone),
      displayPhone: formatPhoneDisplay(dkmUser.phone),
      description: 'Layanan pemulasaraan jenazah, kain kafan, dan ambulans duka',
      avatarColor: dkmUser.avatarColor || 'bg-green-700',
    });
  }

  // 6. Ketua RW
  const rwUser = users.find((u) => u.authority === 'Ketua RW' && u.phone && u.status !== 'Non-Aktif');
  if (rwUser && rwUser.phone) {
    contacts.push({
      id: rwUser.id,
      name: rwUser.name,
      role: 'Ketua RW 05 (Pengawas Paguyuban)',
      authority: 'Ketua RW',
      phone: rwUser.phone,
      cleanPhone: cleanPhoneNumberForWhatsApp(rwUser.phone),
      displayPhone: formatPhoneDisplay(rwUser.phone),
      description: 'Pengawasan dan koordinasi santunan duka tingkat RW',
      avatarColor: rwUser.avatarColor || 'bg-purple-600',
    });
  }

  return contacts;
};

/**
 * Builds pre-formatted WhatsApp message for a member contacting an admin.
 */
export const buildAdminContactMessage = (
  topic: MessageTopic,
  member: Member | null | undefined,
  admin: AdminContact,
  customNote?: string,
  settings?: SystemSettings
): string => {
  const memberName = member?.name || 'Warga Paguyuban';
  const memberNumber = member?.memberNumber || '-';
  const cluster = member?.cluster || '-';
  const address = member?.address ? ` (Alamat: ${member.address})` : '';
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian';

  let topicTitle = 'Konsultasi / Pertanyaan Umum';
  let bodyContent = '';

  switch (topic) {
    case 'iuran':
      topicTitle = 'Konfirmasi / Pertanyaan Pembayaran Iuran Kas';
      bodyContent = `Saya ingin mengonfirmasi / menanyakan perihal pembayaran iuran kas kematian saya.
${customNote ? `\n*Catatan Tambahan:*\n"${customNote}"\n` : ''}
Mohon informasi mengenai status verifikasi pembayaran atau rekening tujuan yang aktif.`;
      break;

    case 'duka':
      topicTitle = 'Laporan Berita Duka Cita & Permohonan Santunan';
      bodyContent = `Innalillahi wa inna ilaihi roji'un.
Saya ingin melaporkan berita duka cita keluarga kami dan memohon arahan terkait:
1. Pelayanan Fardhu Kifayah / Ambulans Duka
2. Prosedur pencairan dana santunan kematian paguyuban

${customNote ? `*Rincian / Data Almarhum/ah:*\n"${customNote}"\n` : ''}
Mohon petunjuk dan bantuan dari pihak pengurus paguyuban secepatnya.`;
      break;

    case 'keluarga':
      topicTitle = 'Pembaruan Data Anggota & Tanggungan Keluarga';
      bodyContent = `Saya ingin memohon pembaruan / penambahan data anggota keluarga (tanggungan) yang terdaftar di sistem.
${customNote ? `\n*Rincian Perubahan:*\n"${customNote}"\n` : ''}
Mohon bantuan admin/pengurus untuk memproses pembaruan data saya.`;
      break;

    case 'verifikasi':
      topicTitle = 'Permohonan Verifikasi Akun / Status Keanggotaan';
      bodyContent = `Saya ingin menanyakan status verifikasi pendaftaran akun warga saya di sistem Paguyuban Dana Kematian.
${customNote ? `\n*Catatan:*\n"${customNote}"\n` : ''}
Mohon kesediaan Bpk/Ibu Pengurus untuk mengecek status akun saya.`;
      break;

    case 'umum':
    default:
      topicTitle = 'Pertanyaan & Bantuan Warga';
      bodyContent = customNote
        ? `${customNote}`
        : 'Saya ingin bertanya dan berkonsultasi mengenai program serta kegiatan Paguyuban Dana Kematian.';
      break;
  }

  return `*━━━━━━━━━━━━━━━━━━━━━━━━*
*💬 PESAN DARI ANGGOTA PAGUYUBAN*
*${communityName.toUpperCase()}*
*━━━━━━━━━━━━━━━━━━━━━━━━*

Kepada Yth:
👤 *${admin.name}*
📌 Jabatan: *${admin.role}*

*IDENTITAS PENGIRIM (ANGGOTA):*
• Nama: *${memberName}*
• No. Pokok Anggota: *${memberNumber}*
• Cluster / Wilayah: *${cluster}*${address}
${member?.phone ? `• No. WhatsApp Terdaftar: *${member.phone}*` : ''}

*TOPIK / KEPERLUAN:*
👉 *${topicTitle}*

*ISI PESAN:*
${bodyContent}

*━━━━━━━━━━━━━━━━━━━━━━━━*
_Pesan ini dikirimkan otomatis melalui Portal Dashboard Anggota ${communityName}._`;
};

/**
 * Creates WhatsApp click-to-chat URL with phone number and pre-filled message.
 */
export const createAdminWhatsAppUrl = (
  adminPhone: string,
  message: string
): string => {
  const cleanPhone = cleanPhoneNumberForWhatsApp(adminPhone);
  const encoded = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
};
