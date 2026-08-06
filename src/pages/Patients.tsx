import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  User, 
  Clock, 
  Check, 
  List, 
  Image, 
  MessageSquare, 
  Home, 
  File, 
  Phone, 
  MapPin, 
  AlarmClock,
  Filter,
  X,
  ChevronsUpDown,
  CheckIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreHorizontal,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { format, addDays, subMonths } from 'date-fns';
import { indonesianLocale, formatUIDate } from '@/lib/date-utils';
import PatientTable from '@/components/PatientTable';
import { useIsMobile } from '@/hooks/use-mobile';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import RawatJalanTabs from '@/components/RawatJalanTabs';
import HemodialisaTabs from '@/components/HemodialisaTabs';
import { API_URLS } from '@/config/api';
import { DatePickerPopover } from '@/components/DatePickerPopover';
import { StatusPill } from '@/components/StatusPill';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import MedicalRecord from './MedicalRecord';
import {
  CLOSE_ALL_MEDICAL_RECORD_TABS_EVENT,
  dispatchOpenMedicalRecordTab,
  OPEN_MEDICAL_RECORD_TAB_EVENT,
  type OpenMedicalRecordTabDetail
} from '@/lib/medical-record-tabs';
import {
  buildMedicalRecordVisitUrl,
  formatMedicalRecordWorkspaceNoRawat,
  normalizeMedicalRecordVisitNoRawat
} from '@/lib/medical-record-url';

const parseDateParam = (value: string | null, fallback: Date) => {
  if (!value) return fallback;

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

interface MedicalRecordWorkspaceTab {
  id: string;
  noRkmMedis: string;
  noRawat: string;
  patientName: string;
  sourcePath?: string;
}

const LIST_PASIEN_TAB_ID = 'list-pasien';

// Patients data
const rawatJalanData = [
  {
    id: '000001',
    name: 'Ahmad Fauzi',
    age: 45,
    gender: 'Laki-laki',
    doctor: 'dr. Amir Mahmud, Sp.PD',
    poliklinik: 'Poli Penyakit Dalam',
    status: 'Menunggu',
    insurance: 'BPJS',
    arrivalTime: '08:15',
  },
  {
    id: '000002',
    name: 'Siti Rahmah',
    age: 32,
    gender: 'Perempuan',
    doctor: 'dr. Dian Pertiwi, Sp.A',
    poliklinik: 'Poli Anak',
    status: 'Diperiksa',
    insurance: 'BPJS',
    arrivalTime: '08:30',
  },
  {
    id: '000003',
    name: 'Budi Santoso',
    age: 55,
    gender: 'Laki-laki',
    doctor: 'dr. Hendra Wijaya, Sp.JP',
    poliklinik: 'Poli Jantung',
    status: 'Menunggu',
    insurance: 'Umum',
    arrivalTime: '09:00',
  },
  {
    id: '000004',
    name: 'Dewi Lestari',
    age: 28,
    gender: 'Perempuan',
    doctor: 'dr. Sinta Dewi, Sp.KK',
    poliklinik: 'Poli Kulit',
    status: 'Selesai',
    insurance: 'BPJS',
    arrivalTime: '09:15',
  },
  {
    id: '000005',
    name: 'Hadi Sulistyo',
    age: 60,
    gender: 'Laki-laki',
    doctor: 'dr. Bambang Suryanto, Sp.PD',
    poliklinik: 'Poli Penyakit Dalam',
    status: 'Menunggu',
    insurance: 'BPJS',
    arrivalTime: '10:30',
  }
];

const BookingTabs = () => {
  const [bookingPagi, setBookingPagi] = useState([]);
  const [bookingSore, setBookingSore] = useState([]);
  const [activeTab, setActiveTab] = useState<'pagi' | 'sore'>('pagi');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>("all");
  const [pendingDoctorFilter, setPendingDoctorFilter] = useState<string>("all");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPagi, setTotalPagi] = useState(0);
  const [totalSore, setTotalSore] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);

  const fetchBookingData = async (tabValue: 'pagi' | 'sore' = activeTab, overrides: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const requestBody = {
        action: 'getAll',
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        search: overrides.search ?? debouncedSearchQuery,
        status: overrides.status ?? statusFilter,
        sessionFilter: tabValue,
        page: overrides.page ?? currentPage.toString(),
        itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString()
      };

      console.log('Fetching booking data with:', requestBody);

      const response = await fetch(API_URLS.BOOKING_REGISTRASI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...requestBody,
          kd_dokter: (overrides.kd_dokter ?? doctorFilter) !== 'all' ? (overrides.kd_dokter ?? doctorFilter) : undefined
        })
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch booking data');
      }

      const bookings = Array.isArray(data.bookings) ? data.bookings : [];
      setTotal(data.total || 0);

      if (tabValue === 'pagi') {
        setBookingPagi(bookings);
      } else {
        setBookingSore(bookings);
      }

      setTotalPagi(Number(data?.tabCounts?.pagi || 0));
      setTotalSore(Number(data?.tabCounts?.sore || 0));
    } catch (error) {
      console.error('Error fetching booking data:', error);
      if (tabValue === 'pagi') {
        setBookingPagi([]);
      } else {
        setBookingSore([]);
      }
      setTotal(0);
      setTotalPagi(0);
      setTotalSore(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = () => {
    const nextStatusFilter = pendingStatusFilter || 'all';
    const nextDoctorFilter = pendingDoctorFilter || 'all';

    setStatusFilter(nextStatusFilter);
    setDoctorFilter(nextDoctorFilter);
    setDoctorOpen(false);
    setIsFilterModalOpen(false);
    setCurrentPage(1);
    fetchBookingData(activeTab, {
      status: nextStatusFilter,
      kd_dokter: nextDoctorFilter,
      page: '1'
    });
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch(API_URLS.BOOKING_REGISTRASI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'getDoctors' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch doctors');
      }

      setDoctors(data?.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleClearFilters = () => {
    setDateRange({
      from: new Date(),
      to: new Date()
    });
    setStatusFilter("all");
    setDoctorFilter("all");
    setPendingStatusFilter("all");
    setPendingDoctorFilter("all");
    setDoctorOpen(false);
    setIsFilterModalOpen(false);
    setSearchQuery("");
    setCurrentPage(1);
    fetchBookingData();
  };

  const handleTabChange = (value: string) => {
    const nextTab = value === 'sore' ? 'sore' : 'pagi';
    setActiveTab(nextTab);
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchBookingData();
    fetchDoctors();
  }, [currentPage, itemsPerPage, activeTab, debouncedSearchQuery]);

  useEffect(() => {
    if (!isFilterModalOpen) {
      return;
    }

    setPendingStatusFilter(statusFilter);
    setPendingDoctorFilter(doctorFilter);
  }, [isFilterModalOpen, statusFilter, doctorFilter]);

  const renderBookingFilterBar = () => (
    <>
      <div className="mb-4 flex w-full flex-col items-start gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
        <div className="relative w-full lg:min-w-0 lg:flex-[1.8_1_0%]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari pasien..."
            className="w-full pl-8"
            value={searchQuery}
            onChange={(e) => {
              const nextValue = e.target.value;
              setSearchQuery(nextValue);
              if (currentPage !== 1) {
                setCurrentPage(1);
              }
            }}
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-none">
          <DatePickerPopover
            triggerId="date"
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={indonesianLocale}
            calendarClassName="sm:min-w-[600px]"
            buttonClassName="w-full sm:w-[350px]"
            placeholder="Pilih rentang tanggal"
            displayValue={dateRange?.from ? (
              dateRange.to ? (
                <>
                  {formatUIDate(dateRange.from)} - {formatUIDate(dateRange.to)}
                </>
              ) : (
                formatUIDate(dateRange.from)
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
            <DialogTitle>Filter Booking Pasien</DialogTitle>
            <DialogDescription>
              Atur filter status dan dokter, lalu tekan Terapkan Filter.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Status</div>
              <Select value={pendingStatusFilter} onValueChange={setPendingStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="Terdaftar">Terdaftar</SelectItem>
                  <SelectItem value="Belum">Belum</SelectItem>
                  <SelectItem value="Batal">Batal</SelectItem>
                  <SelectItem value="Dokter Berhalangan">Dokter Berhalangan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Dokter</div>
              <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={doctorOpen}
                    className="w-full justify-between"
                  >
                    {pendingDoctorFilter !== "all"
                      ? doctors.find((doctor) => doctor.kd_dokter === pendingDoctorFilter)?.nm_dokter
                      : "Semua Dokter"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Cari dokter..." />
                    <CommandList>
                      <CommandEmpty>Tidak ada dokter ditemukan.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setPendingDoctorFilter("all");
                            setDoctorOpen(false);
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4",
                              pendingDoctorFilter === "all" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Semua Dokter
                        </CommandItem>
                        {doctors.map((doctor) => (
                          <CommandItem
                            key={doctor.kd_dokter}
                            value={doctor.nm_dokter}
                            onSelect={() => {
                              setPendingDoctorFilter(doctor.kd_dokter);
                              setDoctorOpen(false);
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                "mr-2 h-4 w-4",
                                pendingDoctorFilter === doctor.kd_dokter ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {doctor.nm_dokter}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
    </>
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="pagi">
          <AlarmClock className="mr-2 h-4 w-4" />
          <span>Pagi ({totalPagi})</span>
        </TabsTrigger>
        <TabsTrigger value="sore">
          <Clock className="mr-2 h-4 w-4" />
          <span>Sore ({totalSore})</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="pagi" className="space-y-4">
        <Card>
          <CardHeader className="pb-2 w-full">
            <CardTitle>Booking Pasien - Sesi Pagi</CardTitle>
            {renderBookingFilterBar()}
          </CardHeader>
          <CardContent>
          <PatientTable
            patients={bookingPagi.filter(booking => {
              if (!searchQuery) return true;
              const searchLower = searchQuery.toLowerCase();
              return (
                booking.nm_pasien?.toLowerCase().includes(searchLower) ||
                booking.no_rkm_medis?.toLowerCase().includes(searchLower) ||
                booking.no_tlp?.toLowerCase().includes(searchLower) ||
                booking.email?.toLowerCase().includes(searchLower) ||
                booking.nm_poli?.toLowerCase().includes(searchLower) ||
                booking.nm_dokter?.toLowerCase().includes(searchLower)
              );
            })}
            columns={bookingColumns}
            loading={loading}
            pagination={{
              currentPage,
              totalPages: Math.ceil(totalPagi / itemsPerPage),
              totalItems: totalPagi,
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
      <TabsContent value="sore" className="space-y-4">
        <Card>
          <CardHeader className="pb-2 w-full">
            <CardTitle>Booking Pasien - Sesi Sore</CardTitle>
            {renderBookingFilterBar()}
          </CardHeader>
          <CardContent>
          <PatientTable
            patients={bookingSore.filter(booking => {
              if (!searchQuery) return true;
              const searchLower = searchQuery.toLowerCase();
              return (
                booking.nm_pasien?.toLowerCase().includes(searchLower) ||
                booking.no_rkm_medis?.toLowerCase().includes(searchLower) ||
                booking.no_tlp?.toLowerCase().includes(searchLower) ||
                booking.email?.toLowerCase().includes(searchLower) ||
                booking.nm_poli?.toLowerCase().includes(searchLower) ||
                booking.nm_dokter?.toLowerCase().includes(searchLower)
              );
            })}
            columns={bookingColumns}
            loading={loading}
            pagination={{
              currentPage,
              totalPages: Math.ceil(totalSore / itemsPerPage),
              totalItems: totalSore,
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
    </Tabs>
  );
};

// Sample data for IGD 
const igdTriaseData = [
  {
    id: 'T001',
    name: 'Abdul Rahman',
    age: 58,
    gender: 'Laki-laki',
    arrivalTime: '14:25',
    complaint: 'Nyeri dada akut',
    priority: 'Merah',
    vitalSigns: 'TD: 160/95, HR: 112, RR: 24, SpO2: 92%',
    status: 'Menunggu Dokter',
  },
  {
    id: 'T002',
    name: 'Nina Suryani',
    age: 22,
    gender: 'Perempuan',
    arrivalTime: '15:10',
    complaint: 'Demam tinggi, muntah',
    priority: 'Kuning',
    vitalSigns: 'TD: 110/70, HR: 100, RR: 20, SpO2: 98%',
    status: 'Menunggu Tindakan',
  },
  {
    id: 'T003',
    name: 'Budi Prasetyo',
    age: 41,
    gender: 'Laki-laki',
    arrivalTime: '15:45',
    complaint: 'Luka bakar ringan',
    priority: 'Hijau',
    vitalSigns: 'TD: 120/80, HR: 85, RR: 18, SpO2: 99%',
    status: 'Sudah Ditangani',
  },
];

const igdObservasiData = [
  {
    id: 'O001',
    name: 'Sari Oktaviani',
    age: 67,
    gender: 'Perempuan',
    admissionTime: '12:30',
    diagnosis: 'Hipertensi Stage 2',
    doctor: 'dr. Rahman Putra, Sp.PD',
    status: 'Observasi',
    bed: 'Bed-1',
  },
  {
    id: 'O002',
    name: 'Joko Santoso',
    age: 54,
    gender: 'Laki-laki',
    admissionTime: '13:15',
    diagnosis: 'Angina Pectoris',
    doctor: 'dr. Lisa Permata, Sp.JP',
    status: 'Observasi',
    bed: 'Bed-2',
  },
];

const igdTindakanData = [
  {
    id: 'TI001',
    name: 'Rina Susanti',
    age: 31,
    gender: 'Perempuan',
    treatmentTime: '16:20',
    procedure: 'Jahit Luka',
    doctor: 'dr. Budi Santoso, Sp.B',
    status: 'Dalam Tindakan',
    room: 'Ruang Tindakan 1',
  },
  {
    id: 'TI002',
    name: 'Agus Wibowo',
    age: 39,
    gender: 'Laki-laki',
    treatmentTime: '17:00',
    procedure: 'Nebulisasi',
    doctor: 'dr. Sari Dewi, Sp.P',
    status: 'Selesai',
    room: 'Ruang Tindakan 2',
  },
];

// Sample data for Hemodialisa
const hemodialisaData = [
  {
    id: 'HD001',
    name: 'Gunawan Tri',
    age: 62,
    gender: 'Laki-laki',
    shift: 'Pagi',
    startTime: '07:00',
    endTime: '11:00',
    machine: 'HD-1',
    doctor: 'dr. Hendra Wijaya, Sp.PD-KGH',
    status: 'Sedang HD',
  },
  {
    id: 'HD002',
    name: 'Nurhayati',
    age: 55,
    gender: 'Perempuan',
    shift: 'Pagi',
    startTime: '07:30',
    endTime: '11:30',
    machine: 'HD-3',
    doctor: 'dr. Dian Purnama, Sp.PD-KGH',
    status: 'Sedang HD',
  },
  {
    id: 'HD003',
    name: 'Wahyu Setiawan',
    age: 48,
    gender: 'Laki-laki',
    shift: 'Siang',
    startTime: '13:00',
    endTime: '17:00',
    machine: 'HD-2',
    doctor: 'dr. Hendra Wijaya, Sp.PD-KGH',
    status: 'Selesai HD',
  },
];

const hemodialisaTerjadwalData = [
  {
    id: 'HDT001',
    name: 'Muhammad Yusuf',
    age: 61,
    gender: 'Laki-laki',
    scheduleDate: '2023-07-17',
    shift: 'Pagi',
    machine: 'HD-1',
    doctor: 'dr. Hendra Wijaya, Sp.PD-KGH',
    frequency: '2x seminggu',
  },
  {
    id: 'HDT002',
    name: 'Hadi Sulistyo',
    age: 59,
    gender: 'Laki-laki',
    scheduleDate: '2023-07-16',
    shift: 'Siang',
    machine: 'HD-2',
    doctor: 'dr. Dian Purnama, Sp.PD-KGH',
    frequency: '3x seminggu',
  },
];

// Updated sample data for Rawat Inap with additional fields
const rawatInapData = [
  {
    id: '000001',
    name: 'Ahmad Fauzi',
    age: 45,
    gender: 'Laki-laki',
    doctor: 'dr. Amir Mahmud, Sp.PD',
    poliklinik: 'Poli Penyakit Dalam',
    status: 'Menunggu',
    insurance: 'BPJS',
    arrivalTime: '08:15',
    admissionDate: '2023-07-10',
    dischargeDate: '2023-07-15',
    careStatus: 'Rawat Tunggal'
  },
  {
    id: '000002',
    name: 'Siti Rahmah',
    age: 32,
    gender: 'Perempuan',
    doctor: 'dr. Dian Pertiwi, Sp.A',
    poliklinik: 'Poli Anak',
    status: 'Diperiksa',
    insurance: 'BPJS',
    arrivalTime: '08:30',
    admissionDate: '2023-07-12',
    dischargeDate: '',
    careStatus: 'Rawat Bersama'
  },
  {
    id: '000003',
    name: 'Budi Santoso',
    age: 55,
    gender: 'Laki-laki',
    doctor: 'dr. Hendra Wijaya, Sp.JP',
    poliklinik: 'Poli Jantung',
    status: 'Menunggu',
    insurance: 'Umum',
    arrivalTime: '09:00',
    admissionDate: '2023-07-08',
    dischargeDate: '2023-07-18',
    careStatus: 'Rawat Gabung'
  },
];

// Columns definitions
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
  { accessor: 'paymentStatus', header: 'Status Bayar' },
];

const bookingColumns = [
  { accessor: 'no_rkm_medis', header: 'No. RM' },
  { accessor: 'nm_pasien', header: 'Nama Pasien' },
  { accessor: 'tanggal_periksa', header: 'Tanggal Periksa' },
  { accessor: 'jam_booking', header: 'Jam Booking' },
  { accessor: 'nm_poli', header: 'Poliklinik' },
  { accessor: 'nm_dokter', header: 'Dokter' },
  { accessor: 'no_tlp', header: 'No. Telepon' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'tanggal_booking', header: 'Tanggal Booking' },
];

const igdTriaseColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'arrivalTime', header: 'Jam Masuk' },
  { accessor: 'complaint', header: 'Keluhan' },
  { accessor: 'priority', header: 'Prioritas' },
  { accessor: 'status', header: 'Status' },
];

const igdObservasiColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'admissionTime', header: 'Jam Masuk Observasi' },
  { accessor: 'diagnosis', header: 'Diagnosis' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'bed', header: 'Bed' },
];

const igdTindakanColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'treatmentTime', header: 'Jam Tindakan' },
  { accessor: 'procedure', header: 'Tindakan' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'room', header: 'Ruangan' },
];

const hemodialisaColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'shift', header: 'Shift' },
  { accessor: 'startTime', header: 'Jam Mulai' },
  { accessor: 'endTime', header: 'Jam Selesai' },
  { accessor: 'machine', header: 'Mesin' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'status', header: 'Status' },
];

const hemodialisaTerjadwalColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'scheduleDate', header: 'Tanggal Jadwal' },
  { accessor: 'shift', header: 'Shift' },
  { accessor: 'machine', header: 'Mesin' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'frequency', header: 'Frekuensi' },
];

// Komponen untuk menampilkan dokter DPJP dengan dropdown
const DokterDPJPCell = ({ dokterDpjp, caraBayar }: { dokterDpjp: string; caraBayar?: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!dokterDpjp) return <span className="text-slate-400 dark:text-slate-500">-</span>;
  
  // Parse dokter dari string menggunakan regex yang lebih robust
  // Format: "dr./drg. Nama lengkap dengan gelar (Jenis DPJP), dr./drg. Nama2 (Jenis2)"
  const dokterMatches = dokterDpjp.match(/drg?\.[^()]+\([^)]+\)/g) || [];
  
  const dokterList = dokterMatches.map(item => {
    const match = item.match(/^(drg?\..+?)\s*\((.+?)\)$/);
    if (match) {
      return {
        nama: match[1].trim(),
        jenis: match[2].trim()
      };
    }
    return {
      nama: item.trim(),
      jenis: 'Tidak Diketahui'
    };
  });
  
  // Cari dokter utama
  const dokterUtama = dokterList.find(d => d.jenis.toLowerCase() === 'utama');
  const dokterLainnya = dokterList
    .filter(d => d.jenis.toLowerCase() !== 'utama')
    .sort((a, b) => a.jenis.localeCompare(b.jenis)); // Sort ascending berdasarkan jenis DPJP
  
  if (dokterList.length === 1) {
    return (
      <div className="text-sm">
        <div className="font-medium">{dokterList[0].nama}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">({dokterList[0].jenis})</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span>Cara Bayar: </span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{caraBayar || '-'}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="text-sm">
      {dokterUtama && (
        <div className="font-medium">
          {dokterUtama.nama}
          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">(Utama)</span>
        </div>
      )}

      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        <span>Cara Bayar: </span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{caraBayar || '-'}</span>
      </div>
      
      {dokterLainnya.length > 0 && (
        <div className="mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center text-xs text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ChevronDown 
              size={12} 
              className={`mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
            {dokterLainnya.length} dokter lainnya
          </button>
          
          {isExpanded && (
            <div className="mt-1 space-y-1 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
              {dokterLainnya.map((dokter, index) => (
                <div key={index} className="text-xs">
                  <div className="font-medium">{dokter.nama}</div>
                  <div className="text-slate-500 dark:text-slate-400">({dokter.jenis})</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type RawatInapViewMode = 'utama' | 'raber' | 'rawat-gabung';
type RawatInapStatusTab = 'belum-pulang' | 'sudah-pulang' | 'sudah-resume' | 'belum-resume' | 'belum-diajukan-klaim';
type RawatInapListTab = 'rawat-inap' | 'rawat-bersama' | 'rawat-gabung';

interface RawatInapTabsProps {
  viewMode?: RawatInapViewMode;
}

const RawatInapTabs = ({ viewMode = 'utama' }: RawatInapTabsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseListTab: RawatInapListTab = viewMode === 'raber'
    ? 'rawat-bersama'
    : viewMode === 'rawat-gabung'
      ? 'rawat-gabung'
      : 'rawat-inap';
  const normalizeRawatInapStatusTab = (value: string | null): RawatInapStatusTab => {
    const normalized = String(value || '').trim();
    if (normalized === 'belum-diajukan-klaim') return 'belum-diajukan-klaim';
    if (normalized === 'belum-resume') return 'belum-resume';
    if (normalized === 'sudah-resume') return 'sudah-resume';
    if (normalized === 'sudah-pulang') return 'sudah-pulang';
    return 'belum-pulang';
  };
  const rawatInapTabOptions: RawatInapStatusTab[] = viewMode === 'rawat-gabung'
    ? ['belum-pulang', 'sudah-pulang', 'sudah-resume']
    : ['belum-pulang', 'sudah-pulang', 'belum-resume', 'belum-diajukan-klaim'];
  const [hospitalizationPeriodMonths, setHospitalizationPeriodMonths] = useState(6);
  const defaultRawatInapFrom = subMonths(new Date(), hospitalizationPeriodMonths);
  const defaultRawatInapTo = new Date();
  const initialRawatInapTab = normalizeRawatInapStatusTab(searchParams.get('tab'));
  const emptyTabCounts = {
    belum_pulang: 0,
    sudah_pulang: 0,
    sudah_resume: 0,
    belum_resume: 0,
    belum_diajukan_klaim: 0
  };
  type RawatInapRequestBody = {
    page: string;
    itemsPerPage: string;
    search: string;
    statusPulang: string;
    username: string;
    tab: RawatInapListTab;
    startDate: string;
    endDate: string;
    rawatBersamaResumeStatus?: string;
    claimVerificationStatus?: string;
    includeTabCounts?: boolean;
    countsOnly?: boolean;
  };
  const [rawatInapData, setRawatInapData] = useState<any[]>([]);
  const [resumeData, setResumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<RawatInapStatusTab>(initialRawatInapTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [resumeStatus, setResumeStatus] = useState(searchParams.get('resumeStatus') || "belum_resume");
  const [resumeVerificationStatus, setResumeVerificationStatus] = useState(searchParams.get('resumeVerificationStatus') || "all");
  const [rawatBersamaResumeStatus, setRawatBersamaResumeStatus] = useState(
    searchParams.get('rawatBersamaResumeStatus') || "belum_ada_resume"
  );
  const [claimVerificationStatus, setClaimVerificationStatus] = useState(
    searchParams.get('claimVerificationStatus') || "all"
  );
  const hasDateRangeQueryRef = useRef(Boolean(searchParams.get('from') || searchParams.get('to')));
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseDateParam(searchParams.get('from'), defaultRawatInapFrom),
    to: parseDateParam(searchParams.get('to'), defaultRawatInapTo)
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [pendingResumeStatus, setPendingResumeStatus] = useState(searchParams.get('resumeStatus') || "belum_resume");
  const [pendingResumeVerificationStatus, setPendingResumeVerificationStatus] = useState(searchParams.get('resumeVerificationStatus') || "all");
  const [pendingRawatBersamaResumeStatus, setPendingRawatBersamaResumeStatus] = useState(
    searchParams.get('rawatBersamaResumeStatus') || "belum_ada_resume"
  );
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  const [tabCounts, setTabCounts] = useState(emptyTabCounts);
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  const effectiveResumeJenisDpjp = viewMode === 'raber' ? 'raber' : 'utama';

  useEffect(() => {
    if (!rawatInapTabOptions.includes(activeTab)) {
      setActiveTab(rawatInapTabOptions[0]);
      setCurrentPage(1);
    }
  }, [activeTab, rawatInapTabOptions]);
  const getResumeStatusBadge = (value: string) => {
    switch (String(value || '').trim()) {
      case 'sudah_resume':
        return {
          tone: 'green' as const,
          label: 'Sudah Resume'
        };
      case 'belum_resume':
      default:
        return {
          tone: 'blue' as const,
          label: 'Belum Resume'
        };
    }
  };
  const getRawatBersamaResumeBadge = (value: string) => {
    switch (String(value || '').trim()) {
      case 'sudah_resume_saya':
        return {
          tone: 'green' as const,
          label: 'Sudah Resume Saya'
        };
      case 'sudah_resume_dokter_lain':
        return {
          tone: 'amber' as const,
          label: 'Sudah Resume Dokter Lain'
        };
      case 'belum_ada_resume':
        return {
          tone: 'slate' as const,
          label: 'Belum Ada Resume'
        };
      default:
        return {
          tone: 'slate' as const,
          label: '-'
        };
    }
  };
  const getVerificationBadge = (value: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'selesai') {
      return {
        tone: 'blue' as const,
        label: 'Verifikasi'
      };
    }

    return {
      tone: 'amber' as const,
      label: 'Belum Verifikasi'
    };
  };
  const verificationColumn = {
    accessor: 'ket_dilanjutkan',
    header: 'Status Verifikasi',
    render: (row: any) => {
      const badge = getVerificationBadge(row.ket_dilanjutkan);
      return <StatusPill label={badge.label} tone={badge.tone} />;
    }
  };
  const openMedicalRecordInlineTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    dispatchOpenMedicalRecordTab({
      noRkmMedis: String(row.no_rkm_medis),
      noRawat: normalizeMedicalRecordVisitNoRawat(String(row.no_rawat)),
      patientName: String(row.nm_pasien || '').trim(),
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
    navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=monitoring&source=rawat-inap`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  const getRawatInapRowMenuItems = (row: any) => [
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
  const rawatInapColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'jenis_kelamin', header: 'JK' },
    { accessor: 'tgl_masuk', header: 'Tgl Masuk' },
    { accessor: 'tgl_keluar', header: 'Tgl Keluar' },
    { accessor: 'kd_kamar', header: 'Kamar' },
    { accessor: 'nm_bangsal', header: 'Bangsal' },
    {
      accessor: 'dokter_dpjp',
      header: 'DPJP',
      render: (row: any) => <DokterDPJPCell dokterDpjp={row.dokter_dpjp} caraBayar={row.cara_bayar} />
    },
    { accessor: 'stts_pulang', header: 'Status Pulang' },
    {
      accessor: 'lama',
      header: 'Lama Rawat',
      render: (row: any) => <span className="text-sm">{row.lama ? `${row.lama} hari` : '-'}</span>
    }
  ];
  const rawatBersamaColumns = [
    ...rawatInapColumns,
    {
      accessor: 'rawat_bersama_resume_status',
      header: 'Status Resume',
      render: (row: any) => {
        const badge = getRawatBersamaResumeBadge(row.rawat_bersama_resume_status);
        return <StatusPill label={badge.label} tone={badge.tone} />;
      }
    }
  ];
  const getInapColumns = (tab: RawatInapStatusTab) => {
    let baseColumns = baseListTab === 'rawat-bersama' ? rawatBersamaColumns : rawatInapColumns;

    if (tab === 'belum-pulang') {
      baseColumns = baseColumns.filter((column) => column.accessor !== 'tgl_keluar');
    }

    if (tab !== 'belum-diajukan-klaim') {
      return baseColumns;
    }

    return [
      ...baseColumns.slice(0, 2),
      verificationColumn,
      ...baseColumns.slice(2)
    ];
  };

  const buildRawatInapRequestBody = (
    tabValue: RawatInapListTab,
    overrides: Partial<RawatInapRequestBody> = {}
  ): RawatInapRequestBody => ({
    page: overrides.page ?? currentPage.toString(),
    itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString(),
    search: overrides.search ?? debouncedSearchQuery,
    statusPulang: overrides.statusPulang ?? 'belum-pulang',
    username: user?.username || '',
    tab: tabValue,
    startDate: overrides.startDate ?? (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''),
    endDate: overrides.endDate ?? (dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''),
    rawatBersamaResumeStatus: overrides.rawatBersamaResumeStatus ?? rawatBersamaResumeStatus,
    claimVerificationStatus: overrides.claimVerificationStatus ?? claimVerificationStatus,
    ...overrides
  });

  const buildResumeRequestBody = (overrides: Partial<Record<string, string>> = {}) => ({
    page: overrides.page ?? currentPage.toString(),
    itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString(),
    search: overrides.search ?? debouncedSearchQuery,
    statusPulang: overrides.statusPulang ?? 'sudah-pulang',
    username: user?.username || '',
    resumeStatus: overrides.resumeStatus ?? resumeStatus,
    jenisDpjp: overrides.jenisDpjp ?? effectiveResumeJenisDpjp,
    verificationStatus: overrides.verificationStatus ?? resumeVerificationStatus,
    startDate: overrides.startDate ?? (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''),
    endDate: overrides.endDate ?? (dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''),
    ...overrides
  });

  const getStatusPulangForActiveTab = (tab: RawatInapStatusTab): string => {
    if (tab === 'belum-diajukan-klaim') {
      return 'belum-diajukan-klaim';
    }

    if (tab === 'belum-resume') {
      return 'belum-resume';
    }

    if (tab === 'sudah-resume') {
      return 'sudah-resume';
    }

    if (tab === 'sudah-pulang') {
      return 'sudah-pulang';
    }

    return 'belum-pulang';
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('tab', activeTab);
    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));
    params.set('resumeStatus', resumeStatus);
    params.set('resumeVerificationStatus', resumeVerificationStatus);
    params.set('rawatBersamaResumeStatus', rawatBersamaResumeStatus);
    params.set('resumeJenisDpjp', effectiveResumeJenisDpjp);
    params.delete('statusPulang');
    params.delete('statusPulangRawatInap');
    params.delete('statusPulangResume');

    const shouldPersistDateRange = activeTab === 'belum-resume';
    if (shouldPersistDateRange) {
      if (dateRange?.from) {
        params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
      } else {
        params.delete('from');
      }

      if (dateRange?.to) {
        params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
      } else {
        params.delete('to');
      }
    } else {
      params.delete('from');
      params.delete('to');
    }

    if (activeTab === 'belum-diajukan-klaim' && claimVerificationStatus !== 'all') {
      params.set('claimVerificationStatus', claimVerificationStatus);
    } else {
      params.delete('claimVerificationStatus');
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
    activeTab,
    currentPage,
    itemsPerPage,
    resumeStatus,
    resumeVerificationStatus,
    rawatBersamaResumeStatus,
    claimVerificationStatus,
    effectiveResumeJenisDpjp,
    searchQuery,
    dateRange?.from,
    dateRange?.to,
    searchParams,
    setSearchParams
  ]);

  const applyTabCounts = (counts: any) => {
    setTabCounts({
      belum_pulang: Number(counts?.belum_pulang || 0),
      sudah_pulang: Number(counts?.sudah_pulang || 0),
      sudah_resume: Number(counts?.sudah_resume || 0),
      belum_resume: Number(counts?.belum_resume || 0),
      belum_diajukan_klaim: Number(counts?.belum_diajukan_klaim || 0)
    });
  };

  const applyHospitalizationPeriod = (value: unknown) => {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    setHospitalizationPeriodMonths((prev) => {
      if (prev === parsed) {
        return prev;
      }

      if (!hasDateRangeQueryRef.current) {
        const nextTo = new Date();
        const nextFrom = subMonths(new Date(), parsed);
        setDateRange({
          from: nextFrom,
          to: nextTo
        });
      }

      return parsed;
    });
  };

  const fetchRawatInapStatusCounts = async () => {
    try {
      const statusEntries = await Promise.all(
        rawatInapTabOptions.map(async (status) => {
          const response = await fetch(API_URLS.RAWAT_INAP_DATA, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              buildRawatInapRequestBody(baseListTab, {
                page: '1',
                itemsPerPage: '1',
                statusPulang: status,
                claimVerificationStatus: 'all',
                includeTabCounts: false
              })
            )
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error);
          }

          applyHospitalizationPeriod(data?.hospitalizationPeriodMonths);
          return [status, Number(data?.total || 0)] as const;
        })
      );

      applyTabCounts({
        belum_pulang: statusEntries.find(([status]) => status === 'belum-pulang')?.[1] || 0,
        sudah_pulang: statusEntries.find(([status]) => status === 'sudah-pulang')?.[1] || 0,
        sudah_resume: statusEntries.find(([status]) => status === 'sudah-resume')?.[1] || 0,
        belum_resume: statusEntries.find(([status]) => status === 'belum-resume')?.[1] || 0,
        belum_diajukan_klaim: statusEntries.find(([status]) => status === 'belum-diajukan-klaim')?.[1] || 0
      });
    } catch (error) {
      console.error('Error fetching Rawat Inap status counts:', error);
      setTabCounts((prev) => ({
        ...emptyTabCounts,
        belum_resume: prev.belum_resume,
        belum_diajukan_klaim: prev.belum_diajukan_klaim
      }));
    }
  };

  const fetchRawatInapData = async (
    tabValue: RawatInapListTab = baseListTab,
    overrides: Partial<RawatInapRequestBody> = {}
  ) => {
    setLoading(true);
    try {
      const requestBody = buildRawatInapRequestBody(tabValue, overrides);
      requestBody.includeTabCounts = false;

      console.log('Fetching Rawat Inap data:', requestBody);

      const response = await fetch(API_URLS.RAWAT_INAP_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching Rawat Inap data:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.error('Error fetching Rawat Inap data:', data.error);
        throw new Error(data.error);
      }

      console.log('Rawat Inap data response:', data);
      applyHospitalizationPeriod(data?.hospitalizationPeriodMonths);
      setRawatInapData(data?.data || []);
      setTotal(data?.total || 0);
      void Promise.allSettled([
        fetchRawatInapStatusCounts()
      ]);

    } catch (error) {
      console.error('Error fetching Rawat Inap data:', error);
      setRawatInapData([]);
      setTotal(0);
      setTabCounts((prev) => ({
        ...emptyTabCounts,
        belum_resume: prev.belum_resume,
        belum_diajukan_klaim: prev.belum_diajukan_klaim
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = (tab: RawatInapStatusTab) => {
    const nextRawatBersamaResumeStatus = pendingRawatBersamaResumeStatus || "belum_ada_resume";

    setRawatBersamaResumeStatus(nextRawatBersamaResumeStatus);
    setIsFilterModalOpen(false);

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchRawatInapData(baseListTab, {
      statusPulang: getStatusPulangForActiveTab(tab),
      rawatBersamaResumeStatus: nextRawatBersamaResumeStatus
    });
  };

  const handleClearFilters = (tab: string) => {
    setSearchQuery("");
    setResumeStatus("belum_resume");
    setResumeVerificationStatus("all");
    setRawatBersamaResumeStatus("belum_ada_resume");
    setClaimVerificationStatus("all");
    setPendingResumeStatus("belum_resume");
    setPendingResumeVerificationStatus("all");
    setPendingRawatBersamaResumeStatus("belum_ada_resume");
    setIsFilterModalOpen(false);
    setDateRange({
      from: defaultRawatInapFrom,
      to: defaultRawatInapTo
    });
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchRawatInapData(baseListTab, {
      statusPulang: getStatusPulangForActiveTab(activeTab),
      ...((activeTab === 'sudah-pulang'
        || activeTab === 'sudah-resume'
        || activeTab === 'belum-diajukan-klaim')
        ? { startDate: '', endDate: '' }
        : {})
    });
  }, [
    activeTab,
    currentPage,
    itemsPerPage,
    baseListTab,
    debouncedSearchQuery,
    claimVerificationStatus,
    dateRange?.from,
    dateRange?.to
  ]);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [dateRange?.from, dateRange?.to]);

  useEffect(() => {
    if (!isFilterModalOpen) {
      return;
    }

    setPendingResumeStatus(resumeStatus);
    setPendingResumeVerificationStatus(resumeVerificationStatus);
    setPendingRawatBersamaResumeStatus(rawatBersamaResumeStatus);
  }, [
    isFilterModalOpen,
    resumeStatus,
    resumeVerificationStatus,
    rawatBersamaResumeStatus
  ]);

  const getInapTitle = (tab: string) => {
    switch (tab) {
      case 'rawat-inap':
        return 'Data Pasien Rawat Inap Rawat Utama';
      case 'rawat-bersama':
        return 'Data Pasien Rawat Inap Rawat Bersama';
      case 'rawat-gabung':
        return 'Data Pasien Rawat Gabung';
      default:
        return 'Data Pasien Rawat Inap';
    }
  };
  const renderInapCard = (filterTab: RawatInapStatusTab, columns: any[]) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{getInapTitle(baseListTab)}</CardTitle>
        {renderFilterSection(filterTab)}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <PatientTable
            patients={rawatInapData}
            columns={columns}
            loading={loading}
            getRowMenuItems={getRawatInapRowMenuItems}
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
        </div>
      </CardContent>
    </Card>
  );

  const renderFilterSection = (tab: RawatInapStatusTab) => {
    const showDateRange = tab === 'belum-resume';
    const showAdvancedFilter = false;
    const showClaimVerificationRadio = tab === 'belum-diajukan-klaim';

    return (
      <>
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

        {showDateRange ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-none">
            <DatePickerPopover
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={indonesianLocale}
              calendarClassName="sm:min-w-[600px]"
              buttonClassName="w-full sm:w-[350px]"
              placeholder="Pilih rentang tanggal"
              displayValue={dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {formatUIDate(dateRange.from)} - {formatUIDate(dateRange.to)}
                  </>
                ) : (
                  formatUIDate(dateRange.from)
                )
              ) : undefined}
            />
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:flex-none lg:shrink-0">
          {showAdvancedFilter ? (
            <Button variant="secondary" onClick={() => setIsFilterModalOpen(true)} className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          ) : null}
          {showClaimVerificationRadio ? (
            <RadioGroup
              value={claimVerificationStatus}
              onValueChange={(value) => {
                setClaimVerificationStatus(value);
                setCurrentPage(1);
              }}
              className="flex items-center gap-3 rounded-md border border-input px-3 py-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="claim-verification-all" />
                <label htmlFor="claim-verification-all" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Semua
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unverified" id="claim-verification-unverified" />
                <label htmlFor="claim-verification-unverified" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Belum Verifikasi
                </label>
              </div>
            </RadioGroup>
          ) : null}
          <Button variant="outline" onClick={() => handleClearFilters(tab)} className="w-full sm:w-auto">
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Pasien Rawat Inap</DialogTitle>
            <DialogDescription>
              Atur filter sesuai tab aktif lalu tekan Terapkan Filter.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Tidak ada filter tambahan pada menu ini.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFilterModalOpen(false)}>
              Batal
            </Button>
            <Button variant="secondary" onClick={() => handleFilterApply(tab)}>
              Terapkan Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={(value) => {
      setCurrentPage(1);
      setActiveTab(value as RawatInapStatusTab);
    }}>
      <TabsList className="mb-4">
        <TabsTrigger value="belum-pulang">
          <Home className="mr-2 h-4 w-4" />
          <span>Belum Pulang ({tabCounts.belum_pulang})</span>
        </TabsTrigger>
        <TabsTrigger value="sudah-pulang">
          <Home className="mr-2 h-4 w-4" />
          <span>Sudah Pulang ({tabCounts.sudah_pulang})</span>
        </TabsTrigger>
        {viewMode === 'rawat-gabung' ? (
          <TabsTrigger value="sudah-resume">
            <File className="mr-2 h-4 w-4" />
            <span>Sudah Resume ({tabCounts.sudah_resume})</span>
          </TabsTrigger>
        ) : (
          <>
            <TabsTrigger value="belum-resume">
              <File className="mr-2 h-4 w-4" />
              <span>Belum Resume ({tabCounts.belum_resume})</span>
            </TabsTrigger>
            <TabsTrigger value="belum-diajukan-klaim">
              <File className="mr-2 h-4 w-4" />
              <span>Belum Diajukan Klaim ({tabCounts.belum_diajukan_klaim})</span>
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="belum-pulang" className="space-y-4">
        {renderInapCard('belum-pulang', getInapColumns('belum-pulang'))}
      </TabsContent>

      <TabsContent value="sudah-pulang" className="space-y-4">
        {renderInapCard('sudah-pulang', getInapColumns('sudah-pulang'))}
      </TabsContent>

      {viewMode === 'rawat-gabung' ? (
        <TabsContent value="sudah-resume" className="space-y-4">
          {renderInapCard('sudah-resume', getInapColumns('sudah-resume'))}
        </TabsContent>
      ) : (
        <>
          <TabsContent value="belum-resume" className="space-y-4">
            {renderInapCard('belum-resume', getInapColumns('belum-resume'))}
          </TabsContent>
          <TabsContent value="belum-diajukan-klaim" className="space-y-4">
            {renderInapCard('belum-diajukan-klaim', getInapColumns('belum-diajukan-klaim'))}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
};

const rawatJagaTabOptions = [
  { value: 'belum-pulang', countKey: 'belumPulang', label: 'Belum Pulang', requestTab: 'rawat-jaga-ranap', statusPulang: 'belum-pulang' },
  { value: 'sudah-pulang', countKey: 'sudahPulang', label: 'Sudah Pulang', requestTab: 'rawat-jaga-ranap', statusPulang: 'sudah-pulang' },
  { value: 'sudah-resume', countKey: 'sudahResume', label: 'Sudah Pulang & Diresume', requestTab: 'rawat-jaga-ranap', statusPulang: 'sudah-resume' },
  { value: 'rawat-gabung', countKey: 'rawatGabung', label: 'Rawat Gabung', requestTab: 'rawat-jaga-gabung', statusPulang: 'belum-pulang' },
  { value: 'rawat-gabung-pulang', countKey: 'rawatGabungPulang', label: 'Rawat Gabung Pulang', requestTab: 'rawat-jaga-gabung', statusPulang: 'sudah-pulang' },
  { value: 'rawat-gabung-sudah-resume', countKey: 'rawatGabungSudahResume', label: 'Rawat Gabung Pulang & Diresume', requestTab: 'rawat-jaga-gabung', statusPulang: 'sudah-resume' }
] as const;

type RawatJagaTab = typeof rawatJagaTabOptions[number]['value'];
type RawatJagaCountKey = typeof rawatJagaTabOptions[number]['countKey'];

const RawatJagaTabs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultRawatJagaFrom = addDays(new Date(), -30);
  const defaultRawatJagaTo = new Date();
  const initialRawatJagaTab = rawatJagaTabOptions.find((item) => item.value === searchParams.get('tab'))?.value || 'belum-pulang';
  const emptyRawatJagaCounts: Record<RawatJagaCountKey, number> = {
    belumPulang: 0,
    sudahPulang: 0,
    sudahResume: 0,
    rawatGabung: 0,
    rawatGabungPulang: 0,
    rawatGabungSudahResume: 0
  };
  const [rawatJagaData, setRawatJagaData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<RawatJagaTab>(initialRawatJagaTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseDateParam(searchParams.get('from'), defaultRawatJagaFrom),
    to: parseDateParam(searchParams.get('to'), defaultRawatJagaTo)
  });
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  const [total, setTotal] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<RawatJagaCountKey, number>>(emptyRawatJagaCounts);
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  const activeConfig = rawatJagaTabOptions.find((item) => item.value === activeTab) || rawatJagaTabOptions[0];
  const showDateRange = activeConfig.statusPulang !== 'belum-pulang';

  const buildRawatJagaRequestBody = (
    config: typeof rawatJagaTabOptions[number],
    overrides: Partial<Record<'page' | 'itemsPerPage' | 'search' | 'startDate' | 'endDate', string>> = {}
  ) => ({
    page: overrides.page ?? currentPage.toString(),
    itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString(),
    search: overrides.search ?? debouncedSearchQuery,
    statusPulang: config.statusPulang,
    username: user?.username || '',
    tab: config.requestTab,
    startDate: overrides.startDate ?? (config.statusPulang !== 'belum-pulang' && dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''),
    endDate: overrides.endDate ?? (config.statusPulang !== 'belum-pulang' && dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''),
    includeTabCounts: false
  });

  const fetchRawatJagaCounts = async () => {
    try {
      const countEntries = await Promise.all(
        rawatJagaTabOptions.map(async (option) => {
          const response = await fetch(API_URLS.RAWAT_INAP_DATA, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(buildRawatJagaRequestBody(option, {
              page: '1',
              itemsPerPage: '1'
            }))
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error);
          }

          return [option.countKey, Number(data?.total || 0)] as const;
        })
      );

      setTabCounts({
        belumPulang: countEntries.find(([key]) => key === 'belumPulang')?.[1] || 0,
        sudahPulang: countEntries.find(([key]) => key === 'sudahPulang')?.[1] || 0,
        sudahResume: countEntries.find(([key]) => key === 'sudahResume')?.[1] || 0,
        rawatGabung: countEntries.find(([key]) => key === 'rawatGabung')?.[1] || 0,
        rawatGabungPulang: countEntries.find(([key]) => key === 'rawatGabungPulang')?.[1] || 0,
        rawatGabungSudahResume: countEntries.find(([key]) => key === 'rawatGabungSudahResume')?.[1] || 0
      });
    } catch (error) {
      console.error('Error fetching Rawat Jaga counts:', error);
      setTabCounts(emptyRawatJagaCounts);
    }
  };

  const fetchRawatJagaData = async (tabValue: RawatJagaTab = activeTab) => {
    const selectedConfig = rawatJagaTabOptions.find((item) => item.value === tabValue) || rawatJagaTabOptions[0];

    setLoading(true);
    try {
      const response = await fetch(API_URLS.RAWAT_INAP_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildRawatJagaRequestBody(selectedConfig))
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      setRawatJagaData(Array.isArray(data?.data) ? data.data : []);
      setTotal(Number(data?.total || 0));
      void fetchRawatJagaCounts();
    } catch (error) {
      console.error('Error fetching Rawat Jaga data:', error);
      setRawatJagaData([]);
      setTotal(0);
      setTabCounts(emptyRawatJagaCounts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('tab', activeTab);
    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));

    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }

    if (showDateRange) {
      if (dateRange?.from) {
        params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
      } else {
        params.delete('from');
      }

      if (dateRange?.to) {
        params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
      } else {
        params.delete('to');
      }
    } else {
      params.delete('from');
      params.delete('to');
    }

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    activeTab,
    currentPage,
    itemsPerPage,
    searchQuery,
    showDateRange,
    dateRange?.from,
    dateRange?.to,
    searchParams,
    setSearchParams
  ]);

  useEffect(() => {
    fetchRawatJagaData(activeTab);
  }, [activeTab, currentPage, itemsPerPage, debouncedSearchQuery, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    if (!showDateRange) {
      return;
    }

    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [dateRange?.from, dateRange?.to, showDateRange]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateRange({
      from: defaultRawatJagaFrom,
      to: defaultRawatJagaTo
    });
    setCurrentPage(1);
  };

  const openMedicalRecordInlineTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    dispatchOpenMedicalRecordTab({
      noRkmMedis: String(row.no_rkm_medis),
      noRawat: normalizeMedicalRecordVisitNoRawat(String(row.no_rawat)),
      patientName: String(row.nm_pasien || '').trim(),
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
    navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=monitoring&source=rawat-inap`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  const getRawatJagaRowMenuItems = (row: any) => [
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

  const rawatJagaColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'jenis_kelamin', header: 'JK' },
    { accessor: 'tgl_masuk', header: 'Tgl Masuk' },
    ...(activeConfig.statusPulang !== 'belum-pulang' ? [{ accessor: 'tgl_keluar', header: 'Tgl Keluar' }] : []),
    { accessor: 'kd_kamar', header: 'Kamar' },
    { accessor: 'nm_bangsal', header: 'Bangsal' },
    {
      accessor: 'dokter_dpjp',
      header: 'DPJP',
      render: (row: any) => <DokterDPJPCell dokterDpjp={row.dokter_dpjp} caraBayar={row.cara_bayar} />
    },
    { accessor: 'stts_pulang', header: 'Status Pulang' },
    {
      accessor: 'lama',
      header: 'Lama Rawat',
      render: (row: any) => <span className="text-sm">{row.lama ? `${row.lama} hari` : '-'}</span>
    }
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        setCurrentPage(1);
        setActiveTab(value as RawatJagaTab);
      }}
    >
      <TabsList className="mb-4">
        {rawatJagaTabOptions.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.value === 'belum-pulang'
              || option.value === 'sudah-pulang'
              || option.value === 'rawat-gabung'
              || option.value === 'rawat-gabung-pulang' ? (
              <Home className="mr-2 h-4 w-4" />
            ) : (
              <File className="mr-2 h-4 w-4" />
            )}
            <span>{option.label} ({tabCounts[option.countKey]})</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {rawatJagaTabOptions.map((option) => (
        <TabsContent key={option.value} value={option.value} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>
                {option.requestTab === 'rawat-jaga-gabung' ? 'Data Pasien Rawat Jaga Rawat Gabung' : 'Data Pasien Rawat Jaga'}
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

                {option.statusPulang !== 'belum-pulang' ? (
                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-none">
                    <DatePickerPopover
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={indonesianLocale}
                      calendarClassName="sm:min-w-[600px]"
                      buttonClassName="w-full sm:w-[350px]"
                      placeholder="Pilih rentang tanggal pulang"
                      displayValue={dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {formatUIDate(dateRange.from)} - {formatUIDate(dateRange.to)}
                          </>
                        ) : (
                          formatUIDate(dateRange.from)
                        )
                      ) : undefined}
                    />
                  </div>
                ) : null}

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:flex-none lg:shrink-0">
                  <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto">
                    <X className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PatientTable
                patients={rawatJagaData}
                columns={rawatJagaColumns}
                loading={loading}
                getRowMenuItems={getRawatJagaRowMenuItems}
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

const IGDTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const igdTabOptions = ['triase', 'observasi', 'tindakan'] as const;
  const emptyIgdTabCounts = { triase: 0, observasi: 0, tindakan: 0 };
  const normalizeIgdTriaseFilter = (value: string | null) => {
    const normalized = String(value || '').trim().toUpperCase();
    const legacyMap: Record<string, string> = {
      T001: 'KL01',
      T002: 'KL03',
      T003: 'KL05',
      T004: 'KL02'
    };

    if (!normalized) return 'all';
    if (normalized === 'ALL') return 'all';
    return legacyMap[normalized] || normalized;
  };
  const initialIGDTab = igdTabOptions.includes(searchParams.get('tab') as typeof igdTabOptions[number])
    ? searchParams.get('tab') as typeof igdTabOptions[number]
    : 'triase';
  const defaultIGDDate = new Date();
  const [igdData, setIgdData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<typeof igdTabOptions[number]>(initialIGDTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || "all");
  const [doctorFilter, setDoctorFilter] = useState(searchParams.get('doctor') || "all");
  const [triaseLevel, setTriaseLevel] = useState(normalizeIgdTriaseFilter(searchParams.get('triase')));
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [pendingStatusFilter, setPendingStatusFilter] = useState(searchParams.get('status') || "all");
  const [pendingDoctorFilter, setPendingDoctorFilter] = useState(searchParams.get('doctor') || "all");
  const [pendingTriaseLevel, setPendingTriaseLevel] = useState(normalizeIgdTriaseFilter(searchParams.get('triase')));
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseDateParam(searchParams.get('from'), defaultIGDDate),
    to: parseDateParam(searchParams.get('to'), defaultIGDDate)
  });
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  const [tabCounts, setTabCounts] = useState(emptyIgdTabCounts);
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);

  const fetchIGDData = async (tab: string, overrides: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const requestParams = {
        page: overrides.page ?? currentPage.toString(),
        itemsPerPage: overrides.itemsPerPage ?? itemsPerPage.toString(),
        search: overrides.search ?? debouncedSearchQuery,
        status: overrides.status ?? statusFilter,
        kd_dokter: overrides.kd_dokter ?? doctorFilter,
        triase_level: overrides.triase_level ?? triaseLevel,
        date_from: overrides.date_from ?? (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''),
        date_to: overrides.date_to ?? (dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''),
        tab: tab
      };

      const params = new URLSearchParams(requestParams);

      console.log('=== IGD Data Fetch Start ===');
      console.log('Tab:', tab);
      console.log('Current page:', currentPage);
      console.log('Items per page:', itemsPerPage);
      console.log('Search query:', searchQuery);
      console.log('Status filter:', statusFilter);
      console.log('Triase level:', triaseLevel);
      console.log('Date range:', dateRange);
      console.log('Request params object:', requestParams);
      console.log('URL params string:', params.toString());
      console.log('Full URL:', `${API_URLS.IGD_DATA}?${params.toString()}`);
      const response = await fetch(
        `${API_URLS.IGD_DATA}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('=== IGD Data Fetch Response ===');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('=== Response Not OK ===');
        console.error('Status:', response.status);
        console.error('Status text:', response.statusText);
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('=== IGD Data Processing ===');
      console.log('Raw response data:', data);
      console.log('Data type:', typeof data);
      console.log('Data keys:', data ? Object.keys(data) : 'No data');
      console.log('Data.data array:', data?.data);
      console.log('Data.data length:', data?.data ? data.data.length : 0);
      console.log('Data.total:', data?.total);
      console.log('First record sample:', data?.data?.[0]);

      if (data) {
        setIgdData(data.data || []);
        setTotal(data.total || 0);
        setTabCounts({
          triase: Number(data?.tabCounts?.triase || 0),
          observasi: Number(data?.tabCounts?.observasi || 0),
          tindakan: Number(data?.tabCounts?.tindakan || 0)
        });
        console.log('State updated - igdData length:', data.data ? data.data.length : 0);
        console.log('State updated - total:', data.total || 0);
      } else {
        console.warn('=== No Data Received ===');
        setIgdData([]);
        setTotal(0);
        setTabCounts(emptyIgdTabCounts);
      }

    } catch (error) {
      console.error('=== IGD Data Fetch Exception ===');
      console.error('Exception type:', error.constructor.name);
      console.error('Exception message:', error.message);
      console.error('Exception stack:', error.stack);
      console.error('Full exception object:', error);
      setIgdData([]);
      setTotal(0);
      setTabCounts(emptyIgdTabCounts);
    } finally {
      console.log('=== IGD Data Fetch Complete ===');
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const fetchIGDDoctors = async () => {
    try {
      const response = await fetch(API_URLS.BOOKING_REGISTRASI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'getDoctors' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch doctors');
      }

      setDoctors(data?.doctors || []);
    } catch (error) {
      console.error('Error fetching IGD doctors:', error);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('tab', activeTab);
    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));
    params.set('status', statusFilter);
    params.set('doctor', doctorFilter);
    params.set('triase', triaseLevel);

    if (dateRange?.from) {
      params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }

    if (dateRange?.to) {
      params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
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
    activeTab,
    currentPage,
    itemsPerPage,
    searchQuery,
    statusFilter,
    doctorFilter,
    triaseLevel,
    dateRange?.from,
    dateRange?.to,
    searchParams,
    setSearchParams
  ]);

  useEffect(() => {
    fetchIGDData(activeTab);
  }, [activeTab, currentPage, itemsPerPage, debouncedSearchQuery, statusFilter, doctorFilter, triaseLevel, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    fetchIGDDoctors();
  }, []);

  useEffect(() => {
    if (!isFilterModalOpen) {
      return;
    }

    setPendingStatusFilter(statusFilter);
    setPendingDoctorFilter(doctorFilter);
    setPendingTriaseLevel(triaseLevel);
  }, [isFilterModalOpen, statusFilter, doctorFilter, triaseLevel]);

  const handleFilterApply = (tab: string) => {
    const nextStatusFilter = pendingStatusFilter || "all";
    const nextDoctorFilter = pendingDoctorFilter || "all";
    const nextTriaseLevel = pendingTriaseLevel || "all";

    setStatusFilter(nextStatusFilter);
    setDoctorFilter(nextDoctorFilter);
    setTriaseLevel(nextTriaseLevel);
    setDoctorOpen(false);
    setIsFilterModalOpen(false);

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchIGDData(tab, {
      status: nextStatusFilter,
      kd_dokter: nextDoctorFilter,
      triase_level: nextTriaseLevel
    });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDoctorFilter("all");
    setTriaseLevel("all");
    setPendingStatusFilter("all");
    setPendingDoctorFilter("all");
    setPendingTriaseLevel("all");
    setDoctorOpen(false);
    setIsFilterModalOpen(false);
    setDateRange({
      from: defaultIGDDate,
      to: defaultIGDDate
    });
    setCurrentPage(1);
  };

  const openMedicalRecordInlineTab = (row: any) => {
    if (!row?.no_rkm_medis || !row?.no_rawat) {
      return;
    }

    dispatchOpenMedicalRecordTab({
      noRkmMedis: String(row.no_rkm_medis),
      noRawat: normalizeMedicalRecordVisitNoRawat(String(row.no_rawat)),
      patientName: String(row.nm_pasien || '').trim(),
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
    navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=initiation&source=igd`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  const getIgdRowMenuItems = (row: any) => [
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

  const getIgdTriaseBadgeTone = (value: string) => {
    switch ((value || '').toLowerCase()) {
      case 'merah':
        return 'red' as const;
      case 'merah muda':
        return 'pink' as const;
      case 'kuning':
        return 'amber' as const;
      case 'hijau muda':
        return 'lime' as const;
      case 'hijau':
        return 'green' as const;
      case 'hitam':
        return 'dark' as const;
      default:
        return 'slate' as const;
    }
  };

  const igdColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'tgl_registrasi', header: 'Tanggal' },
    { accessor: 'jam_reg', header: 'Jam' },
    { accessor: 'nm_dokter', header: 'Dokter' },
    {
      accessor: 'triase_level',
      header: 'Level Triase',
      render: (row: any) => {
        const triaseLevelLabel = String(row.triase_level || 'Belum Triase').trim() || 'Belum Triase';
        return <StatusPill label={triaseLevelLabel} tone={getIgdTriaseBadgeTone(triaseLevelLabel)} />;
      }
    },
    {
      accessor: 'nm_tindakan',
      header: 'Tindakan',
      render: (row: any) => {
        const tindakan = String(row.nm_tindakan || '').trim() || 'Belum Ada Tindakan';
        const tindakanItems = tindakan
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean);
        const compactText = tindakanItems.length > 2
          ? `${tindakanItems.slice(0, 2).join(', ')} +${tindakanItems.length - 2} lainnya`
          : tindakan;

        return (
          <div className="max-w-[240px]" title={tindakan}>
            <div className="truncate text-sm font-medium">{compactText}</div>
            {row.kd_tindakan ? (
              <div className="truncate text-xs text-muted-foreground" title={String(row.kd_tindakan)}>
                Kode: {String(row.kd_tindakan)}
              </div>
            ) : null}
          </div>
        );
      }
    },
    { accessor: 'status', header: 'Status' }
  ];

  const renderFilterSection = (tab: string) => (
    <>
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
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={indonesianLocale}
            calendarClassName="sm:min-w-[600px]"
            buttonClassName="w-full sm:w-[350px]"
            placeholder="Pilih rentang tanggal"
            displayValue={dateRange?.from ? (
              dateRange.to ? (
                <>
                  {formatUIDate(dateRange.from)} - {formatUIDate(dateRange.to)}
                </>
              ) : (
                formatUIDate(dateRange.from)
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
            Reset
          </Button>
        </div>
      </div>

      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Pasien IGD</DialogTitle>
            <DialogDescription>
              Atur status, dokter, dan level triase, lalu tekan Terapkan Filter.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Status</div>
              <Select value={pendingStatusFilter} onValueChange={setPendingStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="Menunggu">Menunggu</SelectItem>
                  <SelectItem value="Triase">Triase</SelectItem>
                  <SelectItem value="Selesai">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Dokter</div>
              <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={doctorOpen}
                    className="w-full justify-between"
                  >
                    {pendingDoctorFilter !== "all"
                      ? doctors.find((doctor) => doctor.kd_dokter === pendingDoctorFilter)?.nm_dokter
                      : "Semua Dokter"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Cari dokter..." />
                    <CommandList>
                      <CommandEmpty>Tidak ada dokter ditemukan.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setPendingDoctorFilter("all");
                            setDoctorOpen(false);
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4",
                              pendingDoctorFilter === "all" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Semua Dokter
                        </CommandItem>
                        {doctors.map((doctor) => (
                          <CommandItem
                            key={doctor.kd_dokter}
                            value={doctor.nm_dokter}
                            onSelect={() => {
                              setPendingDoctorFilter(doctor.kd_dokter);
                              setDoctorOpen(false);
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                "mr-2 h-4 w-4",
                                pendingDoctorFilter === doctor.kd_dokter ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {doctor.nm_dokter}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Level Triase</div>
              <Select value={pendingTriaseLevel} onValueChange={setPendingTriaseLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Level Triase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Level</SelectItem>
                  <SelectItem value="KL01">Merah</SelectItem>
                  <SelectItem value="KL02">Merah Muda</SelectItem>
                  <SelectItem value="KL03">Kuning</SelectItem>
                  <SelectItem value="KL04">Hijau Muda</SelectItem>
                  <SelectItem value="KL05">Hijau</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFilterModalOpen(false)}>
              Batal
            </Button>
            <Button variant="secondary" onClick={() => handleFilterApply(tab)}>
              Terapkan Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <Tabs value={activeTab} onValueChange={(value) => {
      setCurrentPage(1);
      setActiveTab(value as typeof igdTabOptions[number]);
    }}>
      <TabsList className="mb-4">
        <TabsTrigger value="triase">
          <List className="mr-2 h-4 w-4" />
          <span>Triase ({tabCounts.triase})</span>
        </TabsTrigger>
        <TabsTrigger value="observasi">
          <Clock className="mr-2 h-4 w-4" />
          <span>Observasi ({tabCounts.observasi})</span>
        </TabsTrigger>
        <TabsTrigger value="tindakan">
          <Check className="mr-2 h-4 w-4" />
          <span>Tindakan ({tabCounts.tindakan})</span>
        </TabsTrigger>
      </TabsList>

      {['triase', 'observasi', 'tindakan'].map((tabValue) => (
        <TabsContent key={tabValue} value={tabValue} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>
                {tabValue === 'triase' && 'Triase IGD'}
                {tabValue === 'observasi' && 'Observasi IGD'}
                {tabValue === 'tindakan' && 'Tindakan IGD'}
              </CardTitle>
              {renderFilterSection(tabValue)}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <PatientTable 
                  patients={igdData} 
                  columns={igdColumns}
                  loading={loading}
                  getRowMenuItems={getIgdRowMenuItems}
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};


const Patients = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const path = location.pathname;
  const [openMedicalRecordTabs, setOpenMedicalRecordTabs] = useState<MedicalRecordWorkspaceTab[]>([]);
  const [activeMedicalRecordTabId, setActiveMedicalRecordTabId] = useState<string>(LIST_PASIEN_TAB_ID);
  const [medicalRecordReloadCounters, setMedicalRecordReloadCounters] = useState<Record<string, number>>({});
  const patientTabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const patientTabsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  let title = "Rawat Jalan";
  let description = "Pasien yang mendapatkan pelayanan medis tanpa harus menginap di rumah sakit";
  let tabs = <RawatJalanTabs />;

  useEffect(() => {
    const handleOpenMedicalRecordTab = (event: Event) => {
      const detail = (event as CustomEvent<OpenMedicalRecordTabDetail>).detail;
      if (!detail?.noRkmMedis || !detail?.noRawat) {
        return;
      }

      const nextTab: MedicalRecordWorkspaceTab = {
        id: `${detail.noRkmMedis}-${detail.noRawat}`,
        noRkmMedis: detail.noRkmMedis,
        noRawat: detail.noRawat,
        patientName: detail.patientName || `Pasien ${detail.noRkmMedis}`,
        sourcePath: detail.sourcePath
      };

      setOpenMedicalRecordTabs((previous) => {
        const existingTab = previous.find((tab) => tab.id === nextTab.id);
        if (existingTab) {
          const remainingTabs = previous.filter((tab) => tab.id !== nextTab.id);
          return [nextTab, ...remainingTabs];
        }

        return [nextTab, ...previous];
      });
      setActiveMedicalRecordTabId(nextTab.id);
      setMedicalRecordReloadCounters((previous) => ({
        ...previous,
        [nextTab.id]: (previous[nextTab.id] ?? 0) + 1
      }));
    };

    const handleCloseAllMedicalRecordTabs = () => {
      setOpenMedicalRecordTabs([]);
      setActiveMedicalRecordTabId(LIST_PASIEN_TAB_ID);
      setMedicalRecordReloadCounters({});
    };

    window.addEventListener(OPEN_MEDICAL_RECORD_TAB_EVENT, handleOpenMedicalRecordTab as EventListener);
    window.addEventListener(CLOSE_ALL_MEDICAL_RECORD_TABS_EVENT, handleCloseAllMedicalRecordTabs);

    return () => {
      window.removeEventListener(OPEN_MEDICAL_RECORD_TAB_EVENT, handleOpenMedicalRecordTab as EventListener);
      window.removeEventListener(CLOSE_ALL_MEDICAL_RECORD_TABS_EVENT, handleCloseAllMedicalRecordTabs);
    };
  }, []);

  const activateMedicalRecordTab = (tabId: string, shouldReload = false) => {
    setOpenMedicalRecordTabs((previous) => {
      const targetTab = previous.find((tab) => tab.id === tabId);
      if (!targetTab) {
        return previous;
      }

      const remainingTabs = previous.filter((tab) => tab.id !== tabId);
      return [targetTab, ...remainingTabs];
    });

    setActiveMedicalRecordTabId(tabId);

    if (shouldReload) {
      setMedicalRecordReloadCounters((previous) => ({
        ...previous,
        [tabId]: (previous[tabId] ?? 0) + 1
      }));
    }
  };

  const closeMedicalRecordTab = (tabId: string) => {
    setOpenMedicalRecordTabs((previous) => {
      const currentIndex = previous.findIndex((tab) => tab.id === tabId);
      const nextTabs = previous.filter((tab) => tab.id !== tabId);

      setActiveMedicalRecordTabId((currentActiveTabId) => {
        if (currentActiveTabId !== tabId) {
          return currentActiveTabId;
        }

        if (!nextTabs.length) {
          return LIST_PASIEN_TAB_ID;
        }

        const fallbackIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        return nextTabs[Math.min(fallbackIndex, nextTabs.length - 1)].id;
      });

      return nextTabs;
    });

    setMedicalRecordReloadCounters((previous) => {
      if (!(tabId in previous)) {
        return previous;
      }

      const nextCounters = { ...previous };
      delete nextCounters[tabId];
      return nextCounters;
    });
  };

  const closeOtherMedicalRecordTabs = () => {
    if (activeMedicalRecordTabId === LIST_PASIEN_TAB_ID) {
      setOpenMedicalRecordTabs([]);
      setMedicalRecordReloadCounters({});
      return;
    }

    setOpenMedicalRecordTabs((previous) => previous.filter((tab) => tab.id === activeMedicalRecordTabId));
    setMedicalRecordReloadCounters((previous) => {
      const activeCounter = previous[activeMedicalRecordTabId];
      return activeCounter === undefined ? {} : { [activeMedicalRecordTabId]: activeCounter };
    });
  };

  const closeAllMedicalRecordTabs = () => {
    setOpenMedicalRecordTabs([]);
    setActiveMedicalRecordTabId(LIST_PASIEN_TAB_ID);
    setMedicalRecordReloadCounters({});
  };

  const scrollPatientTabs = (direction: 'left' | 'right') => {
    const container = patientTabsScrollContainerRef.current;
    if (!container) {
      return;
    }

    const scrollAmount = Math.max(container.clientWidth * 0.7, 220);
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const activeMedicalRecordTab = openMedicalRecordTabs.find((tab) => tab.id === activeMedicalRecordTabId) || null;

  useEffect(() => {
    if (activeMedicalRecordTabId === LIST_PASIEN_TAB_ID) {
      return;
    }

    const activeTabElement = patientTabRefs.current[activeMedicalRecordTabId];
    if (!activeTabElement) {
      return;
    }

    activeTabElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }, [activeMedicalRecordTabId, openMedicalRecordTabs]);
  
  if (path.includes('booking')) {
    title = "Booking";
    description = "Pasien yang telah memesan jadwal kunjungan atau kontrol dengan dokter";
    tabs = <BookingTabs />;
  } else if (path.includes('igd')) {
    title = "IGD";
    description = "Pasien yang memerlukan penanganan darurat segera di Instalasi Gawat Darurat (IGD) rumah sakit";
    tabs = <IGDTabs />;
  } else if (path.includes('rawat-gabung')) {
    title = "Rawat Gabung";
    description = "Pasien rawat gabung yang ditangani user.";
    tabs = <RawatInapTabs key="rawat-gabung" viewMode="rawat-gabung" />;
  } else if (path.includes('rawat-jaga')) {
    title = "Rawat Jaga";
    description = "Pasien rawat inap dan rawat gabung yang ditangani sebagai Dokter Jaga.";
    tabs = <RawatJagaTabs />;
  } else if (path.includes('rawat-inap')) {
    title = "Rawat Inap";
    description = "Pasien yang mendapatkan perawatan medis yang intensif, meliputi observasi, diagnosis, pengobatan, keperawatan, dan rehabilitasi. ";
    tabs = (
      <RawatInapTabs
        key={path.includes('/raber') ? 'rawat-inap-raber' : 'rawat-inap-utama'}
        viewMode={path.includes('/raber') ? 'raber' : 'utama'}
      />
    );
  } else if (path.includes('hemodialisa')) {
    if (path.includes('/peritoneal-dialisis')) {
      title = "Peritoneal Dialisis";
      description = "Daftar pasien peritoneal dialisis.";
    } else {
      title = "Hemo Dialisis";
      description = "Daftar pasien hemo dialisis.";
    }
    tabs = <HemodialisaTabs />;
  }
  
  return (
    <div className="mx-auto w-full animate-fade-in space-y-3 rounded-lg bg-slate-50 p-2 shadow-md transition-colors dark:bg-slate-950 dark:shadow-slate-950/40 md:space-y-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <User size={24} className="text-primary" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 md:text-2xl">Pasien {title}</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 md:text-base">{description}</p>
        <Separator className="mt-2" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="border-b bg-muted/30 px-2 pt-2">
            <div className="flex items-end gap-2">
                <div className="shrink-0 border-r border-border/60 pr-2">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-2 transition-colors",
                    activeMedicalRecordTabId === LIST_PASIEN_TAB_ID
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      : "border-transparent bg-amber-100/70 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/5 dark:text-amber-300 dark:hover:bg-amber-500/10"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveMedicalRecordTabId(LIST_PASIEN_TAB_ID)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span className="text-sm font-medium whitespace-nowrap">List Pasien</span>
                  </button>
                </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => scrollPatientTabs('left')}
                    disabled={openMedicalRecordTabs.length === 0}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                <div
                  ref={patientTabsScrollContainerRef}
                  className="min-w-0 flex-1 overflow-x-auto scroll-smooth"
                >
                  <div className="flex min-w-max gap-1">
                {openMedicalRecordTabs.map((tab) => {
                  const isActive = tab.id === activeMedicalRecordTabId;

                  return (
                    <div
                      key={tab.id}
                      ref={(element) => {
                        patientTabRefs.current[tab.id] = element;
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-2 transition-colors",
                        isActive
                          ? "border-primary bg-background text-primary"
                          : "border-transparent bg-transparent text-muted-foreground hover:bg-background/70"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => activateMedicalRecordTab(tab.id)}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <span className="max-w-[240px] truncate text-sm font-medium">
                          {tab.patientName || `Pasien ${tab.noRkmMedis}`}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatMedicalRecordWorkspaceNoRawat(tab.noRawat)}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => closeMedicalRecordTab(tab.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  );
                })}
                  </div>
                </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => scrollPatientTabs('right')}
                    disabled={openMedicalRecordTabs.length === 0}
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={openMedicalRecordTabs.length === 0}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-52 p-2">
                      <div className="space-y-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={closeOtherMedicalRecordTabs}
                          disabled={openMedicalRecordTabs.length === 0}
                        >
                          Tutup Tab Lainnya
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-destructive hover:text-destructive"
                          onClick={closeAllMedicalRecordTabs}
                          disabled={openMedicalRecordTabs.length === 0}
                        >
                          Tutup Semua Tab
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
            </div>
          </div>
          <div className={cn(activeMedicalRecordTabId === LIST_PASIEN_TAB_ID ? "block" : "hidden")}>
            {tabs}
          </div>
          {openMedicalRecordTabs.map((tab) => (
            <div
              key={tab.id}
              className={cn("bg-background", activeMedicalRecordTabId === tab.id ? "block" : "hidden")}
            >
              <MedicalRecord
                key={`${tab.id}-${medicalRecordReloadCounters[tab.id] ?? 0}`}
                noRkmMedis={tab.noRkmMedis}
                noRawat={tab.noRawat}
                embedded
                workspaceActive={activeMedicalRecordTabId === tab.id}
                defaultStatusRawat={path.includes('rawat-inap') ? 'Ranap' : 'Ralan'}
              />
            </div>
          ))}
        </div>
    </div>
  );
};
export default Patients;
