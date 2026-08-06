
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, type Location } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Patients from "./pages/Patients";
import Presensi from "./pages/Presensi";
import BookingOperasi from "./pages/BookingOperasi";
import TarifINA from "./pages/TarifINA";
import MasterICD from "./pages/MasterICD";
import Statistik from "./pages/Statistik";
import Login from "./pages/Login";
import MedicalRecord from "./pages/MedicalRecord";
import MedicalRecordReadonly from "./pages/MedicalRecordReadonly";
import ClinicalPathway from "./pages/ClinicalPathway";
import ClinicalPathwayMaster from "./pages/ClinicalPathwayMaster";
import StatisticsCare from "./pages/StatisticsCare";
import AIAssistant from "./pages/AIAssistant";
import Settings from "./pages/Settings";
import AuditHistory from "./pages/AuditHistory";
import DepoFarmasi from "./pages/DepoFarmasi";
import Panduan from "./pages/Panduan";
import Laboratorium from "./pages/Laboratorium";
import Radiologi from "./pages/Radiologi";
import Sidebar from "./components/Sidebar";

// Helper function to format no_rawat
export const formatNoRawat = (noRawat: string) => {
  return noRawat.replace(/\//g, '');
};

// Helper function to unformat no_rawat
export const unformatNoRawat = (noRawat: string) => {
  return noRawat.replace(/\//g, '');
};
import Header from "./components/Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MedicalRecordSearchModal from "./components/modals/MedicalRecordSearchModal";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { API_URLS } from "./config/api";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

// Custom hook to detect iPad and mobile devices
const useIsTabletOrMobile = () => {
  const [isTabletOrMobile, setIsTabletOrMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const isIPad = /iPad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMobile = window.innerWidth < 768;
      setIsTabletOrMobile(isIPad || isMobile);
    };

    const handleResize = () => {
      checkDevice();
    };

    checkDevice();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return !!isTabletOrMobile;
};

const AppContent = () => {
  const [loading, setLoading] = React.useState(true);
  const isTabletOrMobile = useIsTabletOrMobile();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [medicalRecordSearchOpen, setMedicalRecordSearchOpen] = React.useState(false);
  const [canViewAuditHistory, setCanViewAuditHistory] = React.useState(false);
  const [canAccessLaboratorium, setCanAccessLaboratorium] = React.useState<boolean | null>(null);
  const [canAccessRadiologi, setCanAccessRadiologi] = React.useState<boolean | null>(null);
  const [canAccessClinicalPathway, setCanAccessClinicalPathway] = React.useState<boolean | null>(null);
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = routeState?.backgroundLocation;

  React.useEffect(() => {
    // Simulate loading delay for smooth transitions
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const username = String(user?.username || '').trim();
    if (!username || !isAuthenticated) {
      setCanViewAuditHistory(false);
      setCanAccessLaboratorium(false);
      setCanAccessRadiologi(false);
      setCanAccessClinicalPathway(false);
      return;
    }

    const checkFeatureAccess = async () => {
      try {
        const [auditResponse, labResponse, radResponse, clinicalPathwayResponse] = await Promise.all([
          fetch(`${API_URLS.AUDIT_HISTORY_ACCESS}/${encodeURIComponent(username)}`),
          fetch(`${API_URLS.LABORATORY_DATA_ACCESS}/${encodeURIComponent(username)}`),
          fetch(`${API_URLS.RADIOLOGY_DATA_ACCESS}/${encodeURIComponent(username)}`),
          fetch(`${API_URLS.CLINICAL_PATHWAY_ACCESS}/${encodeURIComponent(username)}`)
        ]);
        const [auditResult, labResult, radResult, clinicalPathwayResult] = await Promise.all([
          auditResponse.json(),
          labResponse.json(),
          radResponse.json(),
          clinicalPathwayResponse.json()
        ]);

        setCanViewAuditHistory(auditResponse.ok && Boolean(auditResult?.can_access));
        setCanAccessLaboratorium(labResponse.ok && Boolean(labResult?.can_access));
        setCanAccessRadiologi(radResponse.ok && Boolean(radResult?.can_access));
        setCanAccessClinicalPathway(clinicalPathwayResponse.ok && Boolean(clinicalPathwayResult?.can_access));
      } catch {
        setCanViewAuditHistory(false);
        setCanAccessLaboratorium(false);
        setCanAccessRadiologi(false);
        setCanAccessClinicalPathway(false);
      }
    };

    void checkFeatureAccess();
  }, [isAuthenticated, user?.username]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl font-bold">
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 pt-16 text-foreground transition-colors dark:bg-[#0c0e12]">
      <Header 
        hospitalName="RSUD H. DAMANHURI" 
        onMenuClick={() => setSidebarOpen(true)}
        isMobile={isTabletOrMobile}
        username={user?.name}
        doctorId={user?.username}
        onLogout={logout}
        onMedicalRecordSearchClick={() => setMedicalRecordSearchOpen(true)}
      />
      
      <div className="flex flex-1 w-full">
        {!isTabletOrMobile && (
          <div className="w-64 shrink-0">
            <Sidebar 
              doctorName={user?.name || ""} 
              doctorId={user?.username || ""}
              gender={user?.jk || "L"}
              canViewAuditHistory={canViewAuditHistory}
              canAccessLaboratorium={Boolean(canAccessLaboratorium)}
              canAccessRadiologi={Boolean(canAccessRadiologi)}
              canAccessClinicalPathway={Boolean(canAccessClinicalPathway)}
              onLogout={logout}
            />
          </div>
        )}
        
        <div className="flex-1 overflow-auto p-2 sm:p-4">
          <Routes location={backgroundLocation || location}>
            <Route path="/" element={<Index />} />
            <Route path="/pasien" element={<Patients />} />
            <Route path="/pasien/booking" element={<Patients />} />
            <Route path="/pasien/igd" element={<Patients />} />
            <Route path="/pasien/rawat-jalan" element={<Patients />} />
            <Route path="/pasien/rawat-inap" element={<Patients />} />
            <Route path="/pasien/rawat-inap/utama" element={<Patients />} />
            <Route path="/pasien/rawat-inap/raber" element={<Patients />} />
            <Route path="/pasien/rawat-gabung" element={<Patients />} />
            <Route path="/pasien/rawat-jaga" element={<Patients />} />
            <Route path="/pasien/hemodialisa" element={<Patients />} />
            <Route path="/pasien/hemodialisa/hemo-dialisis" element={<Patients />} />
            <Route path="/pasien/hemodialisa/peritoneal-dialisis" element={<Patients />} />
            <Route path="/presensi" element={<Presensi />} />
            <Route path="/booking" element={<BookingOperasi />} />
            <Route path="/tarif" element={<TarifINA />} />
            <Route path="/icd" element={<MasterICD />} />
            <Route path="/statistik" element={<Statistik />} />
            <Route path="/statistik/rawat-jalan" element={<StatisticsCare mode="rawat-jalan" />} />
            <Route path="/statistik/rawat-inap" element={<StatisticsCare mode="rawat-inap" />} />
            <Route path="/signature" element={<Index />} />
            <Route path="/srq" element={<Index />} />
            <Route path="/ebook" element={<Index />} />
            <Route path="/icd10" element={<MasterICD />} />
            <Route path="/icd9" element={<MasterICD />} />
            <Route path="/igd" element={<Index />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/laboratorium" element={canAccessLaboratorium === false ? <Navigate to="/" replace /> : <Laboratorium />} />
            <Route path="/radiologi" element={canAccessRadiologi === false ? <Navigate to="/" replace /> : <Radiologi />} />
            <Route path="/panduan" element={<Panduan />} />
            <Route path="/riwayat-audit" element={<AuditHistory />} />
            <Route path="/depo-farmasi" element={<DepoFarmasi />} />
            <Route path="/pengaturan" element={<Settings />} />
            <Route path="/rekam-medik" element={<MedicalRecord />} />
            <Route path="/rekam-medik/:no_rkm_medis" element={<MedicalRecordReadonly />} />
            <Route path="/rekam-medik/:no_rkm_medis/:no_rawat" element={<MedicalRecord />} />
            <Route path="/clinical-pathway" element={<ClinicalPathway />} />
            <Route path="/clinical-pathway/master" element={canAccessClinicalPathway === false ? <Navigate to="/" replace /> : <ClinicalPathwayMaster />} />
            <Route path="/clinical-pathway/:no_rkm_medis/:no_rawat" element={<ClinicalPathway />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        
        {isTabletOrMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
              <Sidebar 
                doctorName={user?.name || ""} 
                doctorId={user?.username || ""} 
                gender={user?.jk || "L"}
                canViewAuditHistory={canViewAuditHistory}
                canAccessLaboratorium={Boolean(canAccessLaboratorium)}
                canAccessRadiologi={Boolean(canAccessRadiologi)}
                canAccessClinicalPathway={Boolean(canAccessClinicalPathway)}
                onClose={() => setSidebarOpen(false)}
                onLogout={logout}
              />
            </SheetContent>
          </Sheet>
        )}

        {backgroundLocation && (
          <Routes>
            <Route
              path="/rekam-medik/:no_rkm_medis"
              element={<MedicalRecordReadonly asModal onClose={() => navigate(-1)} />}
            />
            <Route
              path="/clinical-pathway/:no_rkm_medis/:no_rawat"
              element={
                <Dialog open onOpenChange={(open) => { if (!open) navigate(-1); }}>
                  <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
                    <ClinicalPathway />
                  </DialogContent>
                </Dialog>
              }
            />
          </Routes>
        )}
      </div>

      <MedicalRecordSearchModal
        open={medicalRecordSearchOpen}
        onOpenChange={setMedicalRecordSearchOpen}
      />
      <PwaInstallPrompt />
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
