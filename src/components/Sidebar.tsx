
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  FileCheck, 
  CalendarClock, 
  DollarSign, 
  FileBarChart, 
  BarChart2,
  Pencil,
  HelpCircle,
  Book,
  Package,
  Activity,
  Bot,
  AlarmClock,
  FlaskConical,
  ScanLine,
  ClipboardList,
  LogOut,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import bgImage from '@/assets/profile-bg.png';
import { AboutModal } from '@/components/ui/about-modal';
import { dispatchCloseAllMedicalRecordTabs } from '@/lib/medical-record-tabs';

interface SidebarProps {
  doctorName: string;
  doctorId: string;
  gender: 'L' | 'P'; 
  canViewAuditHistory?: boolean;
  canAccessLaboratorium?: boolean;
  canAccessRadiologi?: boolean;
  canAccessClinicalPathway?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}

interface SubmenuItem {
  name: string;
  path: string;
  exact?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  doctorName,
  doctorId,
  gender,
  canViewAuditHistory = false,
  canAccessLaboratorium = false,
  canAccessRadiologi = false,
  canAccessClinicalPathway = false,
  onClose,
  onLogout
}) => {
  const location = useLocation();
  const [pasienOpen, setPasienOpen] = useState(true);
  const [statistikOpen, setStatistikOpen] = useState(true);
  const [rawatInapOpen, setRawatInapOpen] = useState(
    location.pathname.startsWith('/pasien/rawat-inap')
    || location.pathname.startsWith('/pasien/rawat-gabung')
    || location.pathname.startsWith('/pasien/rawat-jaga')
  );
  const [hemodialisaOpen, setHemodialisaOpen] = useState(
    location.pathname.startsWith('/pasien/hemodialisa')
  );
  
  const [aboutOpen, setAboutOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  
  const isPasienActive = () => {
    return location.pathname.startsWith('/pasien');
  };

  const isStatistikActive = () => {
    return location.pathname.startsWith('/statistik');
  };
  
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <BarChart2 className="h-5 w-5" /> },
    ...(canAccessLaboratorium ? [{ name: 'Laboratorium', path: '/laboratorium', icon: <FlaskConical className="h-5 w-5" /> }] : []),
    ...(canAccessRadiologi ? [{ name: 'Radiologi', path: '/radiologi', icon: <ScanLine className="h-5 w-5" /> }] : []),
    { name: 'AI Asisten', path: '/ai-assistant', icon: <Bot className="h-5 w-5" />, badge: 'Beta' },
    ...(canAccessClinicalPathway ? [{ name: 'Clinical Pathway', path: '/clinical-pathway/master', icon: <ClipboardList className="h-5 w-5" /> }] : []),
    ...(canViewAuditHistory ? [{ name: 'Riwayat Audit', path: '/riwayat-audit', icon: <Book className="h-5 w-5" /> }] : []),
    { name: 'Data Farmasi', path: '/depo-farmasi', icon: <Package className="h-5 w-5" /> },
    { name: 'Presensi', path: '/presensi', icon: <FileCheck className="h-5 w-5" /> },
    { name: 'Booking Operasi', path: '/booking', icon: <CalendarClock className="h-5 w-5" /> },
    { name: 'Tarif INA-CBGs', path: '/tarif', icon: <DollarSign className="h-5 w-5" /> },
    { name: 'Kode Medis', path: '/icd', icon: <FileBarChart className="h-5 w-5" /> },
    // { name: 'TTD Elektronik', path: '/signature', icon: <Pencil className="h-5 w-5" /> },
    // { name: 'SRQ', path: '/srq', icon: <HelpCircle className="h-5 w-5" /> },
    // { name: 'E-Book', path: '/ebook', icon: <Book className="h-5 w-5" /> },
    // { name: 'IGD', path: '/igd', icon: <AlarmClock className="h-5 w-5" /> },
  ];

  const pasienSubmenuItems: SubmenuItem[] = [
    { name: 'Booking', path: '/pasien/booking' },
    { name: 'IGD', path: '/pasien/igd' },
    { name: 'Rawat Jalan', path: '/pasien/rawat-jalan' },
  ];

  const rawatInapSubmenuItems: SubmenuItem[] = [
    { name: 'Rawat Utama', path: '/pasien/rawat-inap/utama' },
    { name: 'Rawat Bersama', path: '/pasien/rawat-inap/raber' },
    { name: 'Rawat Gabung', path: '/pasien/rawat-gabung' },
    { name: 'Rawat Jaga', path: '/pasien/rawat-jaga' }
  ];

  const hemodialisaSubmenuItems: SubmenuItem[] = [
    { name: 'Hemo Dialisis', path: '/pasien/hemodialisa/hemo-dialisis' },
    { name: 'Peritoneal Dialisis', path: '/pasien/hemodialisa/peritoneal-dialisis' }
  ];

  const statistikSubmenuItems: SubmenuItem[] = [
    { name: 'Statistik Pasien', path: '/statistik', exact: true },
    { name: 'Statistik Rawat Jalan', path: '/statistik/rawat-jalan' },
    { name: 'Statistik Rawat Inap', path: '/statistik/rawat-inap' },
  ];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    if (onClose) {
      onClose();
    }
  };

  const handlePatientsMenuClick = () => {
    dispatchCloseAllMedicalRecordTabs();
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (
      location.pathname.startsWith('/pasien/rawat-inap')
      || location.pathname.startsWith('/pasien/rawat-gabung')
      || location.pathname.startsWith('/pasien/rawat-jaga')
    ) {
      setRawatInapOpen(true);
    }
    if (location.pathname.startsWith('/pasien/hemodialisa')) {
      setHemodialisaOpen(true);
    }
  }, [location.pathname]);

  const activeItemClass = 'bg-primary/10 text-primary dark:bg-sky-500/12 dark:text-sky-300';
  const inactiveItemClass = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.04]';
  const activeIconClass = 'text-primary dark:text-sky-300';
  const inactiveIconClass = 'text-slate-500 dark:text-slate-500';
  const presensiItem = menuItems.find((item) => item.path === '/presensi');
  const secondaryMenuItems = menuItems.filter((item) => item.path !== '/' && item.path !== '/presensi');

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-[calc(100vh)] w-64 flex-col border-r bg-white shadow-sm transition-colors dark:border-white/10 dark:bg-[#101317] sm:top-16 sm:h-[calc(100vh-4rem)]">
        <div 
          className="relative border-b p-4 dark:border-white/10"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
        <div>
          <div className="flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-sm dark:bg-slate-900/90">
              {gender === 'P' ? (
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-primary">
                  <path fill="currentColor" d="M12 2a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2m-1.5 20v-6h-3l2.59-7.59C10.34 7.59 11.1 7 12 7c.9 0 1.66.59 1.91 1.41L16.5 16h-3v6h-3Z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-primary">
                  <path fill="currentColor" d="M12 4a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/>
                </svg>
              )}
            </div>
          </div>
          <h3 className="mt-2 font-semibold text-white">{doctorName}</h3>
          <p className="text-xs text-white">{doctorId}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          <Link
            to="/"
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/')
                ? activeItemClass
                : inactiveItemClass
            }`}
            onClick={onClose}
          >
            <span className={`mr-3 ${isActive('/') ? activeIconClass : inactiveIconClass}`}>
              <BarChart2 className="h-5 w-5" />
            </span>
            Dashboard
          </Link>

          {presensiItem ? (
            <Link
              to={presensiItem.path}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(presensiItem.path)
                  ? 'bg-primary/10 text-primary dark:bg-sky-500/12 dark:text-sky-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
              onClick={onClose}
            >
              <span className={`mr-3 ${isActive(presensiItem.path) ? 'text-primary dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {presensiItem.icon}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span>{presensiItem.name}</span>
                {presensiItem.badge ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {presensiItem.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ) : null}

          <div>
            <Collapsible
              open={pasienOpen}
              onOpenChange={setPasienOpen}
              className="w-full"
            >
              <CollapsibleTrigger
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isPasienActive()
                    ? activeItemClass
                    : inactiveItemClass
                }`}
                onClick={handlePatientsMenuClick}
              >
                <div className="flex items-center">
                  <span className={`mr-3 ${isPasienActive() ? activeIconClass : inactiveIconClass}`}>
                    <Users className="h-5 w-5" />
                  </span>
                  Pasien
                </div>
                <span className="text-slate-500 dark:text-slate-400">
                  {pasienOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-8 mt-1 space-y-1">
                {pasienSubmenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      item.exact 
                        ? (location.pathname === item.path ? activeItemClass : inactiveItemClass)
                        : (location.pathname.startsWith(item.path) ? activeItemClass : inactiveItemClass)
                    }`}
                    onClick={handlePatientsMenuClick}
                  >
                    {item.name}
                  </Link>
                ))}
                <Collapsible
                  open={rawatInapOpen}
                  onOpenChange={setRawatInapOpen}
                  className="w-full"
                >
                  <CollapsibleTrigger
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      (
                        location.pathname.startsWith('/pasien/rawat-inap')
                        || location.pathname.startsWith('/pasien/rawat-gabung')
                        || location.pathname.startsWith('/pasien/rawat-jaga')
                      )
                        ? activeItemClass
                        : inactiveItemClass
                    }`}
                  >
                    <span>Rawat Inap</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {rawatInapOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-4 mt-1 space-y-1">
                    {rawatInapSubmenuItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          location.pathname.startsWith(item.path)
                            ? activeItemClass
                            : inactiveItemClass
                        }`}
                        onClick={handlePatientsMenuClick}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
                <Collapsible
                  open={hemodialisaOpen}
                  onOpenChange={setHemodialisaOpen}
                  className="w-full"
                >
                  <CollapsibleTrigger
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      location.pathname.startsWith('/pasien/hemodialisa')
                        ? activeItemClass
                        : inactiveItemClass
                    }`}
                  >
                    <span>Hemodialisa</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {hemodialisaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-4 mt-1 space-y-1">
                    {hemodialisaSubmenuItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          location.pathname.startsWith(item.path)
                            ? activeItemClass
                            : inactiveItemClass
                        }`}
                        onClick={handlePatientsMenuClick}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {secondaryMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
              onClick={onClose}
            >
              <span className={`mr-3 ${isActive(item.path) ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>
                {item.icon}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span>{item.name}</span>
                {item.badge ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}

          <div>
            <Collapsible
              open={statistikOpen}
              onOpenChange={setStatistikOpen}
              className="w-full"
            >
              <CollapsibleTrigger
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isStatistikActive()
                  ? activeItemClass
                  : inactiveItemClass
                }`}
              >
                <div className="flex items-center">
                  <span className={`mr-3 ${isStatistikActive() ? activeIconClass : inactiveIconClass}`}>
                    <Activity className="h-5 w-5" />
                  </span>
                  Statistik
                </div>
                <span className="text-slate-500 dark:text-slate-400">
                  {statistikOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-8 mt-1 space-y-1">
                {statistikSubmenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      item.exact
                        ? (location.pathname === item.path ? activeItemClass : inactiveItemClass)
                        : (location.pathname.startsWith(item.path) ? activeItemClass : inactiveItemClass)
                    }`}
                    onClick={onClose}
                  >
                    {item.name}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <Link
            to="/panduan"
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/panduan')
                ? activeItemClass
                : inactiveItemClass
            }`}
            onClick={onClose}
          >
            <span className={`mr-3 ${isActive('/panduan') ? activeIconClass : inactiveIconClass}`}>
              <HelpCircle className="h-5 w-5" />
            </span>
            Panduan
          </Link>

        </nav>
      </div>
      
      <div className="mt-auto border-t bg-white p-4 dark:border-white/10 dark:bg-[#101317]">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          © 2017 - {new Date().getFullYear()}{" "}
          <button 
            onClick={() => setAboutOpen(true)}
            className="text-primary focus:outline-none"
          >
            ICT RSHD Barabai
          </button>
        </p>
      </div>
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </aside>
  );
};

export default Sidebar;
