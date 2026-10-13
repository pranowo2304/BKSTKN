import React from 'react';
import { 
  Crown, 
  ShieldCheck, 
  Landmark, 
  User, 
  Sparkles,
  Users,
  FileSpreadsheet,
  Scan,
  Heart,
  CreditCard,
  Receipt,
  FileText,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { AppUser, Member, Payment, BenefitClaim } from '../types';

export interface MobileAppNavAction {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string | number;
  badgeColor?: 'purple' | 'emerald' | 'sky' | 'rose' | 'amber' | 'slate';
  gradient: string; // Tailwind gradient classes
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick: () => void;
}

export interface MobileAppPillAction {
  id: string;
  label: string;
  count?: number;
  isActive?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

export interface MobileBottomDockItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
  isActive?: boolean;
  isCenterFloating?: boolean;
  onClick: () => void;
}

interface RoleMobileAppMenuProps {
  // User identity
  activeUser?: AppUser | null;
  roleTitle: string; // e.g., "APLIKASI MOBILE KETUA", "APLIKASI MOBILE RT", etc.
  userName: string;
  roleSubtitle: string;
  
  // Header Counter Box (top right)
  counterLabel: string; // e.g., "PERLU PENGESAHAN"
  counterValue: string | number; // e.g., "1 Warga" or 1
  counterHighlight?: boolean; // highlight with pulse/amber if > 0

  // Quick Action Grid (4 items exactly as in image)
  sectionTitle?: string;
  sectionSubtitle?: string;
  actions: MobileAppNavAction[];

  // Horizontal Pill Buttons row
  pills?: MobileAppPillAction[];

  // Bottom dock items (5 items exactly like mobile app)
  dockItems?: MobileBottomDockItem[];
  renderBottomDock?: boolean;
}

export const RoleMobileAppMenu: React.FC<RoleMobileAppMenuProps> = ({
  activeUser,
  roleTitle,
  userName,
  roleSubtitle,
  counterLabel,
  counterValue,
  counterHighlight = false,
  sectionTitle = 'MENU CEPAT OPERASIONAL',
  sectionSubtitle = 'Ketuk ikon untuk membuka modul',
  actions,
  pills = [],
  dockItems = [],
  renderBottomDock = false,
}) => {
  // Avatar icon based on role or user authority
  const cleanRoleTitle = roleTitle.replace(/aplikasi\s+mobile\s*/gi, '').trim();

  const getAvatarIcon = () => {
    if (roleTitle.toLowerCase().includes('ketua') && !roleTitle.toLowerCase().includes('rt')) {
      return <Crown className="w-6 h-6" />;
    }
    if (roleTitle.toLowerCase().includes('rt')) {
      return <Building2 className="w-6 h-6" />;
    }
    if (roleTitle.toLowerCase().includes('bendahara')) {
      return <Landmark className="w-6 h-6" />;
    }
    return <User className="w-6 h-6" />;
  };

  return (
    <>
      {/* Top Mobile App Style Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden mt-1 sm:mt-2 transition-all">
        {/* Mobile Header Bar (App Bar with deep royal purple / indigo night gradient matching uploaded image) */}
        <div className="bg-gradient-to-r from-[#4c1d95] via-[#2e1065] to-[#1e1b4b] text-white px-4 sm:px-6 py-4 sm:py-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-44 h-44 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-28 -bottom-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            {/* Left: Avatar + User Info */}
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="relative shrink-0">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-amber-400/80 via-purple-500 to-indigo-500 p-0.5 shadow-lg shadow-purple-950/60 flex items-center justify-center">
                  <div className="w-full h-full bg-[#120d2d] rounded-[14px] flex items-center justify-center text-amber-400">
                    {getAvatarIcon()}
                  </div>
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#120d2d] rounded-full flex items-center justify-center text-[8px] text-white font-black shadow-xs">
                  ✓
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-600/40 text-purple-200 border border-purple-400/30 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                    {cleanRoleTitle || roleTitle}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5 drop-shadow-xs">
                  {userName}
                </h2>
                <p className="text-[11px] text-purple-200/80 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{roleSubtitle}</span>
                </p>
              </div>
            </div>

            {/* Right: Counter Box (Perlu Pengesahan / Status) - Matches uploaded screenshot exactly */}
            <div className="shrink-0">
              <div
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl text-center sm:text-right border transition-all shadow-inner ${
                  counterHighlight
                    ? 'bg-amber-500/25 border-amber-400/50 animate-pulse'
                    : 'bg-black/35 backdrop-blur-xs border-amber-500/30'
                }`}
              >
                <p className="text-[9px] sm:text-[10px] font-bold text-amber-200/80 uppercase tracking-widest">
                  {counterLabel}
                </p>
                <p
                  className={`text-sm sm:text-lg font-black leading-tight font-mono tracking-tight ${
                    counterHighlight ? 'text-amber-300' : 'text-amber-400'
                  }`}
                >
                  {counterValue}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action App Icons Grid (4 rounded buttons matching uploaded screenshot) */}
        <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200/80">
          <div className="flex items-center justify-between mb-3.5">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>{sectionTitle}</span>
            </p>
            <span className="text-[11px] text-slate-500 font-medium">
              {sectionSubtitle}
            </span>
          </div>

          <div
            className={`grid gap-2.5 sm:gap-3.5 ${
              actions.length <= 4
                ? 'grid-cols-2 sm:grid-cols-4'
                : actions.length <= 6
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
                : actions.length <= 8
                ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
            }`}
          >
            {actions.map((act) => {
              const IconComp = act.icon;
              const badgeBg =
                act.badgeColor === 'rose'
                  ? 'bg-rose-600 text-white'
                  : act.badgeColor === 'amber'
                  ? 'bg-amber-500 text-slate-950'
                  : act.badgeColor === 'emerald'
                  ? 'bg-emerald-600 text-white'
                  : act.badgeColor === 'purple'
                  ? 'bg-purple-600 text-white'
                  : act.badgeColor === 'sky'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-white';

              return (
                <button
                  key={act.id}
                  type="button"
                  id={`btn-mobile-act-${act.id}`}
                  onClick={act.onClick}
                  className={`group relative flex flex-col items-center text-center p-2.5 sm:p-3.5 rounded-2xl transition-all active:scale-95 cursor-pointer ${
                    act.isActive
                      ? 'bg-purple-50/70 border-2 border-purple-500 shadow-md ring-2 ring-purple-400/30'
                      : 'bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div
                    className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr ${act.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2`}
                  >
                    <IconComp className="w-6 h-6" />
                    {act.badge !== undefined && (
                      <span
                        className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full ${badgeBg} text-[9px] font-black font-mono shadow-xs border border-white`}
                      >
                        {act.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold leading-tight line-clamp-1 ${
                      act.isActive ? 'text-purple-900 font-extrabold' : 'text-slate-800 group-hover:text-purple-700'
                    }`}
                  >
                    {act.label}
                  </span>
                  {act.subLabel && (
                    <span className="text-[10px] text-slate-400 hidden sm:block mt-0.5 line-clamp-1">
                      {act.subLabel}
                    </span>
                  )}
                  {act.isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horizontal Pill Bar */}
        {pills.length > 0 && (
          <div className="px-4 sm:px-6 py-2.5 bg-white flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs">
            <div className="flex items-center gap-2 shrink-0">
              {pills.map((pill) => {
                const IconComp = pill.icon;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={pill.onClick}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                      pill.isActive
                        ? 'bg-purple-100 text-purple-900 border border-purple-200 hover:bg-purple-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent'
                    }`}
                  >
                    {IconComp && <IconComp className="w-3.5 h-3.5" />}
                    <span>{pill.label}</span>
                    {pill.count !== undefined && (
                      <span className="px-1.5 py-0.2 bg-purple-700 text-white text-[10px] rounded-full font-mono">
                        {pill.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Dock Navigation Bar (Persistent Fixed Bottom) */}
      {renderBottomDock && dockItems.length > 0 && (
        <nav
          aria-label="Menu Navigasi Mobile Bawah"
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pt-1 pb-1 sm:pb-1.5 px-3 sm:px-6"
          style={{ bottom: 0, left: 0, right: 0 }}
        >
          <div className="max-w-md sm:max-w-lg mx-auto flex items-center justify-around relative">
            {dockItems.map((item) => {
              const IconComp = item.icon;

              if (item.isCenterFloating) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className="flex flex-col items-center justify-center -mt-2.5 sm:-mt-3 py-1 px-2 group cursor-pointer min-h-[44px]"
                    title={item.label}
                  >
                    <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shadow-lg transition-all group-hover:scale-110 active:scale-95 bg-gradient-to-tr from-sky-600 to-blue-500 text-white shadow-sky-900/30 ring-4 ring-sky-100">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] mt-1 font-black text-sky-800">
                      {item.label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] min-h-[44px] cursor-pointer ${
                    item.isActive
                      ? 'text-purple-800 font-bold scale-105'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={item.label}
                >
                  <div
                    className={`p-1 rounded-xl transition-colors relative ${
                      item.isActive ? 'bg-purple-100/80 text-purple-900' : ''
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                    {item.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-mono font-black bg-rose-600 text-white flex items-center justify-center ring-1 ring-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                    {item.label}
                  </span>
                  {item.isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};
