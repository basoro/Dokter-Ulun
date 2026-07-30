import React from 'react';
import logoImg from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronsUpDown,
  ClipboardList,
  Loader2,
  Printer,
  RefreshCw,
  Search
} from 'lucide-react';

type TabKey =
  | 'dashboard'
  | 'master'
  | 'template'
  | 'mapping'
  | 'generator'
  | 'monitoring';

type MasterSummary = {
  master_count: number;
  template_count: number;
  mapping_count: number;
  patient_count: number;
  active_patient_count: number;
  average_compliance_percentage: number;
};

type DashboardPatient = {
  id: number;
  no_rawat: string;
  no_rkm_medis?: string;
  nm_pasien: string;
  kode_cp: string;
  nama_cp: string;
  compliance_percentage: number;
  status_cp: string;
};

type MasterItem = {
  id: number;
  kode_cp: string;
  nama_cp: string;
  jenis_layanan: 'Ralan' | 'Ranap';
  target_los: number;
  target_tarif: number;
  confidence_score: number;
  guideline_note: string;
  evidence_note?: string;
  aktif: 'Ya' | 'Tidak';
  diagnosis_count: number;
  day_count: number;
  activity_count: number;
};

type MasterOption = MasterItem;

type MasterForm = {
  id: number | null;
  kode_cp: string;
  nama_cp: string;
  deskripsi: string;
  target_los: number;
  jenis_layanan: 'Ralan' | 'Ranap';
  aktif: 'Ya' | 'Tidak';
  target_tarif: number;
  confidence_score: number;
  evidence_note: string;
};

type TemplateItem = {
  id: number;
  clinical_pathway_id: number;
  kode_cp: string;
  nama_cp: string;
  clinical_pathway_day_id: number;
  hari_ke: number;
  kegiatan: string;
  tujuan_harian?: string;
  kategori: string;
  uraian_kegiatan: string;
  aktivitas: string;
  keterangan: string;
  wajib: 'Ya' | 'Tidak';
  urutan: number;
};

type TemplateForm = {
  id: number | null;
  clinical_pathway_id: number;
  clinical_pathway_day_id: number | null;
  hari_ke: number;
  urutan: number;
  kategori: string;
  kegiatan: string;
  tujuan_harian: string;
  uraian_kegiatan: string;
  aktivitas: string;
  keterangan: string;
  wajib: 'Ya' | 'Tidak';
};

type MappingItem = {
  id: number;
  clinical_pathway_id: number;
  kode_cp: string;
  nama_cp: string;
  kd_penyakit: string;
  nm_penyakit: string;
  confidence_score: number;
  prioritas: number;
  tipe: 'Utama' | 'Sekunder';
};

type MappingForm = {
  id: number | null;
  clinical_pathway_id: number;
  kd_penyakit: string;
  nm_penyakit: string;
  confidence_score: number;
  prioritas: number;
  tipe: 'Utama' | 'Sekunder';
};

type IcdSearchItem = {
  kd_penyakit: string;
  nm_penyakit: string;
};

type GeneratorRecommendation = {
  id: number;
  kode_cp: string;
  nama_cp: string;
  status_layanan: string;
  target_los: number;
  confidence_score: number;
  matched_icd_count: number;
};

type GeneratorTemplateDay = {
  hari_ke: number;
  label_hari: string;
  activities: Array<{
    kategori: string;
    uraian_kegiatan: string;
    item_nama: string;
    keterangan: string;
  }>;
};

type GeneratorPreview = {
  registration: {
    no_rkm_medis: string;
    no_rawat: string;
    nm_pasien: string;
    nm_dokter?: string;
    nm_poli?: string;
    status_lanjut: string;
    tgl_registrasi?: string;
  };
  diagnoses: Array<{
    kd_penyakit: string;
    nm_penyakit: string;
  }>;
  existing: {
    id: number;
    clinical_pathway_id: number;
    kode_cp: string;
    nama_cp: string;
    status_cp: string;
    compliance_percentage: number;
  } | null;
  master_recommendations: GeneratorRecommendation[];
  selected_clinical_pathway_id: number | null;
  master_template: {
    days: GeneratorTemplateDay[];
  };
  historical_template: {
    source_case_count: number;
    days: GeneratorTemplateDay[];
  };
};

type GeneratorCandidateItem = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  tgl_masuk?: string;
  bangsal_labels: string[];
  kamar_labels: string[];
  matched_icd_count: number;
  matched_icd_labels: string[];
  matched_clinical_pathway_count: number;
  matched_clinical_pathway_labels: string[];
  existing: {
    patient_id: number;
    kode_cp: string;
    nama_cp: string;
    status_cp: string;
  } | null;
};

type GeneratorCandidateFilterOptions = {
  bangsal_options: string[];
  kamar_options: string[];
};

type GeneratorBatchSelectionItem = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  has_existing_cp: boolean;
};

type MonitoringListItem = {
  id: number;
  no_rawat: string;
  no_rkm_medis?: string;
  nm_pasien: string;
  kode_cp: string;
  nama_cp: string;
  nm_penyakit: string;
  status_cp: string;
  compliance_percentage: number;
  tanggal_mulai?: string;
};

type MonitoringExecutionItem = {
  id: number;
  hari_ke: number;
  status: string;
  kategori: string;
  kegiatan: string;
  uraian_kegiatan: string;
  aktivitas: string;
  keterangan: string;
  catatan?: string;
};

type MonitoringVarianceItem = {
  id: number;
  hari_ke: number;
  kategori_variance: string;
  deskripsi: string;
  status: string;
  severity: string;
  tanggal_variance: string;
};

type MonitoringDetail = {
  patient: {
    id: number;
    no_rawat: string;
    no_rkm_medis: string;
    nm_pasien: string;
    jk?: string;
    tgl_lahir?: string;
    tgl_registrasi?: string;
    jam_reg?: string;
    tgl_masuk?: string;
    tgl_keluar?: string;
    tanggal_selesai?: string;
    status_layanan?: string;
    kd_penyakit: string;
    nm_penyakit: string;
    kode_cp: string;
    nama_cp: string;
    target_los: number;
    status_cp: string;
    compliance_percentage: number;
    variance_count: number;
  };
  execution: MonitoringExecutionItem[];
  variance: MonitoringVarianceItem[];
};

type ApiListResponse<T> = {
  success: boolean;
  data?: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

type ApiDetailResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type SearchableMasterSelectProps = {
  options: MasterOption[];
  value: number;
  onChange: (value: number) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
};

type SearchableCategorySelectProps = {
  groups: Array<{ label: string; options: string[] }>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
};

type SearchableStringSelectProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
};

type DashboardResponse = {
  success: boolean;
  data?: {
    summary: MasterSummary;
    latest_patients: DashboardPatient[];
  };
  message?: string;
};

const CATEGORY_GROUP_OPTIONS = [
  {
    label: 'Pemeriksaan dan Asesmen',
    options: ['Pemeriksaan klinis', 'Laboratorium', 'Radiologi/ imaging', 'Elektromedik', 'Konsultasi', 'Asesmen klinis', 'diagnosis', 'asesmen lanjutan']
  },
  {
    label: 'Edukasi dan Form',
    options: [
      'Edukasi',
      'Pengisian form',
      'Prosedur administrasi',
      'Rencana pulang/edukasi',
      'kriteria pulang',
      'rencana pulang / edukasi pelayanan lanjutan'
    ]
  },
  {
    label: 'Terapi/ medikamentosa',
    options: [
      'Terapi/ medikamentosa',
      'Tatalaksana/Intervensi',
      'Terapi/ medikamentosa - Injeksi',
      'Terapi/ medikamentosa - Obat anestesi',
      'Terapi/ medikamentosa - Cairan infus',
      'Terapi/ medikamentosa - Obat oral',
      'Terapi/ medikamentosa - Benang'
    ]
  },
  {
    label: 'Diet dan Tindakan',
    options: ['Diet/nutrisi', 'Tindakan', 'Mobilisasi']
  },
  {
    label: 'Monitoring (Post Op)',
    options: [
      'Monitoring dan Evaluasi',
      'Monitoring (Post Op)',
      'Monitoring (Post Op) - Perawat',
      'Monitoring (Post Op) - Dokter ruangan',
      'Monitoring (Post Op) - Dokter DPJP'
    ]
  },
  {
    label: 'Outcome dan Variasi',
    options: ['Outcome', 'Variasi']
  }
];

const topButtonClass = 'rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-muted hover:text-primary';
const activeTopButtonClass = 'rounded-md border border-primary/20 bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 px-3 py-2';
const panelClass = 'overflow-hidden rounded-md border bg-white shadow-sm transition-colors dark:bg-slate-950 dark:border-slate-800';
const panelHeaderClass = 'border-b bg-muted/40 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 dark:border-slate-800';
const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const textareaClass = 'min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const tableHeadClass = 'border-b bg-muted/50 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 dark:border-slate-800';
const tableCellClass = 'border-b px-3 py-2 text-xs text-slate-700 align-top dark:text-slate-300 dark:border-slate-800';
const confirmDeleteMessage = 'yakin ingin hapus ?';
const createPaginationState = (limit = 10) => ({
  page: 1,
  limit,
  total: 0,
  totalPages: 1
});

const SearchableMasterSelect = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Cari Clinical Pathway...',
  emptyText = 'Data Clinical Pathway tidak ditemukan.',
  allowEmpty = false,
  emptyOptionLabel = 'Semua Clinical Pathway',
  className,
  disabled = false
}: SearchableMasterSelectProps) => {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((item) => Number(item.id) === Number(value || 0)) || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between border-input bg-background px-3 text-sm font-normal', className)}
        >
          <span className="truncate">
            {selectedOption ? `${selectedOption.kode_cp} - ${selectedOption.nama_cp}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowEmpty ? (
                <CommandItem
                  value={emptyOptionLabel}
                  onSelect={() => {
                    onChange(0);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', Number(value || 0) === 0 ? 'opacity-100' : 'opacity-0')} />
                  {emptyOptionLabel}
                </CommandItem>
              ) : null}
              {options.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.kode_cp} ${item.nama_cp}`}
                  onSelect={() => {
                    onChange(Number(item.id));
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', Number(value || 0) === Number(item.id) ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{item.kode_cp} - {item.nama_cp}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const SearchableStringSelect = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Cari data...',
  emptyText = 'Data tidak ditemukan.',
  allowEmpty = false,
  emptyOptionLabel = 'Semua',
  className,
  disabled = false
}: SearchableStringSelectProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between border-input bg-background px-3 text-sm font-normal', className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowEmpty ? (
                <CommandItem
                  value={emptyOptionLabel}
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  {emptyOptionLabel}
                </CommandItem>
              ) : null}
              {options.map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  onSelect={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === item ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{item}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const SearchableCategorySelect = ({
  groups,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Cari kategori...',
  emptyText = 'Kategori tidak ditemukan.',
  className,
  disabled = false
}: SearchableCategorySelectProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between border-input bg-background px-3 text-sm font-normal', className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.options.map((item) => (
                  <CommandItem
                    key={item}
                    value={`${group.label} ${item}`}
                    onSelect={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === item ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{item}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const createEmptyMasterForm = (): MasterForm => ({
  id: null,
  kode_cp: '',
  nama_cp: '',
  deskripsi: '',
  target_los: 3,
  jenis_layanan: 'Ranap',
  aktif: 'Ya',
  target_tarif: 0,
  confidence_score: 0,
  evidence_note: ''
});

const createEmptyTemplateForm = (): TemplateForm => ({
  id: null,
  clinical_pathway_id: 0,
  clinical_pathway_day_id: null,
  hari_ke: 1,
  urutan: 0,
  kategori: '',
  kegiatan: '',
  tujuan_harian: '',
  uraian_kegiatan: '',
  aktivitas: '',
  keterangan: '',
  wajib: 'Ya'
});

const createEmptyMappingForm = (): MappingForm => ({
  id: null,
  clinical_pathway_id: 0,
  kd_penyakit: '',
  nm_penyakit: '',
  confidence_score: 0,
  prioritas: 1,
  tipe: 'Utama'
});

const formatPercent = (value: number) => `${Number(value || 0).toFixed(2)}%`;

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ClinicalPathwayMaster: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<TabKey>('dashboard');
  const [masterOptions, setMasterOptions] = React.useState<MasterOption[]>([]);

  const [dashboardLoading, setDashboardLoading] = React.useState(false);
  const [dashboardSummary, setDashboardSummary] = React.useState<MasterSummary>({
    master_count: 0,
    template_count: 0,
    mapping_count: 0,
    patient_count: 0,
    active_patient_count: 0,
    average_compliance_percentage: 0
  });
  const [dashboardPatients, setDashboardPatients] = React.useState<DashboardPatient[]>([]);

  const [masterListLoading, setMasterListLoading] = React.useState(false);
  const [masterList, setMasterList] = React.useState<MasterItem[]>([]);
  const [masterPage, setMasterPage] = React.useState(1);
  const [masterPagination, setMasterPagination] = React.useState(createPaginationState());
  const [masterForm, setMasterForm] = React.useState<MasterForm>(createEmptyMasterForm());
  const [masterSearch, setMasterSearch] = React.useState('');
  const [masterSaving, setMasterSaving] = React.useState(false);
  const [masterDeleting, setMasterDeleting] = React.useState(false);

  const [templateFilterMasterId, setTemplateFilterMasterId] = React.useState(0);
  const [templateListLoading, setTemplateListLoading] = React.useState(false);
  const [templateList, setTemplateList] = React.useState<TemplateItem[]>([]);
  const [templateSearch, setTemplateSearch] = React.useState('');
  const [templatePage, setTemplatePage] = React.useState(1);
  const [templatePagination, setTemplatePagination] = React.useState(createPaginationState());
  const [templateForm, setTemplateForm] = React.useState<TemplateForm>(createEmptyTemplateForm());
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [templateDeletingId, setTemplateDeletingId] = React.useState<number | null>(null);

  const [mappingFilterMasterId, setMappingFilterMasterId] = React.useState(0);
  const [mappingSearch, setMappingSearch] = React.useState('');
  const [mappingListLoading, setMappingListLoading] = React.useState(false);
  const [mappingList, setMappingList] = React.useState<MappingItem[]>([]);
  const [mappingPage, setMappingPage] = React.useState(1);
  const [mappingPagination, setMappingPagination] = React.useState(createPaginationState());
  const [mappingForm, setMappingForm] = React.useState<MappingForm>(createEmptyMappingForm());
  const [mappingSaving, setMappingSaving] = React.useState(false);
  const [mappingDeletingId, setMappingDeletingId] = React.useState<number | null>(null);
  const [mappingIcdSearch, setMappingIcdSearch] = React.useState('');
  const [mappingIcdResults, setMappingIcdResults] = React.useState<IcdSearchItem[]>([]);
  const [mappingIcdLoading, setMappingIcdLoading] = React.useState(false);

  const [generatorNoRawat, setGeneratorNoRawat] = React.useState('');
  const [generatorMasterId, setGeneratorMasterId] = React.useState(0);
  const [generatorLoading, setGeneratorLoading] = React.useState(false);
  const [generatorSaving, setGeneratorSaving] = React.useState(false);
  const [generatorPreview, setGeneratorPreview] = React.useState<GeneratorPreview | null>(null);
  const [generatorCandidateSearch, setGeneratorCandidateSearch] = React.useState('');
  const [generatorCandidateClinicalPathwayId, setGeneratorCandidateClinicalPathwayId] = React.useState(0);
  const [generatorCandidateBangsal, setGeneratorCandidateBangsal] = React.useState('');
  const [generatorCandidateKamar, setGeneratorCandidateKamar] = React.useState('');
  const [generatorCandidateDateStart, setGeneratorCandidateDateStart] = React.useState('');
  const [generatorCandidateDateEnd, setGeneratorCandidateDateEnd] = React.useState('');
  const [generatorCandidateLoading, setGeneratorCandidateLoading] = React.useState(false);
  const [generatorCandidates, setGeneratorCandidates] = React.useState<GeneratorCandidateItem[]>([]);
  const [generatorActionKey, setGeneratorActionKey] = React.useState('');
  const [generatorCandidatePage, setGeneratorCandidatePage] = React.useState(1);
  const [generatorCandidatePagination, setGeneratorCandidatePagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [generatorBangsalOptions, setGeneratorBangsalOptions] = React.useState<string[]>([]);
  const [generatorKamarOptions, setGeneratorKamarOptions] = React.useState<string[]>([]);
  const [generatorBatchSelections, setGeneratorBatchSelections] = React.useState<GeneratorBatchSelectionItem[]>([]);
  const [generatorBatchConfirmOpen, setGeneratorBatchConfirmOpen] = React.useState(false);
  const [generatorBatchOnlyNew, setGeneratorBatchOnlyNew] = React.useState(true);

  const [monitoringSearch, setMonitoringSearch] = React.useState('');
  const [monitoringStatus, setMonitoringStatus] = React.useState('');
  const [monitoringListLoading, setMonitoringListLoading] = React.useState(false);
  const [monitoringList, setMonitoringList] = React.useState<MonitoringListItem[]>([]);
  const [monitoringDetailLoading, setMonitoringDetailLoading] = React.useState(false);
  const [monitoringDetail, setMonitoringDetail] = React.useState<MonitoringDetail | null>(null);
  const [monitoringActionKey, setMonitoringActionKey] = React.useState('');
  const [printPreviewOpen, setPrintPreviewOpen] = React.useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = React.useState('');
  const printPreviewFrameRef = React.useRef<HTMLIFrameElement | null>(null);
  const currentUsername = String(user?.username || '').trim();
  const currentUserName = String(user?.name || user?.username || '').trim();

  const requestJson = React.useCallback(async <T,>(url: string, options?: RequestInit): Promise<T> => {
    const headers = new Headers(options?.headers || {});
    if (currentUsername) {
      headers.set('x-user-id', currentUsername);
      headers.set('x-username', currentUsername);
    }
    if (currentUserName) {
      headers.set('x-user-name', currentUserName);
    }

    const response = await fetch(url, {
      ...options,
      headers
    });
    const result = await response.json();
    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || 'Terjadi kesalahan saat memproses data');
    }
    return result as T;
  }, [currentUserName, currentUsername]);

  const fetchMasterOptions = React.useCallback(async () => {
    try {
      const result = await requestJson<ApiListResponse<MasterOption>>(`${API_URLS.CLINICAL_PATHWAY}/master?limit=100`);
      setMasterOptions(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error loading master options:', error);
    }
  }, [requestJson]);

  const fetchDashboard = React.useCallback(async () => {
    try {
      setDashboardLoading(true);
      const result = await requestJson<DashboardResponse>(`${API_URLS.CLINICAL_PATHWAY}/dashboard?limit=5`);
      setDashboardSummary(result.data?.summary || {
        master_count: 0,
        template_count: 0,
        mapping_count: 0,
        patient_count: 0,
        active_patient_count: 0,
        average_compliance_percentage: 0
      });
      setDashboardPatients(Array.isArray(result.data?.latest_patients) ? result.data!.latest_patients : []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat dashboard CP',
        variant: 'destructive'
      });
    } finally {
      setDashboardLoading(false);
    }
  }, [requestJson, toast]);

  const fetchMasterList = React.useCallback(async () => {
    try {
      setMasterListLoading(true);
      const query = new URLSearchParams({
        limit: String(masterPagination.limit),
        page: String(masterPage)
      });
      if (masterSearch.trim()) {
        query.set('search', masterSearch.trim());
      }
      const result = await requestJson<ApiListResponse<MasterItem>>(`${API_URLS.CLINICAL_PATHWAY}/master?${query.toString()}`);
      setMasterList(Array.isArray(result.data) ? result.data : []);
      setMasterPagination(result.pagination || {
        page: masterPage,
        limit: masterPagination.limit,
        total: Array.isArray(result.data) ? result.data.length : 0,
        totalPages: 1
      });
    } catch (error) {
      console.error('Error loading master list:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat daftar Master CP',
        variant: 'destructive'
      });
    } finally {
      setMasterListLoading(false);
    }
  }, [masterPage, masterPagination.limit, masterSearch, requestJson, toast]);

  const fetchTemplateList = React.useCallback(async () => {
    try {
      setTemplateListLoading(true);
      const query = new URLSearchParams({
        limit: String(templatePagination.limit),
        page: String(templatePage)
      });
      if (templateFilterMasterId) {
        query.set('clinical_pathway_id', String(templateFilterMasterId));
      }
      if (templateSearch.trim()) {
        query.set('search', templateSearch.trim());
      }
      const result = await requestJson<ApiListResponse<TemplateItem>>(`${API_URLS.CLINICAL_PATHWAY}/template-day?${query.toString()}`);
      setTemplateList(Array.isArray(result.data) ? result.data : []);
      setTemplatePagination(result.pagination || {
        page: templatePage,
        limit: templatePagination.limit,
        total: Array.isArray(result.data) ? result.data.length : 0,
        totalPages: 1
      });
    } catch (error) {
      console.error('Error loading template list:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat template harian',
        variant: 'destructive'
      });
    } finally {
      setTemplateListLoading(false);
    }
  }, [requestJson, templateFilterMasterId, templatePage, templatePagination.limit, templateSearch, toast]);

  const fetchMappingList = React.useCallback(async () => {
    try {
      setMappingListLoading(true);
      const query = new URLSearchParams({
        limit: String(mappingPagination.limit),
        page: String(mappingPage)
      });
      if (mappingFilterMasterId) {
        query.set('clinical_pathway_id', String(mappingFilterMasterId));
      }
      if (mappingSearch.trim()) {
        query.set('search', mappingSearch.trim());
      }
      const result = await requestJson<ApiListResponse<MappingItem>>(`${API_URLS.CLINICAL_PATHWAY}/mapping?${query.toString()}`);
      setMappingList(Array.isArray(result.data) ? result.data : []);
      setMappingPagination(result.pagination || {
        page: mappingPage,
        limit: mappingPagination.limit,
        total: Array.isArray(result.data) ? result.data.length : 0,
        totalPages: 1
      });
    } catch (error) {
      console.error('Error loading mapping list:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat mapping ICD',
        variant: 'destructive'
      });
    } finally {
      setMappingListLoading(false);
    }
  }, [mappingFilterMasterId, mappingPage, mappingPagination.limit, mappingSearch, requestJson, toast]);

  const fetchMonitoringList = React.useCallback(async () => {
    try {
      setMonitoringListLoading(true);
      const query = new URLSearchParams({ limit: '100' });
      if (monitoringSearch.trim()) {
        query.set('search', monitoringSearch.trim());
      }
      if (monitoringStatus.trim()) {
        query.set('status', monitoringStatus.trim());
      }
      const result = await requestJson<ApiListResponse<MonitoringListItem>>(`${API_URLS.CLINICAL_PATHWAY}/monitoring?${query.toString()}`);
      setMonitoringList(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error loading monitoring list:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat monitoring CP',
        variant: 'destructive'
      });
    } finally {
      setMonitoringListLoading(false);
    }
  }, [monitoringSearch, monitoringStatus, requestJson, toast]);

  const fetchGeneratorCandidates = React.useCallback(async () => {
    try {
      setGeneratorCandidateLoading(true);
      const query = new URLSearchParams({ limit: '20', page: String(generatorCandidatePage) });
      if (generatorCandidateSearch.trim()) {
        query.set('search', generatorCandidateSearch.trim());
      }
      if (generatorCandidateClinicalPathwayId) {
        query.set('clinical_pathway_id', String(generatorCandidateClinicalPathwayId));
      }
      if (generatorCandidateBangsal.trim()) {
        query.set('bangsal', generatorCandidateBangsal.trim());
      }
      if (generatorCandidateKamar.trim()) {
        query.set('kamar', generatorCandidateKamar.trim());
      }
      if (generatorCandidateDateStart) {
        query.set('tanggal_masuk_awal', generatorCandidateDateStart);
      }
      if (generatorCandidateDateEnd) {
        query.set('tanggal_masuk_akhir', generatorCandidateDateEnd);
      }
      const result = await requestJson<ApiListResponse<GeneratorCandidateItem>>(
        `${API_URLS.CLINICAL_PATHWAY}/generator/candidates?${query.toString()}`
      );
      setGeneratorCandidates(Array.isArray(result.data) ? result.data : []);
      setGeneratorCandidatePagination(result.pagination || {
        page: generatorCandidatePage,
        limit: 20,
        total: 0,
        totalPages: 1
      });
    } catch (error) {
      setGeneratorCandidates([]);
      setGeneratorCandidatePagination({
        page: generatorCandidatePage,
        limit: 20,
        total: 0,
        totalPages: 1
      });
      console.error('Error loading generator candidates:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat daftar pasien generator',
        variant: 'destructive'
      });
    } finally {
      setGeneratorCandidateLoading(false);
    }
  }, [
    generatorCandidateClinicalPathwayId,
    generatorCandidateBangsal,
    generatorCandidateDateEnd,
    generatorCandidateDateStart,
    generatorCandidateKamar,
    generatorCandidatePage,
    generatorCandidateSearch,
    requestJson,
    toast
  ]);

  const fetchGeneratorCandidateFilterOptions = React.useCallback(async () => {
    try {
      const result = await requestJson<ApiDetailResponse<GeneratorCandidateFilterOptions>>(
        `${API_URLS.CLINICAL_PATHWAY}/generator/filter-options`
      );
      setGeneratorBangsalOptions(Array.isArray(result.data?.bangsal_options) ? result.data!.bangsal_options : []);
      setGeneratorKamarOptions(Array.isArray(result.data?.kamar_options) ? result.data!.kamar_options : []);
    } catch (error) {
      console.error('Error loading generator filter options:', error);
    }
  }, [requestJson]);

  React.useEffect(() => {
    void fetchMasterOptions();
    void fetchDashboard();
    void fetchMasterList();
    void fetchTemplateList();
    void fetchMappingList();
    void fetchGeneratorCandidateFilterOptions();
    void fetchGeneratorCandidates();
    void fetchMonitoringList();
  }, [fetchDashboard, fetchGeneratorCandidateFilterOptions, fetchGeneratorCandidates, fetchMappingList, fetchMasterList, fetchMasterOptions, fetchMonitoringList, fetchTemplateList]);

  React.useEffect(() => {
    if (masterPage > masterPagination.totalPages) {
      setMasterPage(masterPagination.totalPages);
    }
  }, [masterPage, masterPagination.totalPages]);

  React.useEffect(() => {
    if (templatePage > templatePagination.totalPages) {
      setTemplatePage(templatePagination.totalPages);
    }
  }, [templatePage, templatePagination.totalPages]);

  React.useEffect(() => {
    if (mappingPage > mappingPagination.totalPages) {
      setMappingPage(mappingPagination.totalPages);
    }
  }, [mappingPage, mappingPagination.totalPages]);

  const generatorBatchSelectionSet = React.useMemo(
    () => new Set(generatorBatchSelections.map((item) => item.no_rawat)),
    [generatorBatchSelections]
  );
  const generatorSelectableCandidates = React.useMemo(
    () => generatorCandidates.filter((item) => !(generatorBatchOnlyNew && item.existing)),
    [generatorBatchOnlyNew, generatorCandidates]
  );
  const generatorSelectableCurrentPageCount = generatorSelectableCandidates.length;
  const generatorSelectedSelectableCurrentPageCount = React.useMemo(
    () => generatorSelectableCandidates.filter((item) => generatorBatchSelectionSet.has(item.no_rawat)).length,
    [generatorBatchSelectionSet, generatorSelectableCandidates]
  );
  const generatorAllCurrentPageSelected = generatorSelectableCurrentPageCount > 0
    && generatorSelectedSelectableCurrentPageCount === generatorSelectableCurrentPageCount;

  const toggleGeneratorBatchSelection = (item: GeneratorBatchSelectionItem, checked: boolean) => {
    setGeneratorBatchSelections((current) => {
      if (checked) {
        if (current.some((entry) => entry.no_rawat === item.no_rawat)) {
          return current;
        }
        return [...current, item];
      }
      return current.filter((entry) => entry.no_rawat !== item.no_rawat);
    });
  };

  const toggleGeneratorCurrentPageSelections = (checked: boolean) => {
    setGeneratorBatchSelections((current) => {
      const currentMap = new Map(current.map((item) => [item.no_rawat, item]));
      if (checked) {
        generatorSelectableCandidates.forEach((item) => {
          currentMap.set(item.no_rawat, {
            no_rawat: item.no_rawat,
            no_rkm_medis: item.no_rkm_medis,
            nm_pasien: item.nm_pasien,
            has_existing_cp: Boolean(item.existing)
          });
        });
        return Array.from(currentMap.values());
      }
      generatorSelectableCandidates.forEach((item) => {
        currentMap.delete(item.no_rawat);
      });
      return Array.from(currentMap.values());
    });
  };
  const generatorBatchSelectedExistingCount = React.useMemo(
    () => generatorBatchSelections.filter((item) => item.has_existing_cp).length,
    [generatorBatchSelections]
  );
  const generatorBatchReadyItems = React.useMemo(
    () => (generatorBatchOnlyNew
      ? generatorBatchSelections.filter((item) => !item.has_existing_cp)
      : generatorBatchSelections),
    [generatorBatchOnlyNew, generatorBatchSelections]
  );
  React.useEffect(() => {
    if (!generatorBatchOnlyNew) {
      return;
    }
    setGeneratorBatchSelections((current) => current.filter((item) => !item.has_existing_cp));
  }, [generatorBatchOnlyNew]);

  const searchIcd = async (
    keyword: string,
    setter: React.Dispatch<React.SetStateAction<IcdSearchItem[]>>,
    loadingSetter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!keyword.trim()) {
      setter([]);
      return;
    }

    try {
      loadingSetter(true);
      const response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          itemsPerPage: 8,
          search: keyword.trim(),
          icdType: 'icd10'
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || 'Gagal mencari ICD-10');
      }

      setter(
        Array.isArray(result?.data)
          ? result.data.map((item: Record<string, unknown>) => ({
              kd_penyakit: String(item.kd_penyakit || ''),
              nm_penyakit: String(item.nm_penyakit || '')
            }))
          : []
      );
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mencari ICD-10',
        variant: 'destructive'
      });
    } finally {
      loadingSetter(false);
    }
  };

  const loadMasterDetail = async (id: number) => {
    try {
      const result = await requestJson<ApiDetailResponse<MasterItem & { evidence_note?: string }>>(`${API_URLS.CLINICAL_PATHWAY}/master/${id}`);
      const detail = result.data;
      if (!detail) return;
      setMasterForm({
        id: detail.id,
        kode_cp: detail.kode_cp,
        nama_cp: detail.nama_cp,
        deskripsi: detail.guideline_note || '',
        target_los: Number(detail.target_los || 1),
        jenis_layanan: detail.jenis_layanan === 'Ralan' ? 'Ralan' : 'Ranap',
        aktif: detail.aktif === 'Tidak' ? 'Tidak' : 'Ya',
        target_tarif: Number(detail.target_tarif || 0),
        confidence_score: Number(detail.confidence_score || 0),
        evidence_note: String(detail.evidence_note || '')
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat detail Master CP',
        variant: 'destructive'
      });
    }
  };

  const saveMaster = async () => {
    try {
      setMasterSaving(true);
      const endpoint = masterForm.id
        ? `${API_URLS.CLINICAL_PATHWAY}/master/${masterForm.id}`
        : `${API_URLS.CLINICAL_PATHWAY}/master`;
      const method = masterForm.id ? 'PUT' : 'POST';
      await requestJson<ApiDetailResponse<MasterItem>>(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kode_cp: masterForm.kode_cp,
          nama_cp: masterForm.nama_cp,
          jenis_layanan: masterForm.jenis_layanan,
          target_los: Number(masterForm.target_los || 1),
          target_tarif: Number(masterForm.target_tarif || 0),
          confidence_score: Number(masterForm.confidence_score || 0),
          guideline_note: masterForm.deskripsi,
          evidence_note: masterForm.evidence_note,
          aktif: masterForm.aktif
        })
      });

      toast({ title: 'Berhasil', description: 'Master CP berhasil disimpan' });
      setMasterForm(createEmptyMasterForm());
      await Promise.all([fetchMasterList(), fetchMasterOptions(), fetchDashboard(), fetchMappingList()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan Master CP',
        variant: 'destructive'
      });
    } finally {
      setMasterSaving(false);
    }
  };

  const deleteMaster = async (id: number) => {
    try {
      setMasterDeleting(true);
      await requestJson<ApiDetailResponse<null>>(`${API_URLS.CLINICAL_PATHWAY}/master/${id}`, {
        method: 'DELETE'
      });
      toast({ title: 'Berhasil', description: 'Master CP berhasil dihapus' });
      if (masterForm.id === id) {
        setMasterForm(createEmptyMasterForm());
      }
      await Promise.all([fetchMasterList(), fetchMasterOptions(), fetchDashboard(), fetchTemplateList(), fetchMappingList()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menghapus Master CP',
        variant: 'destructive'
      });
    } finally {
      setMasterDeleting(false);
    }
  };

  const loadTemplateDetail = async (id: number) => {
    try {
      const result = await requestJson<ApiDetailResponse<TemplateItem>>(`${API_URLS.CLINICAL_PATHWAY}/template-day/${id}`);
      const detail = result.data;
      if (!detail) return;
      setTemplateForm({
        id: detail.id,
        clinical_pathway_id: Number(detail.clinical_pathway_id || 0),
        clinical_pathway_day_id: Number(detail.clinical_pathway_day_id || 0),
        hari_ke: Number(detail.hari_ke || 1),
        urutan: Number(detail.urutan || 0),
        kategori: detail.kategori || '',
        kegiatan: detail.kegiatan || '',
        tujuan_harian: detail.tujuan_harian || '',
        uraian_kegiatan: detail.uraian_kegiatan || '',
        aktivitas: detail.aktivitas || '',
        keterangan: detail.keterangan || '',
        wajib: detail.wajib === 'Tidak' ? 'Tidak' : 'Ya'
      });
      setTemplateFilterMasterId(Number(detail.clinical_pathway_id || 0));
      setActiveTab('template');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat template harian',
        variant: 'destructive'
      });
    }
  };

  const copyTemplateToForm = (item: TemplateItem) => {
    setTemplateForm({
      id: null,
      clinical_pathway_id: Number(item.clinical_pathway_id || 0),
      clinical_pathway_day_id: null,
      hari_ke: Number(item.hari_ke || 1),
      urutan: Number(item.urutan || 0),
      kategori: item.kategori || '',
      kegiatan: item.kegiatan || '',
      tujuan_harian: item.tujuan_harian || '',
      uraian_kegiatan: item.uraian_kegiatan || '',
      aktivitas: item.aktivitas || '',
      keterangan: item.keterangan || '',
      wajib: item.wajib === 'Tidak' ? 'Tidak' : 'Ya'
    });
    setTemplateFilterMasterId(Number(item.clinical_pathway_id || 0));
    setActiveTab('template');
    toast({
      title: 'Berhasil',
      description: 'Template harian berhasil disalin ke form'
    });
  };

  const saveTemplate = async () => {
    try {
      setTemplateSaving(true);
      const endpoint = templateForm.id
        ? `${API_URLS.CLINICAL_PATHWAY}/template-day/${templateForm.id}`
        : `${API_URLS.CLINICAL_PATHWAY}/template-day`;
      const method = templateForm.id ? 'PUT' : 'POST';
      await requestJson<ApiDetailResponse<TemplateItem>>(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_pathway_id: Number(templateForm.clinical_pathway_id || 0),
          clinical_pathway_day_id: templateForm.clinical_pathway_day_id,
          hari_ke: Number(templateForm.hari_ke || 1),
          urutan: Number(templateForm.urutan || 0),
          kategori: templateForm.kategori,
          kegiatan: templateForm.kegiatan,
          tujuan_harian: templateForm.tujuan_harian,
          uraian_kegiatan: templateForm.uraian_kegiatan,
          aktivitas: templateForm.aktivitas,
          keterangan: templateForm.keterangan,
          wajib: templateForm.wajib
        })
      });
      toast({ title: 'Berhasil', description: 'Template harian berhasil disimpan' });
      setTemplateForm(createEmptyTemplateForm());
      await Promise.all([fetchTemplateList(), fetchDashboard(), fetchMasterList()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan template harian',
        variant: 'destructive'
      });
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      setTemplateDeletingId(id);
      await requestJson<ApiDetailResponse<null>>(`${API_URLS.CLINICAL_PATHWAY}/template-day/${id}`, {
        method: 'DELETE'
      });
      toast({ title: 'Berhasil', description: 'Template harian berhasil dihapus' });
      if (templateForm.id === id) {
        setTemplateForm(createEmptyTemplateForm());
      }
      await Promise.all([fetchTemplateList(), fetchDashboard(), fetchMasterList()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menghapus template harian',
        variant: 'destructive'
      });
    } finally {
      setTemplateDeletingId(null);
    }
  };

  const selectedMappingMaster = React.useMemo(
    () => masterOptions.find((item) => Number(item.id) === Number(mappingForm.clinical_pathway_id || mappingFilterMasterId || 0)) || null,
    [mappingFilterMasterId, mappingForm.clinical_pathway_id, masterOptions]
  );

  const loadMappingDetail = async (id: number) => {
    try {
      const result = await requestJson<ApiDetailResponse<MappingItem>>(`${API_URLS.CLINICAL_PATHWAY}/mapping/${id}`);
      const detail = result.data;
      if (!detail) return;
      setMappingForm({
        id: detail.id,
        clinical_pathway_id: Number(detail.clinical_pathway_id || 0),
        kd_penyakit: detail.kd_penyakit,
        nm_penyakit: detail.nm_penyakit,
        confidence_score: Number(detail.confidence_score || 0),
        prioritas: Number(detail.prioritas || 1),
        tipe: detail.tipe === 'Sekunder' ? 'Sekunder' : 'Utama'
      });
      setMappingFilterMasterId(Number(detail.clinical_pathway_id || 0));
      setActiveTab('mapping');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat mapping ICD',
        variant: 'destructive'
      });
    }
  };

  const saveMapping = async () => {
    try {
      setMappingSaving(true);
      const endpoint = mappingForm.id
        ? `${API_URLS.CLINICAL_PATHWAY}/mapping/${mappingForm.id}`
        : `${API_URLS.CLINICAL_PATHWAY}/mapping`;
      const method = mappingForm.id ? 'PUT' : 'POST';
      await requestJson<ApiDetailResponse<MappingItem>>(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_pathway_id: Number(mappingForm.clinical_pathway_id || 0),
          kd_penyakit: mappingForm.kd_penyakit,
          prioritas: Number(mappingForm.prioritas || 1),
          confidence_score: Number(mappingForm.confidence_score || 0),
          tipe: mappingForm.tipe
        })
      });
      toast({ title: 'Berhasil', description: 'Mapping ICD berhasil disimpan' });
      setMappingForm(createEmptyMappingForm());
      await Promise.all([fetchMappingList(), fetchMasterOptions(), fetchMasterList(), fetchDashboard()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan mapping ICD',
        variant: 'destructive'
      });
    } finally {
      setMappingSaving(false);
    }
  };

  const deleteMapping = async (id: number) => {
    try {
      setMappingDeletingId(id);
      await requestJson<ApiDetailResponse<null>>(`${API_URLS.CLINICAL_PATHWAY}/mapping/${id}`, {
        method: 'DELETE'
      });
      toast({ title: 'Berhasil', description: 'Mapping ICD berhasil dihapus' });
      if (mappingForm.id === id) {
        setMappingForm(createEmptyMappingForm());
      }
      await Promise.all([fetchMappingList(), fetchDashboard(), fetchMasterList()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menghapus mapping ICD',
        variant: 'destructive'
      });
    } finally {
      setMappingDeletingId(null);
    }
  };

  const previewGenerator = async (rawNoRawat?: string, preferredMasterId?: number) => {
    const targetNoRawat = String(rawNoRawat || generatorNoRawat || '').trim();
    if (!targetNoRawat) {
      toast({
        title: 'No. Rawat wajib diisi',
        description: 'Masukkan nomor rawat pasien untuk preview generator.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const actionKey = targetNoRawat ? `preview:${targetNoRawat}` : 'preview';
      setGeneratorActionKey(actionKey);
      setGeneratorLoading(true);
      const selectedMasterId = Number(preferredMasterId || generatorMasterId || 0);
      const query = selectedMasterId ? `?clinical_pathway_id=${selectedMasterId}` : '';
      const result = await requestJson<ApiDetailResponse<GeneratorPreview>>(
        `${API_URLS.CLINICAL_PATHWAY}/generator/preview/by-no-rawat/${encodeURIComponent(targetNoRawat)}${query}`
      );
      setGeneratorPreview(result.data || null);
      setGeneratorNoRawat(String(result.data?.registration?.no_rawat || targetNoRawat));
      setGeneratorMasterId(Number(result.data?.selected_clinical_pathway_id || selectedMasterId || 0));
    } catch (error) {
      setGeneratorPreview(null);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat preview generator pasien',
        variant: 'destructive'
      });
    } finally {
      setGeneratorLoading(false);
      setGeneratorActionKey('');
    }
  };

  const submitGeneratePatient = async (payload: {
    no_rkm_medis: string;
    no_rawat: string;
    clinical_pathway_id?: number;
  }) => {
    await requestJson<ApiDetailResponse<unknown>>(`${API_URLS.CLINICAL_PATHWAY}/generate-patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        no_rkm_medis: payload.no_rkm_medis,
        no_rawat: payload.no_rawat,
        clinical_pathway_id: Number(payload.clinical_pathway_id || 0) || undefined
      })
    });
  };

  const generatePatient = async (payload?: {
    no_rkm_medis?: string;
    no_rawat?: string;
    clinical_pathway_id?: number;
  }) => {
    const targetNoRkmMedis = String(payload?.no_rkm_medis || generatorPreview?.registration?.no_rkm_medis || '').trim();
    const targetNoRawat = String(payload?.no_rawat || generatorPreview?.registration?.no_rawat || '').trim();
    const targetClinicalPathwayId = Number(payload?.clinical_pathway_id || generatorMasterId || 0);

    if (!targetNoRkmMedis || !targetNoRawat) {
      toast({
        title: 'Preview belum tersedia',
        description: 'Lakukan preview pasien terlebih dahulu sebelum generate.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const actionKey = targetNoRawat ? `generate:${targetNoRawat}` : 'generate';
      setGeneratorActionKey(actionKey);
      setGeneratorSaving(true);
      await submitGeneratePatient({
        no_rkm_medis: targetNoRkmMedis,
        no_rawat: targetNoRawat,
        clinical_pathway_id: targetClinicalPathwayId || undefined
      });
      toast({ title: 'Berhasil', description: 'Generator pasien Clinical Pathway berhasil dijalankan' });
      setGeneratorNoRawat(targetNoRawat);
      await Promise.all([
        previewGenerator(targetNoRawat, targetClinicalPathwayId || undefined),
        fetchDashboard(),
        fetchMonitoringList(),
        fetchGeneratorCandidates()
      ]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal generate Clinical Pathway pasien',
        variant: 'destructive'
      });
    } finally {
      setGeneratorSaving(false);
      setGeneratorActionKey('');
    }
  };

  const openGenerateBatchConfirm = () => {
    if (!generatorBatchSelections.length) {
      toast({
        title: 'Pilih pasien terlebih dahulu',
        description: 'Centang minimal satu pasien untuk generate batch.',
        variant: 'destructive'
      });
      return;
    }

    if (!generatorBatchReadyItems.length) {
      toast({
        title: 'Tidak ada pasien yang diproses',
        description: 'Semua pasien terpilih sudah memiliki Clinical Pathway aktif/nonaktif sebelumnya.',
        variant: 'destructive'
      });
      return;
    }

    setGeneratorBatchConfirmOpen(true);
  };

  const generatePatientBatch = async () => {
    if (!generatorBatchReadyItems.length) {
      setGeneratorBatchConfirmOpen(false);
      return;
    }

    try {
      const batchItems = [...generatorBatchReadyItems];
      setGeneratorActionKey('generate:batch');
      setGeneratorSaving(true);
      setGeneratorBatchConfirmOpen(false);

      let successCount = 0;
      const failedPatients: string[] = [];

      for (const item of batchItems) {
        try {
          await submitGeneratePatient({
            no_rkm_medis: item.no_rkm_medis,
            no_rawat: item.no_rawat
          });
          successCount += 1;
        } catch (error) {
          failedPatients.push(`${item.no_rawat}${error instanceof Error ? ` (${error.message})` : ''}`);
        }
      }

      setGeneratorBatchSelections([]);

      await Promise.all([
        fetchDashboard(),
        fetchMonitoringList(),
        fetchGeneratorCandidates()
      ]);

      if (failedPatients.length) {
        toast({
          title: 'Generate batch selesai sebagian',
          description: `${successCount} berhasil, ${failedPatients.length} gagal. Contoh: ${failedPatients.slice(0, 2).join(', ')}`,
          variant: failedPatients.length === batchItems.length ? 'destructive' : 'default'
        });
      } else {
        toast({
          title: 'Berhasil',
          description: `${successCount} pasien berhasil digenerate secara batch`
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menjalankan generate batch Clinical Pathway',
        variant: 'destructive'
      });
    } finally {
      setGeneratorSaving(false);
      setGeneratorActionKey('');
    }
  };

  const loadMonitoringDetail = async (patientId: number) => {
    try {
      setMonitoringDetailLoading(true);
      const result = await requestJson<ApiDetailResponse<MonitoringDetail>>(`${API_URLS.CLINICAL_PATHWAY}/monitoring/${patientId}`);
      setMonitoringDetail(result.data || null);
      setActiveTab('monitoring');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat detail monitoring',
        variant: 'destructive'
      });
    } finally {
      setMonitoringDetailLoading(false);
    }
  };

  const refreshMonitoring = async () => {
    if (!monitoringDetail?.patient?.id) return;
    try {
      setMonitoringActionKey('refresh');
      const result = await requestJson<ApiDetailResponse<MonitoringDetail>>(
        `${API_URLS.CLINICAL_PATHWAY}/monitoring/${monitoringDetail.patient.id}/refresh`,
        { method: 'POST' }
      );
      setMonitoringDetail(result.data || null);
      await Promise.all([fetchMonitoringList(), fetchDashboard()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal refresh monitoring',
        variant: 'destructive'
      });
    } finally {
      setMonitoringActionKey('');
    }
  };

  const updateExecutionStatus = async (executionId: number, status: string) => {
    if (!monitoringDetail?.patient?.id) return;
    const actionKey = `execution-${executionId}-${status}`;
    try {
      setMonitoringActionKey(actionKey);
      const result = await requestJson<ApiDetailResponse<MonitoringDetail>>(
        `${API_URLS.CLINICAL_PATHWAY}/monitoring/${monitoringDetail.patient.id}/execution/${executionId}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      );
      setMonitoringDetail(result.data || null);
      await Promise.all([fetchMonitoringList(), fetchDashboard()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mengubah status aktivitas',
        variant: 'destructive'
      });
    } finally {
      setMonitoringActionKey('');
    }
  };

  const updatePatientStatus = async (status: string) => {
    if (!monitoringDetail?.patient?.id) return;
    const actionKey = `patient-${status}`;
    try {
      setMonitoringActionKey(actionKey);
      const result = await requestJson<ApiDetailResponse<MonitoringDetail>>(
        `${API_URLS.CLINICAL_PATHWAY}/monitoring/${monitoringDetail.patient.id}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      );
      setMonitoringDetail(result.data || null);
      await Promise.all([fetchMonitoringList(), fetchDashboard()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mengubah status pasien',
        variant: 'destructive'
      });
    } finally {
      setMonitoringActionKey('');
    }
  };

  const openMonitoringPrintPreview = () => {
    if (!monitoringDetail) {
      toast({
        title: 'Data belum tersedia',
        description: 'Pilih detail monitoring pasien terlebih dahulu.',
        variant: 'destructive'
      });
      return;
    }

    const patient = monitoringDetail.patient;
    const maxExecutionDay = monitoringDetail.execution.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item.hari_ke || 0)),
      0
    );
    const maxVarianceDay = monitoringDetail.variance.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item.hari_ke || 0)),
      0
    );
    const totalDays = Math.max(1, Number(patient.target_los || 0), maxExecutionDay, maxVarianceDay);
    const dayHeaders = Array.from({ length: totalDays }, (_, index) => index + 1);

    const calculateAge = (dateValue?: string) => {
      if (!dateValue) return '-';
      const birthDate = new Date(dateValue);
      if (Number.isNaN(birthDate.getTime())) return '-';
      const now = new Date();
      let years = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        years -= 1;
      }
      return years >= 0 ? `${years} th` : '-';
    };

    const groupedExecution = monitoringDetail.execution.reduce<Array<{
      kategori: string;
      uraian: string;
      aktivitas: string;
      note: string;
      days: Map<number, string>;
    }>>((accumulator, item) => {
      const kategori = String(item.kategori || '').trim() || '-';
      const uraian = String(item.uraian_kegiatan || item.kegiatan || '').trim() || '-';
      const aktivitas = String(item.aktivitas || '').trim() || '-';
      const key = `${kategori}||${uraian}||${aktivitas}`;
      const currentDay = Math.max(1, Number(item.hari_ke || 1));
      const normalizedStatus = String(item.status || '').trim().toLowerCase();
      const notes = [item.keterangan, item.catatan]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      const existing = accumulator.find((entry) => `${entry.kategori}||${entry.uraian}||${entry.aktivitas}` === key);

      if (existing) {
        existing.days.set(currentDay, normalizedStatus);
        if (notes.length) {
          existing.note = [existing.note, ...notes]
            .join(' | ')
            .split('|')
            .map((value) => value.trim())
            .filter(Boolean)
            .filter((value, index, array) => array.indexOf(value) === index)
            .join(' | ');
        }
        return accumulator;
      }

      accumulator.push({
        kategori,
        uraian,
        aktivitas,
        note: notes
          .filter((value, index, array) => array.indexOf(value) === index)
          .join(' | '),
        days: new Map([[currentDay, normalizedStatus]])
      });
      return accumulator;
    }, []);

    const groupedByCategory = groupedExecution.reduce<Array<{
      kategori: string;
      items: typeof groupedExecution;
    }>>((accumulator, item) => {
      const existing = accumulator.find((entry) => entry.kategori === item.kategori);
      if (existing) {
        existing.items.push(item);
      } else {
        accumulator.push({
          kategori: item.kategori,
          items: [item]
        });
      }
      return accumulator;
    }, []);

    const executionRowsHtml = groupedByCategory.map((group) => group.items.map((item, index) => {
      const dayCells = dayHeaders.map((day) => {
        const status = item.days.get(day);
        if (!status) {
          return '<td class="day-cell day-empty"></td>';
        }

        if (status === 'missed') {
          return '<td class="day-cell day-missed">X</td>';
        }

        return '<td class="day-cell day-filled"></td>';
      }).join('');

      return `
        <tr>
          ${index === 0 ? `<td class="category-cell" rowspan="${group.items.length}">${escapeHtml(group.kategori)}</td>` : ''}
          <td class="aktivitas-cell">${escapeHtml(item.aktivitas)}</td>
          ${dayCells}
          <td class="note-cell">${escapeHtml(item.note || '-')}</td>
        </tr>
      `;
    }).join('')).join('');

    const varianceHtml = monitoringDetail.variance.length
      ? `
        <div class="variance-section">
          <div class="section-title">Variasi Monitoring</div>
          <table class="variance-table">
            <thead>
              <tr>
                <th>Hari</th>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${monitoringDetail.variance.map((item) => `
                <tr>
                  <td>${escapeHtml(item.hari_ke || '-')}</td>
                  <td>${escapeHtml(item.kategori_variance)}</td>
                  <td>${escapeHtml(item.deskripsi)}</td>
                  <td>${escapeHtml(item.severity)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

    const html = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Print Preview Clinical Pathway</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              background: #dcdcdc;
              color: #111827;
            }
            .page {
              width: 190mm;
              max-width: calc(100% - 24px);
              margin: 12px auto 24px;
              background: #ffffff;
              border: 1px solid #5b5b5b;
              box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
              padding: 8mm;
              box-sizing: border-box;
            }
            .document-code {
              text-align: right;
              font-size: 8px;
              margin-bottom: 2mm;
            }
            .header-table,
            .identity-table,
            .main-table,
            .variance-table {
              width: 100%;
              border-collapse: collapse;
            }
            .header-table td,
            .identity-table td,
            .header-table th,
            .identity-table th,
            .main-table td,
            .main-table th,
            .variance-table td,
            .variance-table th {
              border: 1px solid #444444;
              padding: 2px 4px;
              font-size: 9px;
              vertical-align: top;
            }
            .header-center {
              text-align: center;
              font-weight: bold;
              background: #55e93d;
            }
            .header-logo {
              width: 56px;
              text-align: center;
              vertical-align: middle;
            }
            .header-logo img {
              width: 42px;
              height: 42px;
              object-fit: contain;
            }
            .header-title {
              font-size: 18px;
              line-height: 1.1;
            }
            .header-subtitle {
              font-size: 12px;
              line-height: 1.2;
            }
            .header-meta {
              font-size: 8px;
              width: 110px;
            }
            .identity-table {
              margin-top: 3mm;
            }
            .identity-table td {
              font-size: 8.8px;
              padding: 2px 4px;
            }
            .identity-label {
              width: 18%;
              white-space: nowrap;
            }
            .identity-value {
              border-bottom: 1px solid #444444;
              min-height: 14px;
            }
            .main-table {
              margin-top: 3mm;
            }
            .main-table th,
            .variance-table th {
              background: #f2f2f2;
              text-align: center;
            }
            .day-cell {
              width: 18px;
              min-width: 18px;
              height: 18px;
              text-align: center;
              font-weight: bold;
              padding: 0;
            }
            .day-empty {
              background: #cfcfcf;
            }
            .day-filled {
              background: #ffef45;
            }
            .day-missed {
              background: #fee2e2;
              color: #991b1b;
            }
            .category-cell {
              width: 95px;
              font-weight: bold;
            }
            .aktivitas-cell {
              width: 220px;
            }
            .note-cell {
              width: 110px;
            }
            .signature-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 18mm;
              margin-top: 10mm;
              text-align: center;
              font-size: 9px;
            }
            .signature-name {
              margin-top: 18mm;
              font-weight: bold;
            }
            .section-title {
              margin: 5mm 0 2mm;
              font-weight: bold;
              font-size: 10px;
            }
            .verification-box {
              margin-top: 8mm;
              text-align: center;
              font-size: 9px;
            }
            .verification-name {
              margin-top: 14mm;
            }
            .legend {
              margin-top: 10mm;
              font-size: 8.5px;
            }
            .legend-swatch {
              display: inline-block;
              width: 18px;
              height: 10px;
              border: 1px solid #444444;
              vertical-align: middle;
              margin-right: 4px;
            }
            .legend-filled {
              background: #ffef45;
            }
            .legend-empty {
              background: #cfcfcf;
            }
            @media print {
              body {
                background: #ffffff;
              }
              .page {
                width: 100%;
                max-width: none;
                margin: 0;
                border: 0;
                box-shadow: none;
                padding: 0;
              }
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="document-code">${escapeHtml(patient.kode_cp || 'CP')}</div>
            <table class="header-table">
              <tr>
                <td class="header-logo">
                  <img src="${escapeHtml(logoImg)}" alt="Logo RSUD" />
                </td>
                <td class="header-center">
                  <div class="header-title">CLINICAL PATHWAYS</div>
                  <div class="header-subtitle">${escapeHtml(patient.nama_cp || '-')}</div>
                  <div>RSUD H. Damanhuri Barabai</div>
                </td>
                <td class="header-meta">
                  <div>No. RM: ${escapeHtml(patient.no_rkm_medis || '-')}</div>
                  <div>No. Rawat: ${escapeHtml(patient.no_rawat || '-')}</div>
                  <div>Tgl Cetak: ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
                </td>
              </tr>
            </table>

            <table class="identity-table" style="margin-top: 8px;">
              <tr>
                <td class="identity-label">No. RM</td>
                <td class="identity-value">${escapeHtml(patient.no_rkm_medis || '-')}</td>
                <td class="identity-label">No. Rawat</td>
                <td class="identity-value">${escapeHtml(patient.no_rawat || '-')}</td>
              </tr>
              <tr>
                <td class="identity-label">Nama Pasien</td>
                <td class="identity-value">${escapeHtml(patient.nm_pasien || '-')}</td>
                <td class="identity-label">Jenis Kelamin</td>
                <td class="identity-value">${escapeHtml(patient.jk || '-')}</td>
              </tr>
              <tr>
                <td class="identity-label">Umur / Tgl Lahir</td>
                <td class="identity-value">${escapeHtml(`${calculateAge(patient.tgl_lahir)} / ${formatDate(patient.tgl_lahir)}`)}</td>
                <td class="identity-label">Tanggal Masuk RS</td>
                <td class="identity-value">${escapeHtml(formatDateTime(patient.tgl_masuk || (patient.tgl_registrasi ? `${patient.tgl_registrasi} ${patient.jam_reg || '00:00:00'}` : '')))}</td>
              </tr>
              <tr>
                <td class="identity-label">Tanggal Keluar RS</td>
                <td class="identity-value">${escapeHtml(formatDateTime(patient.tgl_keluar || patient.tanggal_selesai || ''))}</td>
                <td class="identity-label">Status Layanan</td>
                <td class="identity-value">${escapeHtml(patient.status_layanan || '-')}</td>
              </tr>
              <tr>
                <td class="identity-label">Penyakit Utama</td>
                <td class="identity-value">${escapeHtml(patient.nm_penyakit || patient.kd_penyakit || '-')}</td>
                <td class="identity-label">Kode ICD</td>
                <td class="identity-value">${escapeHtml(patient.kd_penyakit || '-')}</td>
              </tr>
              <tr>
                <td class="identity-label">Penyakit Penyerta / Komplikasi / Tindakan</td>
                <td class="identity-value"></td>
                <td class="identity-label">Lama / Rencana Rawat</td>
                <td class="identity-value">${escapeHtml(`${patient.target_los || 0} hari`)}</td>
              </tr>
            </table>

            <table class="main-table" style="margin-top: 10px;">
              <thead>
                <tr>
                  <th rowspan="2">Kegiatan</th>
                  <th rowspan="2">Intervensi / Aktivitas</th>
                  <th colspan="${dayHeaders.length}">Hari Ke</th>
                  <th rowspan="2">Keterangan</th>
                </tr>
                <tr>
                  ${dayHeaders.map((day) => `<th>${day}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${executionRowsHtml || `<tr><td colspan="${3 + dayHeaders.length}">Belum ada aktivitas monitoring.</td></tr>`}
              </tbody>
            </table>

            ${varianceHtml}

            <div class="signature-grid">
              <div>
                <div>Dokter Penanggung Jawab Pelayanan</div>
                <div class="signature-name">....................................</div>
              </div>
              <div>
                <div>Perawat Penanggung Jawab</div>
                <div class="signature-name">....................................</div>
              </div>
            </div>

            <div class="verification-box">
              <div>Pelaksana Verifikasi</div>
              <div class="verification-name">....................................</div>
            </div>

            <div class="legend">
              <div>Keterangan:</div>
              <div><span class="legend-swatch legend-filled"></span>yang harus diisikan</div>
              <div><span class="legend-swatch legend-empty"></span>bisa ada, bisa tidak</div>
              <div><strong>X</strong> tidak dilakukan</div>
            </div>
          </div>
        </body>
      </html>
    `;

    setPrintPreviewHtml(html);
    setPrintPreviewOpen(true);
  };

  const handlePrintPreview = () => {
    const frameWindow = printPreviewFrameRef.current?.contentWindow;
    if (!frameWindow) {
      toast({
        title: 'Preview belum siap',
        description: 'Tunggu sebentar lalu coba print lagi.',
        variant: 'destructive'
      });
      return;
    }

    frameWindow.focus();
    frameWindow.print();
  };

  const summaryCards = [
    { label: 'Clinical Pathway', value: dashboardSummary.master_count },
    { label: 'Template Harian', value: dashboardSummary.template_count },
    { label: 'Mapping ICD', value: dashboardSummary.mapping_count },
    { label: 'Pasien CP', value: dashboardSummary.patient_count }
  ];

  const tabItems: Array<{ key: TabKey; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'master', label: 'Clinical Pathway' },
    { key: 'template', label: 'Template Harian' },
    { key: 'mapping', label: 'Mapping ICD' },
    { key: 'generator', label: 'Generator Pasien' },
    { key: 'monitoring', label: 'Monitoring' }
  ];

  const renderListPagination = (
    pagination: { page: number; total: number; totalPages: number },
    loading: boolean,
    onPageChange: (page: number) => void
  ) => (
    <div className="flex flex-col gap-2 border-t px-3 py-3 text-xs text-muted-foreground dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div>
        Total {pagination.total} data | Halaman {pagination.page} / {pagination.totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={loading || pagination.page <= 1}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
          disabled={loading || pagination.page >= pagination.totalPages}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full animate-fade-in space-y-6 rounded-md bg-white p-2 shadow-md transition-colors dark:bg-slate-950 dark:shadow-slate-950/40 md:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Clinical Pathway</h1>
            <p className="text-sm text-muted-foreground">
              Kelola dashboard, template, mapping ICD, generator pasien, dan monitoring dalam satu halaman.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 rounded-md bg-muted/40 p-2">
          {tabItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={activeTab === item.key ? activeTopButtonClass : topButtonClass}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-4">
              {summaryCards.map((item) => (
                <div key={item.label} className={`${panelClass} min-h-[88px] px-4 py-5`}>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-4xl font-bold text-primary">
                    {dashboardLoading ? '-' : item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className={panelClass}>
                <div className={panelHeaderClass}>Ringkasan</div>
                <div className="p-4">
                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="font-semibold text-primary">CP Aktif</div>
                      <div className="mt-1 text-base font-bold">{dashboardSummary.active_patient_count}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="font-semibold text-primary">Rata-rata</div>
                      <div className="mt-1 text-base font-bold">{formatPercent(dashboardSummary.average_compliance_percentage)}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Ringkasan ini menyesuaikan struktur kerja versi PHP: master, template, mapping, pasien aktif, dan kepatuhan.
                  </p>
                </div>
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>Pasien Terakhir</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className={tableHeadClass}>No. Rawat</th>
                        <th className={tableHeadClass}>Pasien</th>
                        <th className={tableHeadClass}>CP</th>
                        <th className={tableHeadClass}>Kepatuhan</th>
                        <th className={tableHeadClass}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardPatients.map((row) => (
                        <tr key={row.id}>
                          <td className={tableCellClass}>{row.no_rawat}</td>
                          <td className={tableCellClass}>{row.nm_pasien || '-'}</td>
                          <td className={tableCellClass}>{row.nama_cp}</td>
                          <td className={tableCellClass}>{formatPercent(row.compliance_percentage)}</td>
                          <td className={tableCellClass}>
                            <span className="rounded bg-primary/85 px-2 py-1 text-[11px] font-semibold text-primary-foreground">
                              {row.status_cp}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!dashboardPatients.length ? (
                        <tr>
                          <td className={tableCellClass} colSpan={5}>Belum ada data pasien CP.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'master' ? (
          <div className="grid gap-4 xl:grid-cols-[324px_minmax(0,1fr)]">
            <div className={panelClass}>
              <div className={`${panelHeaderClass} border-primary/10 bg-primary/10 text-primary dark:text-primary`}>Tambah Clinical Pathway</div>
              <div className="space-y-4 p-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Kode CP</label>
                  <input className={inputClass} value={masterForm.kode_cp} onChange={(e) => setMasterForm((prev) => ({ ...prev, kode_cp: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Nama CP</label>
                  <input className={inputClass} value={masterForm.nama_cp} onChange={(e) => setMasterForm((prev) => ({ ...prev, nama_cp: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Deskripsi</label>
                  <textarea className={textareaClass} value={masterForm.deskripsi} onChange={(e) => setMasterForm((prev) => ({ ...prev, deskripsi: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Target LOS</label>
                  <input className={inputClass} type="number" min={1} value={masterForm.target_los} onChange={(e) => setMasterForm((prev) => ({ ...prev, target_los: Math.max(1, Number(e.target.value || 1)) }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Status Layanan</label>
                  <select className={inputClass} value={masterForm.jenis_layanan} onChange={(e) => setMasterForm((prev) => ({ ...prev, jenis_layanan: e.target.value === 'Ralan' ? 'Ralan' : 'Ranap' }))}>
                    <option value="Ranap">Ranap</option>
                    <option value="Ralan">Ralan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Aktif</label>
                  <select className={inputClass} value={masterForm.aktif} onChange={(e) => setMasterForm((prev) => ({ ...prev, aktif: e.target.value === 'Tidak' ? 'Tidak' : 'Ya' }))}>
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void saveMaster()} disabled={masterSaving}>
                    {masterSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMasterForm(createEmptyMasterForm())}>Reset</Button>
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className={panelHeaderClass}>Daftar Clinical Pathway</div>
              <div className="flex items-center justify-between gap-3 border-b p-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Input
                    value={masterSearch}
                    onChange={(e) => {
                      setMasterSearch(e.target.value);
                      setMasterPage(1);
                    }}
                    placeholder="Cari kode / nama CP"
                  />
                  <Button size="sm" variant="outline" onClick={() => void fetchMasterList()}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => void fetchMasterList()} disabled={masterListLoading}>
                  {masterListLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>Kode</th>
                      <th className={tableHeadClass}>Nama</th>
                      <th className={tableHeadClass}>Layanan</th>
                      <th className={tableHeadClass}>LOS</th>
                      <th className={tableHeadClass}>Template</th>
                      <th className={tableHeadClass}>Mapping</th>
                      <th className={tableHeadClass}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterList.map((item) => (
                      <tr key={item.id}>
                        <td className={tableCellClass}>{item.kode_cp}</td>
                        <td className={tableCellClass}>
                          <div>{item.nama_cp}</div>
                          <div className="text-[11px] text-muted-foreground">{item.guideline_note || '-'}</div>
                        </td>
                        <td className={tableCellClass}>{item.jenis_layanan}</td>
                        <td className={tableCellClass}>{item.target_los} hari</td>
                        <td className={tableCellClass}>{item.activity_count}</td>
                        <td className={tableCellClass}>{item.diagnosis_count}</td>
                        <td className={tableCellClass}>
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" onClick={() => void loadMasterDetail(item.id)}>Edit</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTemplateFilterMasterId(item.id);
                                setTemplatePage(1);
                                setTemplateForm((prev) => ({ ...prev, clinical_pathway_id: item.id }));
                                setActiveTab('template');
                              }}
                            >
                              Template
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (!window.confirm(confirmDeleteMessage)) return;
                                void deleteMaster(item.id);
                              }}
                              disabled={masterDeleting}
                            >
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!masterList.length ? (
                      <tr>
                        <td className={tableCellClass} colSpan={7}>Belum ada Clinical Pathway.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {renderListPagination(masterPagination, masterListLoading, setMasterPage)}
            </div>
          </div>
        ) : null}

        {activeTab === 'template' ? (
          <div className="grid gap-4 xl:grid-cols-[324px_minmax(0,1fr)]">
            <div className={panelClass}>
              <div className={`${panelHeaderClass} border-primary/10 bg-primary/10 text-primary dark:text-primary`}>Tambah Template Harian</div>
              <div className="space-y-4 p-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Clinical Pathway</label>
                  <SearchableMasterSelect
                    options={masterOptions}
                    value={Number(templateForm.clinical_pathway_id || 0)}
                    onChange={(nextId) => setTemplateForm((prev) => ({ ...prev, clinical_pathway_id: nextId }))}
                    placeholder="- Pilih Clinical Pathway -"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Hari</label>
                    <input className={inputClass} type="number" min={1} value={templateForm.hari_ke} onChange={(e) => setTemplateForm((prev) => ({ ...prev, hari_ke: Math.max(1, Number(e.target.value || 1)) }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Urutan</label>
                    <input className={inputClass} type="number" min={0} value={templateForm.urutan} onChange={(e) => setTemplateForm((prev) => ({ ...prev, urutan: Math.max(0, Number(e.target.value || 0)) }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Kategori</label>
                  <SearchableCategorySelect
                    groups={CATEGORY_GROUP_OPTIONS}
                    value={templateForm.kategori}
                    onChange={(nextValue) => setTemplateForm((prev) => ({ ...prev, kategori: nextValue }))}
                    placeholder="- Pilih Kategori -"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Kegiatan</label>
                  <input className={inputClass} value={templateForm.kegiatan} onChange={(e) => setTemplateForm((prev) => ({ ...prev, kegiatan: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Uraian Kegiatan</label>
                  <input className={inputClass} value={templateForm.uraian_kegiatan} onChange={(e) => setTemplateForm((prev) => ({ ...prev, uraian_kegiatan: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Aktivitas</label>
                  <textarea className={textareaClass} value={templateForm.aktivitas} onChange={(e) => setTemplateForm((prev) => ({ ...prev, aktivitas: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Keterangan</label>
                  <input className={inputClass} value={templateForm.keterangan} onChange={(e) => setTemplateForm((prev) => ({ ...prev, keterangan: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Wajib</label>
                  <select className={inputClass} value={templateForm.wajib} onChange={(e) => setTemplateForm((prev) => ({ ...prev, wajib: e.target.value === 'Tidak' ? 'Tidak' : 'Ya' }))}>
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void saveTemplate()} disabled={templateSaving}>
                    {templateSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTemplateForm(createEmptyTemplateForm())}>Reset</Button>
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className={panelHeaderClass}>Daftar Template Harian</div>
              <div className="flex flex-wrap items-center gap-2 border-b p-3 dark:border-slate-800">
                <Input
                  value={templateSearch}
                  onChange={(e) => {
                    setTemplateSearch(e.target.value);
                    setTemplatePage(1);
                  }}
                  placeholder="Cari hari / kategori / uraian / aktivitas / wajib / CP"
                  className="max-w-sm"
                />
                <Button size="sm" variant="outline" onClick={() => void fetchTemplateList()} disabled={templateListLoading}>
                  <Search className="h-4 w-4" />
                </Button>
                <SearchableMasterSelect
                  options={masterOptions}
                  value={Number(templateFilterMasterId || 0)}
                  onChange={(nextId) => {
                    setTemplateFilterMasterId(nextId);
                    setTemplatePage(1);
                  }}
                  placeholder="Semua Clinical Pathway"
                  allowEmpty
                  emptyOptionLabel="Semua Clinical Pathway"
                  className="max-w-md"
                />
                <Button size="sm" variant="outline" onClick={() => void fetchTemplateList()} disabled={templateListLoading}>
                  {templateListLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>Hari</th>
                      <th className={tableHeadClass}>Kategori</th>
                      <th className={tableHeadClass}>Uraian</th>
                      <th className={tableHeadClass}>Aktivitas</th>
                      <th className={tableHeadClass}>Wajib</th>
                      <th className={tableHeadClass}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateList.map((item) => (
                      <tr key={item.id}>
                        <td className={tableCellClass}>{item.hari_ke}</td>
                        <td className={tableCellClass}>{item.kategori}</td>
                        <td className={tableCellClass}>{item.uraian_kegiatan || '-'}</td>
                        <td className={tableCellClass}>{item.aktivitas || '-'}</td>
                        <td className={tableCellClass}>{item.wajib}</td>
                        <td className={tableCellClass}>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => copyTemplateToForm(item)}>Copy</Button>
                            <Button size="sm" variant="outline" onClick={() => void loadTemplateDetail(item.id)}>Edit</Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (!window.confirm(confirmDeleteMessage)) return;
                                void deleteTemplate(item.id);
                              }}
                              disabled={templateDeletingId === item.id}
                            >
                              {templateDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hapus'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!templateList.length ? (
                      <tr>
                        <td className={tableCellClass} colSpan={6}>Belum ada template harian.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {renderListPagination(templatePagination, templateListLoading, setTemplatePage)}
            </div>
          </div>
        ) : null}

        {activeTab === 'mapping' ? (
          <div className="grid gap-4 xl:grid-cols-[324px_minmax(0,1fr)]">
            <div className={panelClass}>
              <div className={`${panelHeaderClass} border-primary/10 bg-primary/10 text-primary dark:text-primary`}>Tambah Mapping ICD</div>
              <div className="space-y-4 p-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Clinical Pathway</label>
                  <SearchableMasterSelect
                    options={masterOptions}
                    value={Number(mappingForm.clinical_pathway_id || 0)}
                    onChange={(nextId) => {
                      const master = masterOptions.find((item) => item.id === nextId);
                      setMappingForm((prev) => ({
                        ...prev,
                        clinical_pathway_id: nextId,
                        confidence_score: Number(master?.confidence_score || 0)
                      }));
                    }}
                    placeholder="- Pilih Clinical Pathway -"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Kode ICD</label>
                  <input className={inputClass} value={mappingForm.kd_penyakit} onChange={(e) => setMappingForm((prev) => ({ ...prev, kd_penyakit: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Nama Diagnosa</label>
                  <input className={inputClass} value={mappingForm.nm_penyakit} onChange={(e) => setMappingForm((prev) => ({ ...prev, nm_penyakit: e.target.value }))} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Confidence</label>
                    <input className={inputClass} type="number" min={0} max={100} step="0.01" value={mappingForm.confidence_score} onChange={(e) => setMappingForm((prev) => ({ ...prev, confidence_score: Math.max(0, Math.min(100, Number(e.target.value || 0))) }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Prioritas</label>
                    <input className={inputClass} type="number" min={1} value={mappingForm.prioritas} onChange={(e) => setMappingForm((prev) => ({ ...prev, prioritas: Math.max(1, Number(e.target.value || 1)) }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Tipe</label>
                  <select className={inputClass} value={mappingForm.tipe} onChange={(e) => setMappingForm((prev) => ({ ...prev, tipe: e.target.value === 'Sekunder' ? 'Sekunder' : 'Utama' }))}>
                    <option value="Utama">Utama</option>
                    <option value="Sekunder">Sekunder</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void saveMapping()} disabled={mappingSaving}>
                    {mappingSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMappingForm(createEmptyMappingForm())}>Reset</Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={panelClass}>
                <div className={panelHeaderClass}>Pencarian ICD Master Penyakit</div>
                <div className="flex items-center gap-2 p-3">
                  <Input value={mappingIcdSearch} onChange={(e) => setMappingIcdSearch(e.target.value)} placeholder="Cari ICD / nama penyakit" />
                  <Button size="sm" onClick={() => void searchIcd(mappingIcdSearch, setMappingIcdResults, setMappingIcdLoading)} disabled={mappingIcdLoading}>
                    {mappingIcdLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Cari
                  </Button>
                </div>
                {mappingIcdResults.length ? (
                  <div className="border-t px-3 py-2 dark:border-slate-800">
                    <div className="grid gap-2 md:grid-cols-2">
                      {mappingIcdResults.map((item) => (
                        <button
                          key={item.kd_penyakit}
                          type="button"
                          onClick={() => setMappingForm((prev) => ({ ...prev, kd_penyakit: item.kd_penyakit, nm_penyakit: item.nm_penyakit }))}
                          className="rounded-md border p-3 text-left transition-colors hover:bg-muted/40 dark:border-slate-800"
                        >
                          <div className="text-xs font-semibold">{item.kd_penyakit}</div>
                          <div className="text-xs text-muted-foreground">{item.nm_penyakit}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>Daftar Mapping ICD</div>
                <div className="flex flex-wrap items-center gap-2 border-b p-3 dark:border-slate-800">
                  <SearchableMasterSelect
                    options={masterOptions}
                    value={Number(mappingFilterMasterId || 0)}
                    onChange={(nextId) => {
                      setMappingFilterMasterId(nextId);
                      setMappingPage(1);
                    }}
                    placeholder="Semua Clinical Pathway"
                    allowEmpty
                    emptyOptionLabel="Semua Clinical Pathway"
                    className="max-w-md"
                  />
                  <Input
                    value={mappingSearch}
                    onChange={(e) => {
                      setMappingSearch(e.target.value);
                      setMappingPage(1);
                    }}
                    placeholder="Cari kode ICD / nama diagnosis / CP"
                    className="max-w-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => void fetchMappingList()} disabled={mappingListLoading}>
                    {mappingListLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className={tableHeadClass}>Kode ICD</th>
                        <th className={tableHeadClass}>Diagnosa</th>
                        <th className={tableHeadClass}>CP</th>
                        <th className={tableHeadClass}>Confidence</th>
                        <th className={tableHeadClass}>Prioritas</th>
                        <th className={tableHeadClass}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappingList.map((item) => (
                        <tr key={item.id}>
                          <td className={tableCellClass}>{item.kd_penyakit}</td>
                          <td className={tableCellClass}>{item.nm_penyakit}</td>
                          <td className={tableCellClass}>{item.kode_cp} - {item.nama_cp}</td>
                          <td className={tableCellClass}>{formatPercent(item.confidence_score)}</td>
                          <td className={tableCellClass}>{item.prioritas}</td>
                          <td className={tableCellClass}>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => void loadMappingDetail(item.id)}>Edit</Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (!window.confirm(confirmDeleteMessage)) return;
                                  void deleteMapping(item.id);
                                }}
                                disabled={mappingDeletingId === item.id}
                              >
                                {mappingDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hapus'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!mappingList.length ? (
                        <tr>
                          <td className={tableCellClass} colSpan={6}>Belum ada mapping ICD.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              {renderListPagination(mappingPagination, mappingListLoading, setMappingPage)}
                {selectedMappingMaster ? (
                  <div className="border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground dark:border-slate-800">
                    Confidence aktif mengikuti master: {selectedMappingMaster.kode_cp} ({formatPercent(selectedMappingMaster.confidence_score)})
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'generator' ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[324px_minmax(0,1fr)]">
              <div className={panelClass}>
                <div className={`${panelHeaderClass} border-primary/10 bg-primary/10 text-primary dark:text-primary`}>Generator Pasien</div>
                <div className="space-y-4 p-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">No. Rawat</label>
                    <input className={inputClass} value={generatorNoRawat} onChange={(e) => setGeneratorNoRawat(e.target.value)} placeholder="2026/06/23/000018" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Clinical Pathway Manual</label>
                    <SearchableMasterSelect
                      options={masterOptions}
                      value={Number(generatorMasterId || 0)}
                      onChange={(nextId) => setGeneratorMasterId(nextId)}
                      placeholder="Auto dari diagnosis"
                      allowEmpty
                      emptyOptionLabel="Auto dari diagnosis"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void previewGenerator()} disabled={generatorLoading}>
                      {generatorLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void generatePatient()} disabled={generatorSaving || !generatorPreview}>
                      {generatorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Generate Pasien
                    </Button>
                  </div>
                </div>
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>Preview Generator Pasien</div>
                <div className="space-y-4 p-4">
                  {generatorPreview ? (
                    <>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-md border bg-muted/30 p-3 text-xs">
                          <div><span className="font-semibold">Pasien:</span> {generatorPreview.registration.nm_pasien}</div>
                          <div><span className="font-semibold">No. RM:</span> {generatorPreview.registration.no_rkm_medis}</div>
                          <div><span className="font-semibold">No. Rawat:</span> {generatorPreview.registration.no_rawat}</div>
                          <div><span className="font-semibold">Layanan:</span> {generatorPreview.registration.status_lanjut}</div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3 text-xs">
                          <div className="font-semibold">Diagnosis</div>
                          <ul className="mt-2 space-y-1">
                            {generatorPreview.diagnoses.map((item) => (
                              <li key={`${item.kd_penyakit}-${item.nm_penyakit}`}>{item.kd_penyakit} - {item.nm_penyakit}</li>
                            ))}
                            {!generatorPreview.diagnoses.length ? <li>-</li> : null}
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-md border p-3 dark:border-slate-800">
                        <div className="mb-2 text-sm font-semibold">Rekomendasi Clinical Pathway</div>
                        <div className="grid gap-2">
                          {generatorPreview.master_recommendations.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setGeneratorMasterId(item.id);
                                void previewGenerator(generatorPreview.registration.no_rawat, item.id);
                              }}
                              className={`rounded border px-3 py-2 text-left text-xs ${
                                Number(generatorMasterId || generatorPreview.selected_clinical_pathway_id) === Number(item.id)
                                  ? 'border-primary/30 bg-primary/10'
                                  : 'border-border bg-background dark:border-slate-800'
                              }`}
                            >
                              <div className="font-semibold">{item.kode_cp} - {item.nama_cp}</div>
                              <div className="text-muted-foreground">
                                {item.status_layanan} | LOS {item.target_los} | Match ICD {item.matched_icd_count} | Confidence {formatPercent(item.confidence_score)}
                              </div>
                            </button>
                          ))}
                          {!generatorPreview.master_recommendations.length ? (
                            <div className="text-xs text-muted-foreground">Belum ada rekomendasi clinical pathway.</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-md border p-3 dark:border-slate-800">
                          <div className="mb-2 text-sm font-semibold">Template Master</div>
                          <div className="space-y-2 text-xs">
                            {generatorPreview.master_template.days.map((day) => (
                              <div key={day.hari_ke} className="rounded-md border p-2 dark:border-slate-800">
                                <div className="font-semibold">{day.label_hari}</div>
                                <div className="text-muted-foreground">{day.activities.length} aktivitas</div>
                              </div>
                            ))}
                            {!generatorPreview.master_template.days.length ? <div>Tidak ada template master.</div> : null}
                          </div>
                        </div>
                        <div className="rounded-md border p-3 dark:border-slate-800">
                          <div className="mb-2 text-sm font-semibold">Template Historis</div>
                          <div className="text-xs text-muted-foreground">Sumber kasus: {generatorPreview.historical_template.source_case_count || 0}</div>
                          <div className="mt-2 space-y-2 text-xs">
                            {generatorPreview.historical_template.days.map((day) => (
                              <div key={day.hari_ke} className="rounded-md border p-2 dark:border-slate-800">
                                <div className="font-semibold">{day.label_hari}</div>
                                <div className="text-muted-foreground">{day.activities.length} aktivitas</div>
                              </div>
                            ))}
                            {!generatorPreview.historical_template.days.length ? <div>Tidak ada template historis.</div> : null}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Lakukan preview berdasarkan nomor rawat untuk melihat rekomendasi generator pasien.</div>
                  )}
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className={panelHeaderClass}>Daftar Pasien Generator dari Kamar Inap</div>
              <div className="space-y-3 border-b p-3 dark:border-slate-800">
                <div className="grid gap-2 lg:grid-cols-3">
                  <Input
                    value={generatorCandidateSearch}
                    onChange={(e) => setGeneratorCandidateSearch(e.target.value)}
                    placeholder="Cari no. rawat / pasien / ICD / CP"
                  />
                  <SearchableMasterSelect
                    options={masterOptions.filter((item) => item.aktif === 'Ya' && item.jenis_layanan === 'Ranap')}
                    value={Number(generatorCandidateClinicalPathwayId || 0)}
                    onChange={(nextId) => setGeneratorCandidateClinicalPathwayId(nextId)}
                    placeholder="Semua Clinical Pathway"
                    allowEmpty
                    emptyOptionLabel="Semua Clinical Pathway"
                    searchPlaceholder="Cari Clinical Pathway..."
                  />
                  <SearchableStringSelect
                    options={generatorBangsalOptions}
                    value={generatorCandidateBangsal}
                    onChange={setGeneratorCandidateBangsal}
                    placeholder="Semua Bangsal"
                    allowEmpty
                    emptyOptionLabel="Semua Bangsal"
                    searchPlaceholder="Cari Bangsal..."
                    emptyText="Bangsal tidak ditemukan."
                  />
                </div>
                <div className="grid gap-2 lg:grid-cols-3">
                  <SearchableStringSelect
                    options={generatorKamarOptions}
                    value={generatorCandidateKamar}
                    onChange={setGeneratorCandidateKamar}
                    placeholder="Semua Kamar"
                    allowEmpty
                    emptyOptionLabel="Semua Kamar"
                    searchPlaceholder="Cari Kamar..."
                    emptyText="Kamar tidak ditemukan."
                  />
                  <Input
                    type="date"
                    value={generatorCandidateDateStart}
                    onChange={(e) => setGeneratorCandidateDateStart(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={generatorCandidateDateEnd}
                    onChange={(e) => setGeneratorCandidateDateEnd(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (generatorCandidatePage !== 1) {
                        setGeneratorCandidatePage(1);
                        return;
                      }
                      void fetchGeneratorCandidates();
                    }}
                    disabled={generatorCandidateLoading}
                  >
                    {generatorCandidateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Tampilkan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setGeneratorCandidateSearch('');
                      setGeneratorCandidateClinicalPathwayId(0);
                      setGeneratorCandidateBangsal('');
                      setGeneratorCandidateKamar('');
                      setGeneratorCandidateDateStart('');
                      setGeneratorCandidateDateEnd('');
                      setGeneratorCandidatePage(1);
                    }}
                    disabled={generatorCandidateLoading}
                  >
                    Reset
                  </Button>
                  <label className="flex items-center gap-2 rounded-md border px-3 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    <Checkbox
                      checked={generatorBatchOnlyNew}
                      onCheckedChange={(checked) => setGeneratorBatchOnlyNew(Boolean(checked))}
                      aria-label="Hanya generate pasien yang belum punya Clinical Pathway"
                    />
                    Hanya yang belum dibuat CP
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGeneratorBatchSelections([])}
                    disabled={generatorSaving || generatorBatchSelections.length === 0}
                  >
                    Batal Pilih ({generatorBatchSelections.length})
                  </Button>
                  <Button
                    size="sm"
                    onClick={openGenerateBatchConfirm}
                    disabled={generatorSaving || generatorBatchSelections.length === 0}
                  >
                    {generatorSaving && generatorActionKey === 'generate:batch' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Batch ({generatorBatchSelections.length})
                  </Button>
                </div>
                {generatorBatchOnlyNew ? (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300">
                    Mode aman aktif: pasien yang sudah punya CP diberi highlight dan checkbox-nya dikunci.
                  </div>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={tableHeadClass}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={generatorAllCurrentPageSelected}
                            onCheckedChange={(checked) => toggleGeneratorCurrentPageSelections(Boolean(checked))}
                            aria-label="Pilih semua pasien pada halaman ini"
                          />
                        </div>
                      </th>
                      <th className={tableHeadClass}>No. Rawat</th>
                      <th className={tableHeadClass}>Pasien</th>
                      <th className={tableHeadClass}>Bangsal/Kamar</th>
                      <th className={tableHeadClass}>Masuk</th>
                      <th className={tableHeadClass}>ICD Match</th>
                      <th className={tableHeadClass}>Rekomendasi CP</th>
                      <th className={tableHeadClass}>Status CP</th>
                      <th className={tableHeadClass}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatorCandidates.map((item) => {
                      const previewKey = `preview:${item.no_rawat}`;
                      const generateKey = `generate:${item.no_rawat}`;
                      const isSelected = generatorBatchSelectionSet.has(item.no_rawat);
                      const hasExistingCp = Boolean(item.existing);
                      const batchSelectionDisabled = generatorBatchOnlyNew && hasExistingCp;
                      return (
                        <tr
                          key={item.no_rawat}
                          className={cn(
                            hasExistingCp ? 'bg-amber-50/70 dark:bg-amber-950/20' : '',
                            isSelected ? 'ring-1 ring-primary/20' : ''
                          )}
                        >
                          <td className={tableCellClass}>
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={isSelected}
                                disabled={batchSelectionDisabled}
                                onCheckedChange={(checked) => toggleGeneratorBatchSelection({
                                  no_rawat: item.no_rawat,
                                  no_rkm_medis: item.no_rkm_medis,
                                  nm_pasien: item.nm_pasien,
                                  has_existing_cp: Boolean(item.existing)
                                }, Boolean(checked))}
                                aria-label={`Pilih pasien ${item.nm_pasien}`}
                              />
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <div className="font-medium">{item.no_rawat}</div>
                            <div className="text-[11px] text-muted-foreground">{item.no_rkm_medis}</div>
                          </td>
                          <td className={tableCellClass}>{item.nm_pasien}</td>
                          <td className={tableCellClass}>
                            <div className="space-y-1 text-[11px]">
                              <div>{item.bangsal_labels.join(', ') || '-'}</div>
                              <div className="text-muted-foreground">{item.kamar_labels.join(', ') || '-'}</div>
                            </div>
                          </td>
                          <td className={tableCellClass}>{formatDateTime(item.tgl_masuk)}</td>
                          <td className={tableCellClass}>
                            <div className="space-y-1 text-[11px]">
                              {item.matched_icd_labels.slice(0, 3).map((label) => (
                                <div key={label}>{label}</div>
                              ))}
                              {item.matched_icd_labels.length > 3 ? (
                                <div className="text-muted-foreground">+{item.matched_icd_labels.length - 3} ICD lain</div>
                              ) : null}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <div className="space-y-1 text-[11px]">
                              {item.matched_clinical_pathway_labels.slice(0, 3).map((label) => (
                                <div key={label}>{label}</div>
                              ))}
                              {item.matched_clinical_pathway_labels.length > 3 ? (
                                <div className="text-muted-foreground">+{item.matched_clinical_pathway_labels.length - 3} CP lain</div>
                              ) : null}
                            </div>
                          </td>
                          <td className={cn(tableCellClass, 'max-w-[240px] whitespace-nowrap')}>
                            {item.existing ? (
                              <div className="max-w-[220px] text-[11px] whitespace-nowrap">
                                <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1">
                                  <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                    Sudah ada CP
                                  </span>
                                  {batchSelectionDisabled ? (
                                    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                      Terkunci mode aman
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className="mt-1 truncate font-medium"
                                  title={`${item.existing.kode_cp} - ${item.existing.nama_cp}`}
                                >
                                  {item.existing.kode_cp} - {item.existing.nama_cp}
                                </div>
                                <div className="truncate text-muted-foreground" title={item.existing.status_cp || 'Aktif'}>
                                  {item.existing.status_cp || 'Aktif'}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                                Belum dibuat CP
                              </span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void previewGenerator(item.no_rawat)}
                                disabled={generatorLoading}
                              >
                                {generatorLoading && generatorActionKey === previewKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview'}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => void generatePatient({
                                  no_rkm_medis: item.no_rkm_medis,
                                  no_rawat: item.no_rawat
                                })}
                                disabled={generatorSaving}
                              >
                                {generatorSaving && generatorActionKey === generateKey ? <Loader2 className="h-4 w-4 animate-spin" /> : item.existing ? 'Generate Ulang' : 'Generate'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!generatorCandidates.length ? (
                      <tr>
                        <td className={tableCellClass} colSpan={9}>Belum ada pasien rawat inap dengan ICD yang cocok untuk generator.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground dark:border-slate-800">
                <div>
                  Total {generatorCandidatePagination.total} pasien | Halaman {generatorCandidatePagination.page} / {generatorCandidatePagination.totalPages} | Terpilih {generatorBatchSelections.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGeneratorCandidatePage((prev) => Math.max(1, prev - 1))}
                    disabled={generatorCandidateLoading || generatorCandidatePagination.page <= 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGeneratorCandidatePage((prev) => Math.min(generatorCandidatePagination.totalPages, prev + 1))}
                    disabled={generatorCandidateLoading || generatorCandidatePagination.page >= generatorCandidatePagination.totalPages}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </div>

            <Dialog open={generatorBatchConfirmOpen} onOpenChange={setGeneratorBatchConfirmOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Konfirmasi Generate Batch</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border bg-muted/30 p-3 dark:border-slate-800">
                    <div>Total dipilih: {generatorBatchSelections.length} pasien</div>
                    <div>Sudah punya CP: {generatorBatchSelectedExistingCount} pasien</div>
                    <div>Akan diproses: {generatorBatchReadyItems.length} pasien</div>
                    <div>Mode aman: {generatorBatchOnlyNew ? 'Hanya yang belum dibuat CP' : 'Semua pasien terpilih'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Generate batch akan memproses pasien satu per satu sesuai filter dan pilihan yang sedang aktif.
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setGeneratorBatchConfirmOpen(false)}
                      disabled={generatorSaving}
                    >
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void generatePatientBatch()}
                      disabled={generatorSaving || generatorBatchReadyItems.length === 0}
                    >
                      {generatorSaving && generatorActionKey === 'generate:batch' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Ya, Generate Batch
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

        {activeTab === 'monitoring' ? (
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className={panelClass}>
                <div className={panelHeaderClass}>Daftar Monitoring</div>
                <div className="space-y-3 p-3">
                  <Input value={monitoringSearch} onChange={(e) => setMonitoringSearch(e.target.value)} placeholder="Cari no. rawat / pasien / CP" />
                  <select className={inputClass} value={monitoringStatus} onChange={(e) => setMonitoringStatus(e.target.value)}>
                    <option value="">Semua Status</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Batal">Batal</option>
                  </select>
                  <Button size="sm" onClick={() => void fetchMonitoringList()} disabled={monitoringListLoading}>
                    {monitoringListLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Tampilkan
                  </Button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto border-t dark:border-slate-800">
                  {monitoringList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void loadMonitoringDetail(item.id)}
                      className={`w-full border-b px-3 py-3 text-left transition-colors hover:bg-muted/40 dark:border-slate-800 ${
                        monitoringDetail?.patient?.id === item.id ? 'bg-primary/10' : 'bg-background'
                      }`}
                    >
                      <div className="text-xs font-semibold">{item.no_rawat}</div>
                      <div className="text-xs">{item.nm_pasien}</div>
                      <div className="text-[11px] text-muted-foreground">{item.nama_cp}</div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatPercent(item.compliance_percentage)}</span>
                        <span className="rounded bg-primary/85 px-2 py-0.5 text-primary-foreground">{item.status_cp}</span>
                      </div>
                    </button>
                  ))}
                  {!monitoringList.length ? (
                    <div className="p-4 text-sm text-muted-foreground">Belum ada data monitoring.</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className={panelHeaderClass}>Detail Monitoring</div>
              <div className="space-y-4 p-4">
                {monitoringDetailLoading ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat detail monitoring...
                  </div>
                ) : monitoringDetail ? (
                  <>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border bg-muted/30 p-3 text-xs">
                        <div><span className="font-semibold">Pasien:</span> {monitoringDetail.patient.nm_pasien}</div>
                        <div><span className="font-semibold">No. Rawat:</span> {monitoringDetail.patient.no_rawat}</div>
                        <div><span className="font-semibold">CP:</span> {monitoringDetail.patient.kode_cp} - {monitoringDetail.patient.nama_cp}</div>
                        <div><span className="font-semibold">Diagnosis:</span> {monitoringDetail.patient.nm_penyakit || monitoringDetail.patient.kd_penyakit || '-'}</div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3 text-xs">
                        <div><span className="font-semibold">Target LOS:</span> {monitoringDetail.patient.target_los} hari</div>
                        <div><span className="font-semibold">Kepatuhan:</span> {formatPercent(monitoringDetail.patient.compliance_percentage)}</div>
                        <div><span className="font-semibold">Variance Open:</span> {monitoringDetail.patient.variance_count}</div>
                        <div><span className="font-semibold">Status:</span> {monitoringDetail.patient.status_cp}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={openMonitoringPrintPreview}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void refreshMonitoring()} disabled={monitoringActionKey === 'refresh'}>
                        {monitoringActionKey === 'refresh' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Refresh Monitoring
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void updatePatientStatus('Aktif')} disabled={monitoringActionKey === 'patient-Aktif'}>Set Aktif</Button>
                      <Button size="sm" variant="outline" onClick={() => void updatePatientStatus('Selesai')} disabled={monitoringActionKey === 'patient-Selesai'}>Set Selesai</Button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className={tableHeadClass}>Hari</th>
                            <th className={tableHeadClass}>Kategori</th>
                            <th className={tableHeadClass}>Aktivitas</th>
                            <th className={tableHeadClass}>Status</th>
                            <th className={tableHeadClass}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monitoringDetail.execution.map((item) => (
                            <tr key={item.id}>
                              <td className={tableCellClass}>{item.hari_ke}</td>
                              <td className={tableCellClass}>{item.kategori}</td>
                              <td className={tableCellClass}>
                                <div>{item.aktivitas}</div>
                                <div className="text-[11px] text-muted-foreground">{item.uraian_kegiatan || item.keterangan || '-'}</div>
                              </td>
                              <td className={tableCellClass}>{item.status}</td>
                              <td className={cn(tableCellClass, 'whitespace-nowrap')}>
                                <div className="flex flex-nowrap items-center gap-2">
                                  <ToggleGroup
                                    type="single"
                                    value={item.status}
                                    variant="outline"
                                    size="sm"
                                    className="flex-nowrap justify-start gap-0 whitespace-nowrap"
                                    onValueChange={(nextStatus) => {
                                      if (nextStatus && nextStatus !== item.status) {
                                        void updateExecutionStatus(item.id, nextStatus);
                                      }
                                    }}
                                  >
                                    {['Planned', 'Completed', 'Missed'].map((status, index) => (
                                      <ToggleGroupItem
                                        key={status}
                                        value={status}
                                        disabled={monitoringActionKey.startsWith(`execution-${item.id}-`)}
                                        className={cn(
                                          'min-w-[78px] whitespace-nowrap rounded-none px-2 text-xs',
                                          index === 0 && 'rounded-l-md',
                                          index === 2 && 'rounded-r-md',
                                          item.status === status && status === 'Completed' && 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white',
                                          item.status === status && status === 'Missed' && 'border-rose-600 bg-rose-600 text-white hover:bg-rose-600 hover:text-white',
                                          item.status === status && status === 'Planned' && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                                        )}
                                      >
                                        {status}
                                      </ToggleGroupItem>
                                    ))}
                                  </ToggleGroup>
                                  {monitoringActionKey.startsWith(`execution-${item.id}-`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!monitoringDetail.execution.length ? (
                            <tr>
                              <td className={tableCellClass} colSpan={5}>Belum ada aktivitas monitoring.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="mb-2 text-sm font-semibold">Variance</div>
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className={tableHeadClass}>Hari</th>
                            <th className={tableHeadClass}>Kategori</th>
                            <th className={tableHeadClass}>Deskripsi</th>
                            <th className={tableHeadClass}>Severity</th>
                            <th className={tableHeadClass}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monitoringDetail.variance.map((item) => (
                            <tr key={item.id}>
                              <td className={tableCellClass}>{item.hari_ke || '-'}</td>
                              <td className={tableCellClass}>{item.kategori_variance}</td>
                              <td className={tableCellClass}>{item.deskripsi}</td>
                              <td className={tableCellClass}>{item.severity}</td>
                              <td className={tableCellClass}>{item.status}</td>
                            </tr>
                          ))}
                          {!monitoringDetail.variance.length ? (
                            <tr>
                              <td className={tableCellClass} colSpan={5}>Tidak ada variance.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Pilih pasien CP dari daftar monitoring untuk melihat detail.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="max-w-7xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4 pr-10">
              <DialogTitle>Print Preview Clinical Pathway</DialogTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPrintPreviewOpen(false)}>
                  Tutup
                </Button>
                <Button onClick={handlePrintPreview}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="h-[80vh] bg-muted/30 p-4">
            {printPreviewHtml ? (
              <iframe
                ref={printPreviewFrameRef}
                title="Print Preview Clinical Pathway"
                srcDoc={printPreviewHtml}
                className="h-full w-full rounded-md border bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Preview belum tersedia.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClinicalPathwayMaster;
