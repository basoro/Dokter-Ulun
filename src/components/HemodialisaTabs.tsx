import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Filter,
  X,
  ExternalLink,
  FileText,
  PanelRightOpen,
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

// Columns for hemodialisa data
const hemodialisaColumns = [
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
  { accessor: 'paymentStatus', header: 'Status Bayar' },
];

const HemodialisaTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialToday = new Date();
  const initialFromDate = parseDateParam(searchParams.get('from'), initialToday);
  const initialToDate = parseDateParam(searchParams.get('to'), initialFromDate);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  
  // Date range state - use current date without timezone conversion
  const [date, setDate] = useState<DateRange | undefined>({
    from: initialFromDate,
    to: initialToDate
  });
  
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || "all");
  const [statusBayarFilter, setStatusBayarFilter] = useState<string>(searchParams.get('statusBayar') || "all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>(searchParams.get('status') || "all");
  const [pendingStatusBayarFilter, setPendingStatusBayarFilter] = useState<string>(searchParams.get('statusBayar') || "all");
  const [hemodialisaPatients, setHemodialisaPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  
  const fetchHemodialisaPatients = async (overrides: Record<string, string> = {}) => {
    if (!date?.from || !date?.to) {
      console.log('Missing date range:', { date });
      return;
    }
    
    setLoading(true);
    try {
      let requestBody = {
        startDate: formatLocalDateValue(date.from),
        endDate: formatLocalDateValue(date.to),
        search: overrides.search ?? debouncedSearchQuery,
        status: overrides.status ?? statusFilter,
        statusBayar: overrides.statusBayar ?? statusBayarFilter,
        page: overrides.page ?? currentPage.toString(),
        itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString()
      };

      console.log('Request dates (WIB):', {
        startDate: formatLocalDateValue(date.from),
        endDate: formatLocalDateValue(date.to),
        originalDates: { from: date.from, to: date.to }
      });

      console.log('Fetching hemodialisa patients with filters:', requestBody);
      
      const response = await fetch(API_URLS.HEMODIALISA_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Raw response from hemodialisa-data:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        console.error('HTTP error fetching hemodialisa patients:', response.status, response.statusText);
        setHemodialisaPatients([]);
        setTotal(0);
        return;
      }

      const data = await response.json();
      console.log('Parsed response data:', data);

      if (data?.success) {
        console.log('Received patient data:', data.data);
        console.log('Data structure check:', { 
          isArray: Array.isArray(data.data), 
          length: data.data?.length, 
          firstItem: data.data?.[0] 
        });
        setHemodialisaPatients(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        console.error('Failed to fetch patients:', data);
        setHemodialisaPatients([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching hemodialisa patients:', error);
      setHemodialisaPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (date?.from && date?.to) {
      fetchHemodialisaPatients();
    }
  }, [date?.from, date?.to, currentPage, itemsPerPage, statusFilter, statusBayarFilter, debouncedSearchQuery]);

  useEffect(() => {
    if (!isFilterModalOpen) {
      return;
    }

    setPendingStatusFilter(statusFilter);
    setPendingStatusBayarFilter(statusBayarFilter);
  }, [isFilterModalOpen, statusFilter, statusBayarFilter]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

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

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    currentPage,
    itemsPerPage,
    statusFilter,
    statusBayarFilter,
    searchQuery,
    date?.from,
    date?.to,
    searchParams,
    setSearchParams
  ]);
  
  const handleFilterApply = () => {
    const nextStatusFilter = pendingStatusFilter || "all";
    const nextStatusBayarFilter = pendingStatusBayarFilter || "all";

    setStatusFilter(nextStatusFilter);
    setStatusBayarFilter(nextStatusBayarFilter);
    setIsFilterModalOpen(false);

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchHemodialisaPatients({
      status: nextStatusFilter,
      statusBayar: nextStatusBayarFilter
    });
  };

  const handleClearFilters = () => {
    setDate({
      from: new Date(),
      to: new Date()
    });
    setStatusFilter("all");
    setStatusBayarFilter("all");
    setPendingStatusFilter("all");
    setPendingStatusBayarFilter("all");
    setIsFilterModalOpen(false);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const openMedicalRecordInlineTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    dispatchOpenMedicalRecordTab({
      noRkmMedis: String(row.no_rkm_medis),
      noRawat: normalizeMedicalRecordVisitNoRawat(String(row.no_rawat || '')),
      patientName: String(row.name || '').trim(),
      sourcePath: `${location.pathname}${location.search}`
    });
  };

  const openMedicalRecordBrowserTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat || typeof window === 'undefined') {
      return;
    }

    window.open(buildMedicalRecordVisitUrl(String(row.no_rkm_medis), String(row.no_rawat)), '_blank', 'noopener,noreferrer');
  };

  const openClinicalPathwayModal = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    const compactNoRawat = normalizeMedicalRecordVisitNoRawat(String(row.no_rawat));
    navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=initiation&source=hemodialisa`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  const getHemodialisaRowMenuItems = (row: any) => [
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
  
  console.log('Mapping hemodialisa data:', {
    totalPatients: hemodialisaPatients.length,
    searchQuery,
    statusFilter,
    statusBayarFilter
  });

  const filteredHemodialisaData = hemodialisaPatients.map(patient => ({
    id: patient.no_rkm_medis,
    no_rkm_medis: patient.no_rkm_medis,
    no_reg: patient.no_reg,
    no_rawat: patient.no_rawat,
    name: patient.nm_pasien,
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

  console.log('Final filtered data:', {
    filteredCount: filteredHemodialisaData.length,
    originalCount: hemodialisaPatients.length,
    sampleFilteredData: filteredHemodialisaData.slice(0, 2)
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 w-full">
          <CardTitle>Daftar Pasien Hemodialisa</CardTitle>
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
                <DialogTitle>Filter Pasien Hemodialisa</DialogTitle>
                <DialogDescription>
                  Atur filter status pasien dan status bayar, lalu tekan Terapkan Filter.
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
            patients={filteredHemodialisaData}
            columns={hemodialisaColumns}
            loading={loading}
            getRowMenuItems={getHemodialisaRowMenuItems}
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
    </div>
  );
};

export default HemodialisaTabs;
