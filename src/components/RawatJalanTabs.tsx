import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  User, 
  AlarmClock,
  Clock, 
  List, 
  Filter,
  X,
  FileText,
  ExternalLink,
  PanelRightOpen
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import PatientTable from '@/components/PatientTable';
import { DateRange } from 'react-day-picker';
import { formatDateTimeWIB, formatLocalDateValue, parseLocalDateValue, formatUIDate } from '@/lib/date-utils';
import { API_URLS } from '@/config/api';
import { DatePickerPopover } from '@/components/DatePickerPopover';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { dispatchOpenMedicalRecordTab } from '@/lib/medical-record-tabs';
import { buildMedicalRecordVisitUrl, normalizeMedicalRecordVisitNoRawat } from '@/lib/medical-record-url';

const parseDateParam = (value: string | null, fallback: Date) => {
  return parseLocalDateValue(value, fallback);
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const rawatJalanTabValues = [
  'hari-ini',
  'pagi',
  'sore',
  'rujukan_internal',
  'rujukan_internal_sore',
  'pasien_lanjutan',
  'pasien_lanjutan_sore',
  'internal_lanjutan',
  'internal_lanjutan_sore'
] as const;
type RawatJalanTab = typeof rawatJalanTabValues[number];

const emptyTabCounts: Record<RawatJalanTab, number> = {
  'hari-ini': 0,
  pagi: 0,
  sore: 0,
  rujukan_internal: 0,
  rujukan_internal_sore: 0,
  pasien_lanjutan: 0,
  pasien_lanjutan_sore: 0,
  internal_lanjutan: 0,
  internal_lanjutan_sore: 0
};

const pagiTabGroup: RawatJalanTab[] = ['pagi', 'rujukan_internal', 'pasien_lanjutan', 'internal_lanjutan'];
const soreTabGroup: RawatJalanTab[] = ['sore', 'rujukan_internal_sore', 'pasien_lanjutan_sore', 'internal_lanjutan_sore'];

const RawatJalanTabs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialToday = new Date();
  const initialFromDate = parseDateParam(searchParams.get('from'), initialToday);
  const initialToDate = parseDateParam(searchParams.get('to'), initialFromDate);
  const normalizeTabParam = (value: string | null): RawatJalanTab => {
    if (!value || value === 'pasien-poli') {
      return 'hari-ini';
    }

    return rawatJalanTabValues.includes(value as RawatJalanTab) ? (value as RawatJalanTab) : 'hari-ini';
  };
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeTab, setActiveTab] = useState(normalizeTabParam(searchParams.get('tab')));
  
  // Date range state - use current date without timezone conversion
  const [date, setDate] = useState<DateRange | undefined>({
    from: initialFromDate,
    to: initialToDate
  });
  
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || "all");
  const [statusBayarFilter, setStatusBayarFilter] = useState<string>(searchParams.get('statusBayar') || "all");
  const [doctorFilter, setDoctorFilter] = useState<string>(searchParams.get('doctor') || "all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>(searchParams.get('status') || "all");
  const [pendingStatusBayarFilter, setPendingStatusBayarFilter] = useState<string>(searchParams.get('statusBayar') || "all");
  const [pendingDoctorFilter, setPendingDoctorFilter] = useState<string>(searchParams.get('doctor') || "all");
  const [doctorOptions, setDoctorOptions] = useState<Array<{ kd_dokter: string; nm_dokter: string }>>([]);
  const [rawatJalanPatients, setRawatJalanPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  const [tabCounts, setTabCounts] = useState<Record<RawatJalanTab, number>>(emptyTabCounts);
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  const effectiveDoctorFilter = doctorFilter || "all";
  const requestDoctorFilter = doctorFilter || "all";
  const isPagiGroupActive = pagiTabGroup.includes(activeTab);
  const isSoreGroupActive = soreTabGroup.includes(activeTab);

  const openMedicalRecordInlineTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    dispatchOpenMedicalRecordTab({
      noRkmMedis: String(row.no_rkm_medis),
      noRawat: normalizeMedicalRecordVisitNoRawat(String(row.no_rawat)),
      patientName: String(row.name || row.nm_pasien || '').trim(),
      sourcePath: `${location.pathname}${location.search}`
    });
  };

  const openMedicalRecordBrowserTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat || typeof window === 'undefined') {
      return;
    }

    const targetUrl = buildMedicalRecordVisitUrl(String(row.no_rkm_medis), String(row.no_rawat));
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const openClinicalPathwayModal = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    const compactNoRawat = normalizeMedicalRecordVisitNoRawat(String(row.no_rawat));
    navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=initiation&source=rawat-jalan`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  const rawatJalanRowMenuItems = (row: any) => [
    {
      key: 'inline-tab',
      label: 'Buka Inline Tab',
      icon: <PanelRightOpen size={14} />,
      onSelect: () => openMedicalRecordInlineTab(row)
    },
    {
      key: 'new-tab',
      label: 'Buka New Tab',
      icon: <ExternalLink size={14} />,
      onSelect: () => openMedicalRecordBrowserTab(row)
    },
    {
      key: 'clinical-pathway',
      label: 'Clinical Pathway',
      icon: <FileText size={14} />,
      onSelect: () => openClinicalPathwayModal(row)
    }
  ];

  const rawatJalanColumns = [
    { accessor: 'no_reg', header: 'No. Reg' },
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'no_rawat', header: 'Nomor Rawat' },
    { accessor: 'name', header: 'Nama Pasien' },
    { accessor: 'age', header: 'Umur' },
    { accessor: 'gender', header: 'Jenis Kelamin' },
    { accessor: 'doctor', header: 'Dokter' },
    { accessor: 'poliklinik', header: 'Poliklinik' },
    { accessor: 'status', header: 'Status' },
    { accessor: 'insurance', header: 'Asuransi' },
    { accessor: 'tgl_registrasi', header: 'Tanggal Registrasi' },
    { accessor: 'paymentStatus', header: 'Status Bayar' }
  ];

  const buildRequestBody = (tabFilter: RawatJalanTab, overrides: Record<string, string> = {}) => ({
    kd_poli: user?.kd_poli,
    jenis_poli: user?.jenis_poli || '',
    jenis_poli_sore: user?.jenis_poli_sore || '',
    startDate: date?.from ? formatLocalDateValue(date.from) : '',
    endDate: date?.to ? formatLocalDateValue(date.to) : '',
    username: user?.username,
    search: overrides.search ?? debouncedSearchQuery,
    status: overrides.status ?? statusFilter,
    statusBayar: overrides.statusBayar ?? statusBayarFilter,
    kd_dokter: overrides.kd_dokter ?? requestDoctorFilter,
    tabFilter,
    page: overrides.page ?? currentPage.toString(),
    itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString(),
    ...overrides
  });

  const fetchRawatJalanTabCounts = async () => {
    if (!user?.kd_poli || !date?.from || !date?.to) {
      return;
    }

    try {
      const results = await Promise.allSettled(
        rawatJalanTabValues.map(async (tabValue) => {
          const response = await fetch(API_URLS.RAWAT_JALAN_PATIENTS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildRequestBody(tabValue, {
              page: '1',
              itemsPerPage: '1'
            }))
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || `Gagal mengambil total ${tabValue}`);
          }

          return [tabValue, Number(data.total || 0)] as const;
        })
      );

      const nextTabCounts = { ...emptyTabCounts };
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [tabValue, count] = result.value;
          nextTabCounts[tabValue] = count;
        }
      });

      setTabCounts(nextTabCounts);
    } catch (error) {
      console.error('Error fetching rawat jalan tab counts:', error);
      setTabCounts(emptyTabCounts);
    }
  };

  const fetchRawatJalanPatients = async (tabFilter?: RawatJalanTab, overrides: Record<string, string> = {}) => {
    if (!user?.kd_poli || !date?.from || !date?.to) {
      console.log('Missing required data:', { kd_poli: user?.kd_poli, date });
      return;
    }
    
    setLoading(true);
    try {
      const requestBody = buildRequestBody(tabFilter || activeTab, overrides);

      console.log('Request dates (WIB):', {
        startDate: formatLocalDateValue(date.from),
        endDate: formatLocalDateValue(date.to),
        originalDates: { from: date.from, to: date.to }
      });

      console.log('Fetching rawat jalan patients with filters:', requestBody);
      
      const response = await fetch(API_URLS.RAWAT_JALAN_PATIENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching rawat jalan patients:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      console.log('Raw response from rawat-jalan-patients:', data);

      if (!data.success) {
        console.error('Error fetching rawat jalan patients:', data.error);
        throw new Error(data.error);
      }

      if (data?.success) {
        console.log('Received patient data:', data.data);
        setRawatJalanPatients(Array.isArray(data.data) ? data.data : []);
        setDoctorOptions(Array.isArray(data.doctors) ? data.doctors : []);
        setTotal(data.total || 0);
        void fetchRawatJalanTabCounts();
      } else {
        console.error('Failed to fetch patients:', data);
        setRawatJalanPatients([]);
        setDoctorOptions([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching rawat jalan patients:', error);
      setRawatJalanPatients([]);
      setDoctorOptions([]);
      setTotal(0);
      setTabCounts(emptyTabCounts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (date?.from && date?.to) {
      fetchRawatJalanPatients();
    }
  }, [user?.kd_poli, date?.from, date?.to, activeTab, currentPage, itemsPerPage, debouncedSearchQuery]);

  useEffect(() => {
    if (!isFilterModalOpen) {
      return;
    }

    setPendingStatusFilter(statusFilter);
    setPendingStatusBayarFilter(statusBayarFilter);
    setPendingDoctorFilter(effectiveDoctorFilter);
  }, [isFilterModalOpen, statusFilter, statusBayarFilter, effectiveDoctorFilter]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('tab', activeTab);
    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));
    params.set('status', statusFilter);
    params.set('statusBayar', statusBayarFilter);

    if (date?.from) {
      params.set('from', format(date.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }

    if (date?.to) {
      params.set('to', format(date.to, 'yyyy-MM-dd'));
    } else {
      params.delete('to');
    }

    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }

    if (doctorFilter && doctorFilter !== "all") {
      params.set('doctor', doctorFilter);
    } else {
      params.delete('doctor');
    }

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    activeTab,
    currentPage,
    itemsPerPage,
    statusFilter,
    statusBayarFilter,
    doctorFilter,
    searchQuery,
    date?.from,
    date?.to,
    searchParams,
    setSearchParams
  ]);
  
  const handleFilterApply = () => {
    if (!date?.from || !date?.to) {
      return;
    }

    const nextStatusFilter = pendingStatusFilter || "all";
    const nextStatusBayarFilter = pendingStatusBayarFilter || "all";
    const nextDoctorFilter = pendingDoctorFilter || "all";

    setStatusFilter(nextStatusFilter);
    setStatusBayarFilter(nextStatusBayarFilter);
    setDoctorFilter(nextDoctorFilter);
    setIsFilterModalOpen(false);

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchRawatJalanPatients(activeTab, {
      status: nextStatusFilter,
      statusBayar: nextStatusBayarFilter,
      kd_dokter: nextDoctorFilter
    });
  };

  const handleClearFilters = () => {
    setDate({
      from: new Date(),
      to: new Date()
    });
    setStatusFilter("all");
    setStatusBayarFilter("all");
    setDoctorFilter("all");
    setPendingStatusFilter("all");
    setPendingStatusBayarFilter("all");
    setPendingDoctorFilter("all");
    setIsFilterModalOpen(false);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(normalizeTabParam(newTab));
    setCurrentPage(1);
  };
  
  const filteredRawatJalanData = (Array.isArray(rawatJalanPatients) ? rawatJalanPatients : []).filter(patient => {
    let passesSearch = true;
    let passesStatus = true;
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      passesSearch = 
        patient.nm_pasien?.toLowerCase().includes(searchLower) ||
        patient.nm_dokter?.toLowerCase().includes(searchLower) ||
        patient.nm_poli?.toLowerCase().includes(searchLower) ||
        patient.png_jawab?.toLowerCase().includes(searchLower) ||
        patient.no_rkm_medis?.toString().includes(searchQuery);
    }
    
    if (statusFilter && statusFilter !== "all") {
      passesStatus = patient.status?.toLowerCase() === statusFilter.toLowerCase();
    }
    
    return passesSearch && passesStatus;
  }).map(patient => ({
    id: patient.no_rawat,
    no_rkm_medis: patient.no_rkm_medis,
    no_reg: patient.no_reg,
    no_rawat: patient.no_rawat,
    name: patient.nm_pasien,
    prb: patient.prb || '',
    prb_program: patient.prb_program || '',
    age: patient.tgl_lahir ? new Date().getFullYear() - new Date(patient.tgl_lahir).getFullYear() : '-',
    gender: patient.jk === 'L' ? 'Laki-laki' : 'Perempuan',
    doctor: patient.nm_dokter,
    poliklinik: patient.nm_poli,
    status: patient.status,
    insurance: patient.png_jawab || 'Umum',
    tgl_registrasi: (() => {
      if (!patient.tgl_registrasi) return '-';
      
      try {
        // Handle different date formats that might come from MySQL
        let dateValue = patient.tgl_registrasi;
        
        // If it's already a Date object
        if (dateValue instanceof Date) {
          return formatDateTimeWIB(dateValue);
        }
        
        // If it's a string, try to parse it
        if (typeof dateValue === 'string') {
          // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            return formatDateTimeWIB(parsedDate);
          }
        }
        
        console.error('Invalid date format for tgl_registrasi:', dateValue);
        return 'Invalid Date';
      } catch (error) {
        console.error('Error formatting tgl_registrasi:', error, 'Value:', patient.tgl_registrasi);
        return 'Error Date';
      }
    })(),
    phone: patient.no_tlp,
    address: patient.alamat,
    paymentStatus: patient.payment_status || 'Belum Bayar'
  }));

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2">
        <TabsTrigger value="hari-ini">
          <Clock className="mr-2 h-4 w-4" />
          <span>Hari Ini ({tabCounts['hari-ini']})</span>
        </TabsTrigger>
        <TabsTrigger value="pagi">
          <AlarmClock className="mr-2 h-4 w-4" />
          <span>Sesi Pagi ({tabCounts.pagi})</span>
        </TabsTrigger>
        {isPagiGroupActive && (
          <>
            <TabsTrigger value="rujukan_internal">
              <User className="mr-2 h-4 w-4" />
              <span>Internal Pagi ({tabCounts.rujukan_internal})</span>
            </TabsTrigger>
            <TabsTrigger value="pasien_lanjutan">
              <List className="mr-2 h-4 w-4" />
              <span>Lanjutan Pagi ({tabCounts.pasien_lanjutan})</span>
            </TabsTrigger>
            <TabsTrigger value="internal_lanjutan">
              <List className="mr-2 h-4 w-4" />
              <span>Internal Lanjut Pagi ({tabCounts.internal_lanjutan})</span>
            </TabsTrigger>
          </>
        )}
        <TabsTrigger value="sore">
          <Clock className="mr-2 h-4 w-4" />
          <span>Sesi Sore ({tabCounts.sore})</span>
        </TabsTrigger>
        {isSoreGroupActive && (
          <>
            <TabsTrigger value="rujukan_internal_sore">
              <User className="mr-2 h-4 w-4" />
              <span>Internal Sore ({tabCounts.rujukan_internal_sore})</span>
            </TabsTrigger>
            <TabsTrigger value="pasien_lanjutan_sore">
              <List className="mr-2 h-4 w-4" />
              <span>Lanjutan Sore ({tabCounts.pasien_lanjutan_sore})</span>
            </TabsTrigger>
            <TabsTrigger value="internal_lanjutan_sore">
              <List className="mr-2 h-4 w-4" />
              <span>Internal Lanjut Sore ({tabCounts.internal_lanjutan_sore})</span>
            </TabsTrigger>
          </>
        )}
      </TabsList>
      
      {rawatJalanTabValues.map((tabValue) => (
        <TabsContent key={tabValue} value={tabValue} className="space-y-4">
          <Card>
            <CardHeader className="pb-2 w-full">
              <CardTitle>
                {tabValue === 'hari-ini' && 'Daftar Pasien Hari Ini'}
                {tabValue === 'pagi' && 'Daftar Pasien Sesi Pagi'}
                {tabValue === 'sore' && 'Daftar Pasien Sesi Sore'}
                {tabValue === 'rujukan_internal' && 'Rujukan Internal'}
                {tabValue === 'rujukan_internal_sore' && 'Rujukan Internal Sore'}
                {tabValue === 'pasien_lanjutan' && 'Pasien Lanjutan'}
                {tabValue === 'pasien_lanjutan_sore' && 'Pasien Lanjutan Sore'}
                {tabValue === 'internal_lanjutan' && 'Internal Lanjutan'}
                {tabValue === 'internal_lanjutan_sore' && 'Internal Lanjutan Sore'}
              </CardTitle>
              <div className="mb-4 flex w-full flex-col items-start gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
                <div className="relative w-full lg:min-w-0 lg:flex-[1.8_1_0%]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Cari pasien..."
                    className="w-full pl-8"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-none">
                  <DatePickerPopover
                    triggerId="date"
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    calendarClassName="sm:min-w-[600px]"
                    buttonClassName="w-full sm:w-[280px]"
                    placeholder="Pilih rentang tanggal"
                    displayValue={date?.from ? (
                      date.to ? (
                        <>
                          {formatUIDate(date.from)} - {formatUIDate(date.to)}
                        </>
                      ) : (
                        formatUIDate(date.from)
                      )
                    ) : undefined}
                  />
                </div>
                
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-none lg:shrink-0">
                  <Button variant="secondary" onClick={() => setIsFilterModalOpen(true)} className="w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto">
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
              <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter Pasien Rawat Jalan</DialogTitle>
                    <DialogDescription>
                      Atur filter status pasien, status bayar, dan dokter. Perubahan diterapkan saat tombol Terapkan Filter ditekan.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                      <div className="text-sm font-medium">Status</div>
                      <Select value={pendingStatusFilter} onValueChange={setPendingStatusFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status Pasien" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="Belum">Belum</SelectItem>
                          <SelectItem value="Sudah">Sudah</SelectItem>
                          <SelectItem value="Batal">Batal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-medium">Status Bayar</div>
                      <Select value={pendingStatusBayarFilter} onValueChange={setPendingStatusBayarFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status Bayar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status Bayar</SelectItem>
                          <SelectItem value="Sudah Bayar">Sudah Bayar</SelectItem>
                          <SelectItem value="Belum Bayar">Belum Bayar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-medium">Dokter</div>
                      <Select value={pendingDoctorFilter} onValueChange={setPendingDoctorFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Dokter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Dokter</SelectItem>
                          {doctorOptions.map((doctor) => (
                            <SelectItem key={doctor.kd_dokter} value={doctor.kd_dokter}>
                              {doctor.nm_dokter}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsFilterModalOpen(false)}>
                      Batal
                    </Button>
                    <Button variant="secondary" onClick={handleFilterApply}>
                      Terapkan Filter
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <PatientTable
                patients={filteredRawatJalanData}
                columns={rawatJalanColumns}
                loading={loading}
                getRowMenuItems={rawatJalanRowMenuItems}
                pagination={{
                  currentPage,
                  totalPages: Math.ceil(total / itemsPerPage),
                  totalItems: total,
                  itemsPerPage,
                  onPageChange: (page) => {
                    setCurrentPage(page);
                  },
                  onItemsPerPageChange: (newItemsPerPage) => {
                    setItemsPerPage(newItemsPerPage);
                    setCurrentPage(1);
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default RawatJalanTabs;
