import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, Calculator, Save, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from "@/lib/utils";
import { InacbgTariffSimulationDialog } from './InacbgTariffSimulationDialog';

interface ICD10Data {
  id?: string;
  kd_penyakit: string;
  nm_penyakit: string;
  ciri_ciri: string;
  keterangan: string;
  status: 'Menular' | 'Tidak Menular';
  prioritas: 'Utama' | 'Sekunder';
  status_layanan: 'Ralan' | 'Ranap';
  snomed_concept_id?: string;
  snomed_term?: string;
}

interface ICD9Data {
  id?: string;
  kode: string;
  deskripsi_panjang: string;
  deskripsi_pendek: string;
  prioritas: 'Utama' | 'Sekunder';
  status_layanan: 'Ralan' | 'Ranap';
  snomed_concept_id?: string;
  snomed_term?: string;
}

interface Icd10Option {
  kd_penyakit: string;
  nm_penyakit: string;
  ciri_ciri?: string;
  keterangan?: string;
  status?: 'Menular' | 'Tidak Menular';
}

interface Icd9Option {
  kode: string;
  deskripsi_panjang: string;
  deskripsi_pendek: string;
}

interface SnomedOption {
  kode: string;
  istilah: string;
}

type ServiceStatus = 'Ralan' | 'Ranap';

const normalizeServiceStatus = (value?: string | null, fallback: ServiceStatus = 'Ralan'): ServiceStatus => (
  value === 'Ranap' ? 'Ranap' : value === 'Ralan' ? 'Ralan' : fallback
);

const createEmptyIcd10Entry = (defaultStatusLayanan: ServiceStatus = 'Ralan'): ICD10Data => ({
  kd_penyakit: '',
  nm_penyakit: '',
  ciri_ciri: '',
  keterangan: '',
  status: 'Tidak Menular',
  prioritas: 'Utama',
  status_layanan: defaultStatusLayanan,
  snomed_concept_id: '',
  snomed_term: ''
});

const createEmptyIcd9Entry = (defaultStatusLayanan: ServiceStatus = 'Ralan'): ICD9Data => ({
  kode: '',
  deskripsi_panjang: '',
  deskripsi_pendek: '',
  prioritas: 'Utama',
  status_layanan: defaultStatusLayanan,
  snomed_concept_id: '',
  snomed_term: ''
});

interface ICDModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
  defaultStatusLayanan?: ServiceStatus;
  onDataChanged?: () => void;
}

type TabType = 'icd10' | 'icd9';

const formatIcd9ProcedureCode = (value: string) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.includes('.')) {
    return normalizedValue;
  }

  if (normalizedValue.length <= 2) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 2)}.${normalizedValue.slice(2)}`;
};

const handleScrollableCommandWheel = (event: React.WheelEvent<HTMLElement>) => {
  const element = event.currentTarget;
  if (element.scrollHeight <= element.clientHeight) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  element.scrollTop += event.deltaY;
};

export const ICDModal: React.FC<ICDModalProps> = ({
  isOpen,
  onClose,
  noRawat,
  defaultStatusLayanan = 'Ralan',
  onDataChanged
}) => {
  const { user } = useAuth();
  const fallbackStatusLayanan = normalizeServiceStatus(defaultStatusLayanan);
  const [activeTab, setActiveTab] = useState('icd10');
  const [icd10Data, setIcd10Data] = useState<ICD10Data[]>([]);
  const [icd9Data, setIcd9Data] = useState<ICD9Data[]>([]);
  const [showTariffModal, setShowTariffModal] = useState(false);
  const [loadingSavedData, setLoadingSavedData] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [icd10Drafts, setIcd10Drafts] = useState<ICD10Data[]>([createEmptyIcd10Entry(fallbackStatusLayanan)]);
  const [icd9Drafts, setIcd9Drafts] = useState<ICD9Data[]>([createEmptyIcd9Entry(fallbackStatusLayanan)]);
  const [icdSearchOpenByKey, setIcdSearchOpenByKey] = useState<Record<string, boolean>>({});
  const [icdSearchQueryByKey, setIcdSearchQueryByKey] = useState<Record<string, string>>({});
  const [icdSearchResultsByKey, setIcdSearchResultsByKey] = useState<Record<string, any[]>>({});
  const [icdSearchLoadingByKey, setIcdSearchLoadingByKey] = useState<Record<string, boolean>>({});
  const [snomedSearchOpenByKey, setSnomedSearchOpenByKey] = useState<Record<string, boolean>>({});
  const [snomedSearchQueryByKey, setSnomedSearchQueryByKey] = useState<Record<string, string>>({});
  const [snomedSearchResultsByKey, setSnomedSearchResultsByKey] = useState<Record<string, any[]>>({});
  const [snomedSearchLoadingByKey, setSnomedSearchLoadingByKey] = useState<Record<string, boolean>>({});
  const currentUsername = String(user?.username || '').trim();
  const currentUserName = String(user?.name || user?.username || '').trim();

  const { toast } = useToast();

  const resetSearchState = () => {
    setIcdSearchOpenByKey({});
    setIcdSearchQueryByKey({});
    setIcdSearchResultsByKey({});
    setIcdSearchLoadingByKey({});
    setSnomedSearchOpenByKey({});
    setSnomedSearchQueryByKey({});
    setSnomedSearchResultsByKey({});
    setSnomedSearchLoadingByKey({});
  };

  const applyLoadedData = (data?: { icd10?: ICD10Data[]; icd9?: ICD9Data[] }) => {
    const nextIcd10 = Array.isArray(data?.icd10)
      ? data.icd10.map((item) => ({
          ...item,
          status_layanan: normalizeServiceStatus(item.status_layanan, fallbackStatusLayanan)
        })).filter((item) => item.status_layanan === fallbackStatusLayanan)
      : [];
    const nextIcd9 = Array.isArray(data?.icd9)
      ? data.icd9.map((item) => ({
          ...item,
          status_layanan: normalizeServiceStatus(item.status_layanan, fallbackStatusLayanan)
        })).filter((item) => item.status_layanan === fallbackStatusLayanan)
      : [];

    setIcd10Data(nextIcd10);
    setIcd9Data(nextIcd9);
    setIcd10Drafts(nextIcd10.length ? nextIcd10.map((item) => ({ ...item })) : [createEmptyIcd10Entry(fallbackStatusLayanan)]);
    setIcd9Drafts(nextIcd9.length ? nextIcd9.map((item) => ({ ...item })) : [createEmptyIcd9Entry(fallbackStatusLayanan)]);
    resetSearchState();
  };

  const loadSavedData = async () => {
    if (!noRawat) {
      applyLoadedData();
      return;
    }

    setLoadingSavedData(true);
    try {
      const response = await fetch(
        `${API_URLS.ICD_MANAGEMENT}/${encodeURIComponent(noRawat)}?status_layanan=${encodeURIComponent(fallbackStatusLayanan)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      applyLoadedData(result.data);
    } catch (error) {
      console.error('Error loading saved ICD data:', error);
      applyLoadedData();
      toast({
        title: "Error",
        description: "Gagal memuat data ICD pasien",
        variant: "destructive",
      });
    } finally {
      setLoadingSavedData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadSavedData();
    }
  }, [fallbackStatusLayanan, isOpen, noRawat]);

  const getFieldKey = (tab: TabType, index: number) => `${tab}-${index}`;

  const fetchIcdOptions = async (tab: TabType, index: number, search: string) => {
    const fieldKey = getFieldKey(tab, index);
    setIcdSearchLoadingByKey((prev) => ({ ...prev, [fieldKey]: true }));

    try {
      const response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          itemsPerPage: 20,
          search,
          icdType: tab
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setIcdSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: data.data || [] }));
    } catch (error) {
      console.error('Error fetching ICD options:', error);
      toast({
        title: "Error",
        description: "Gagal memuat pilihan ICD",
        variant: "destructive",
      });
      setIcdSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: [] }));
    } finally {
      setIcdSearchLoadingByKey((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const fetchSnomedOptions = async (tab: TabType, index: number, relatedIcdCode: string, search: string) => {
    const fieldKey = getFieldKey(tab, index);
    setSnomedSearchLoadingByKey((prev) => ({ ...prev, [fieldKey]: true }));

    try {
      const response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          itemsPerPage: 20,
          search,
          icdType: 'snomed',
          relatedIcdCode,
          relatedIcdType: tab
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSnomedSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: data.data || [] }));
    } catch (error) {
      console.error('Error fetching SNOMED options:', error);
      toast({
        title: "Error",
        description: "Gagal memuat pilihan SNOMED-CT",
        variant: "destructive",
      });
      setSnomedSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: [] }));
    } finally {
      setSnomedSearchLoadingByKey((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const addDraftRow = (tab: TabType) => {
    if (tab === 'icd10') {
      setIcd10Drafts((prev) => [...prev, createEmptyIcd10Entry(fallbackStatusLayanan)]);
      return;
    }
    setIcd9Drafts((prev) => [...prev, createEmptyIcd9Entry(fallbackStatusLayanan)]);
  };

  const removeDraftRow = (tab: TabType, index: number) => {
    if (tab === 'icd10') {
      if (icd10Drafts.length > 1) {
        setIcd10Drafts((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
      }
      return;
    }

    if (icd9Drafts.length > 1) {
      setIcd9Drafts((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    }
  };

  const updateIcd10Draft = (index: number, updater: (item: ICD10Data) => ICD10Data) => {
    setIcd10Drafts((prev) => prev.map((item, rowIndex) => rowIndex === index ? updater(item) : item));
  };

  const updateIcd9Draft = (index: number, updater: (item: ICD9Data) => ICD9Data) => {
    setIcd9Drafts((prev) => prev.map((item, rowIndex) => rowIndex === index ? updater(item) : item));
  };

  const handleIcdQueryChange = (tab: TabType, index: number, value: string) => {
    const fieldKey = getFieldKey(tab, index);
    setIcdSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: value }));
    void fetchIcdOptions(tab, index, value);
  };

  const handleSelectIcd = (tab: TabType, index: number, selectedValue: string) => {
    const fieldKey = getFieldKey(tab, index);
    const options = icdSearchResultsByKey[fieldKey] || [];
    const selectedItem = tab === 'icd10'
      ? (options as Icd10Option[]).find((item) => item.kd_penyakit === selectedValue)
      : (options as Icd9Option[]).find((item) => item.kode === selectedValue);

    if (!selectedItem) return;

    if (tab === 'icd10') {
      const icd10Item = selectedItem as Icd10Option;
      updateIcd10Draft(index, (item) => ({
        ...item,
        kd_penyakit: icd10Item.kd_penyakit,
        nm_penyakit: icd10Item.nm_penyakit,
        ciri_ciri: icd10Item.ciri_ciri || item.ciri_ciri,
        keterangan: icd10Item.keterangan || item.keterangan,
        status: icd10Item.status || item.status,
        snomed_concept_id: '',
        snomed_term: ''
      }));
      setIcdSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: `${icd10Item.kd_penyakit} - ${icd10Item.nm_penyakit}` }));
      setSnomedSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: icd10Item.nm_penyakit || '' }));
      setSnomedSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: [] }));
      void fetchSnomedOptions(tab, index, icd10Item.kd_penyakit, icd10Item.nm_penyakit || '');
      return;
    }

    const icd9Item = selectedItem as Icd9Option;
    updateIcd9Draft(index, (item) => ({
      ...item,
      kode: icd9Item.kode,
      deskripsi_pendek: icd9Item.deskripsi_pendek,
      deskripsi_panjang: icd9Item.deskripsi_panjang || item.deskripsi_panjang,
      snomed_concept_id: '',
      snomed_term: ''
    }));
    setIcdSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: `${formatIcd9ProcedureCode(icd9Item.kode)} - ${icd9Item.deskripsi_pendek}` }));
    setSnomedSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: icd9Item.deskripsi_pendek || '' }));
    setSnomedSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: [] }));
    void fetchSnomedOptions(tab, index, icd9Item.kode, icd9Item.deskripsi_pendek || '');
  };

  const handleSnomedQueryChange = (tab: TabType, index: number, relatedIcdCode: string, value: string) => {
    const fieldKey = getFieldKey(tab, index);
    setSnomedSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: value }));
    if (!relatedIcdCode) {
      setSnomedSearchResultsByKey((prev) => ({ ...prev, [fieldKey]: [] }));
      return;
    }
    void fetchSnomedOptions(tab, index, relatedIcdCode, value);
  };

  const handleSelectSnomed = (tab: TabType, index: number, selectedValue: string) => {
    const fieldKey = getFieldKey(tab, index);
    const options = snomedSearchResultsByKey[fieldKey] || [];
    const selectedItem = options.find((item: SnomedOption) => item.kode === selectedValue);

    if (!selectedItem) return;

    if (tab === 'icd10') {
      updateIcd10Draft(index, (item) => ({
        ...item,
        snomed_concept_id: selectedItem.kode,
        snomed_term: selectedItem.istilah
      }));
      setSnomedSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: `${selectedItem.kode} - ${selectedItem.istilah}` }));
      return;
    }

    updateIcd9Draft(index, (item) => ({
      ...item,
      snomed_concept_id: selectedItem.kode,
      snomed_term: selectedItem.istilah
    }));
    setSnomedSearchQueryByKey((prev) => ({ ...prev, [fieldKey]: `${selectedItem.kode} - ${selectedItem.istilah}` }));
  };

  const handleDeleteSaved = async (tab: TabType, item: ICD10Data | ICD9Data) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return;

    try {
      const response = await fetch(API_URLS.ICD_MANAGEMENT, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUsername,
          'x-username': currentUsername,
          'x-user-name': currentUserName
        },
        body: JSON.stringify({
          no_rawat: noRawat,
          icdType: tab,
          prioritas: item.prioritas,
          status_layanan: item.status_layanan,
          username: currentUsername,
          nama: currentUserName,
          ...(tab === 'icd10'
            ? { kd_penyakit: (item as ICD10Data).kd_penyakit }
            : { kode: (item as ICD9Data).kode })
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      applyLoadedData(result.data);
      onDataChanged?.();
      toast({ title: "Berhasil", description: `Data ${tab === 'icd10' ? 'ICD-10' : 'ICD-9'} berhasil dihapus` });
    } catch (error) {
      console.error('Error deleting ICD item:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus data ICD",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    try {
      if (!noRawat) {
        toast({
          title: "Error",
          description: "No. rawat tidak tersedia",
          variant: "destructive",
        });
        return;
      }

      setSavingData(true);

      if (activeTab === 'icd10') {
        const validItems = icd10Drafts
          .filter((item) => item.kd_penyakit && item.nm_penyakit)
          .map((item) => ({ ...item, status_layanan: fallbackStatusLayanan }));

        const response = await fetch(API_URLS.ICD_MANAGEMENT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUsername,
            'x-username': currentUsername,
            'x-user-name': currentUserName
          },
          body: JSON.stringify({
            no_rawat: noRawat,
            icdType: 'icd10',
            status_layanan: fallbackStatusLayanan,
            username: currentUsername,
            nama: currentUserName,
            items: validItems
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        applyLoadedData(result.data);
        onDataChanged?.();
        toast({ title: "Berhasil", description: "Data ICD-10 dan SNOMED-CT berhasil disimpan" });
      } else {
        const validItems = icd9Drafts
          .filter((item) => item.kode && item.deskripsi_pendek)
          .map((item) => ({ ...item, status_layanan: fallbackStatusLayanan }));

        const response = await fetch(API_URLS.ICD_MANAGEMENT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUsername,
            'x-username': currentUsername,
            'x-user-name': currentUserName
          },
          body: JSON.stringify({
            no_rawat: noRawat,
            icdType: 'icd9',
            status_layanan: fallbackStatusLayanan,
            username: currentUsername,
            nama: currentUserName,
            items: validItems
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        applyLoadedData(result.data);
        onDataChanged?.();
        toast({ title: "Berhasil", description: "Data ICD-9 dan SNOMED-CT berhasil disimpan" });
      }
    } catch (error) {
      console.error('Error saving ICD data:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan data ICD",
        variant: "destructive",
      });
    } finally {
      setSavingData(false);
    }
  };

  const handleTariffSimulation = () => {
    setShowTariffModal(true);
  };

  const currentSavedData = activeTab === 'icd10' ? icd10Data : icd9Data;

  const getSelectedIcdLabel = (tab: TabType, draft: ICD10Data | ICD9Data) => {
    if (tab === 'icd10') {
      const icd10Item = draft as ICD10Data;
      return icd10Item.kd_penyakit && icd10Item.nm_penyakit
        ? `${icd10Item.kd_penyakit} - ${icd10Item.nm_penyakit}`
        : '';
    }

    const icd9Item = draft as ICD9Data;
    return icd9Item.kode && icd9Item.deskripsi_pendek
      ? `${formatIcd9ProcedureCode(icd9Item.kode)} - ${icd9Item.deskripsi_pendek}`
      : '';
  };

  const getSelectedSnomedLabel = (tab: TabType, draft: ICD10Data | ICD9Data) => {
    const conceptId = tab === 'icd10'
      ? (draft as ICD10Data).snomed_concept_id
      : (draft as ICD9Data).snomed_concept_id;
    const term = tab === 'icd10'
      ? (draft as ICD10Data).snomed_term
      : (draft as ICD9Data).snomed_term;

    return conceptId && term ? `${conceptId} - ${term}` : '';
  };

  const getSnomedTriggerLabel = (tab: TabType, draft: ICD10Data | ICD9Data, fieldKey: string) => {
    const selectedLabel = getSelectedSnomedLabel(tab, draft);
    if (selectedLabel) {
      return selectedLabel;
    }

    return snomedSearchQueryByKey[fieldKey] || 'Cari dan pilih SNOMED-CT';
  };

  const renderIcdDraftRows = (tab: TabType) => {
    const drafts = tab === 'icd10' ? icd10Drafts : icd9Drafts;

    return drafts.map((draft: ICD10Data | ICD9Data, index: number) => {
      const fieldKey = getFieldKey(tab, index);
      const icdOptions = icdSearchResultsByKey[fieldKey] || [];
      const snomedOptions = snomedSearchResultsByKey[fieldKey] || [];
      const isIcdLoading = Boolean(icdSearchLoadingByKey[fieldKey]);
      const isSnomedLoading = Boolean(snomedSearchLoadingByKey[fieldKey]);
      const selectedIcdCode = tab === 'icd10' ? (draft as ICD10Data).kd_penyakit : (draft as ICD9Data).kode;
      const selectedIcdLabel = getSelectedIcdLabel(tab, draft);
      const selectedSnomedLabel = getSnomedTriggerLabel(tab, draft, fieldKey);

      return (
        <div
          key={fieldKey}
          className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:rounded-none md:border-0 md:border-b md:p-0 md:pb-3 md:last:border-b-0 md:last:pb-0 md:grid-cols-[minmax(0,1.7fr)_150px_minmax(0,1.7fr)_140px_140px] md:items-end"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:hidden">
            Baris {index + 1}
          </div>
          <div className="space-y-2">
            <Label className="md:hidden">{tab === 'icd10' ? 'Cari ICD-10' : 'Cari ICD-9-CM'}</Label>
            <div className="space-y-2">
              <Popover
                open={!!icdSearchOpenByKey[fieldKey]}
                onOpenChange={(open) => {
                  setIcdSearchOpenByKey((prev) => ({ ...prev, [fieldKey]: open }));
                  if (open && !icdSearchResultsByKey[fieldKey]?.length) {
                    void fetchIcdOptions(tab, index, icdSearchQueryByKey[fieldKey] || '');
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={!!icdSearchOpenByKey[fieldKey]}
                    className="w-full justify-between"
                  >
                    <span className="truncate text-left">
                      {selectedIcdLabel || `Cari dan pilih ${tab === 'icd10' ? 'ICD-10' : 'ICD-9-CM'}`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent disablePortal className="w-[calc(100vw-2rem)] max-w-[520px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={tab === 'icd10' ? 'Cari kode atau nama penyakit...' : 'Cari kode atau deskripsi tindakan...'}
                      value={icdSearchQueryByKey[fieldKey] ?? ''}
                      onValueChange={(value) => {
                        handleIcdQueryChange(tab, index, value);
                      }}
                    />
                    <CommandList
                      className="max-h-[320px] overscroll-contain"
                      onWheelCapture={handleScrollableCommandWheel}
                    >
                      <CommandEmpty>
                        {isIcdLoading ? 'Memuat data ICD...' : 'Tidak ada data ICD ditemukan.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {icdOptions.map((option: Icd10Option | Icd9Option) => {
                          const value = tab === 'icd10'
                            ? (option as Icd10Option).kd_penyakit
                            : (option as Icd9Option).kode;
                          return (
                            <CommandItem
                              key={value}
                              value={tab === 'icd10'
                                ? `${(option as Icd10Option).kd_penyakit} ${(option as Icd10Option).nm_penyakit}`
                                : `${formatIcd9ProcedureCode((option as Icd9Option).kode)} ${(option as Icd9Option).deskripsi_pendek}`
                              }
                              onSelect={() => {
                                handleSelectIcd(tab, index, value);
                                setIcdSearchOpenByKey((prev) => ({ ...prev, [fieldKey]: false }));
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedIcdCode === value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{tab === 'icd10' ? (option as Icd10Option).nm_penyakit : (option as Icd9Option).deskripsi_pendek}</span>
                                <span className="text-xs text-muted-foreground">
                                  {tab === 'icd10' ? value : formatIcd9ProcedureCode(value)}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="md:hidden">Prioritas</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tab === 'icd10' ? (draft as ICD10Data).prioritas : (draft as ICD9Data).prioritas}
              onChange={(e) => {
                const value = e.target.value as 'Utama' | 'Sekunder';
                if (tab === 'icd10') {
                  updateIcd10Draft(index, (item) => ({ ...item, prioritas: value }));
                  return;
                }
                updateIcd9Draft(index, (item) => ({ ...item, prioritas: value }));
              }}
            >
              <option value="Utama">Utama</option>
              <option value="Sekunder">Sekunder</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="md:hidden">Cari SNOMED-CT</Label>
            <div className="space-y-2">
              <Popover
                open={!!snomedSearchOpenByKey[fieldKey]}
                onOpenChange={(open) => {
                  setSnomedSearchOpenByKey((prev) => ({ ...prev, [fieldKey]: open }));
                  if (open && selectedIcdCode && !snomedSearchResultsByKey[fieldKey]?.length) {
                    void fetchSnomedOptions(tab, index, selectedIcdCode, snomedSearchQueryByKey[fieldKey] || '');
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={!!snomedSearchOpenByKey[fieldKey]}
                    className="w-full justify-between"
                    disabled={!selectedIcdCode}
                  >
                    <span className="truncate text-left">
                      {selectedSnomedLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent disablePortal className="w-[calc(100vw-2rem)] max-w-[520px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Cari concept id atau istilah SNOMED-CT..."
                      value={snomedSearchQueryByKey[fieldKey] ?? ''}
                      onValueChange={(value) => {
                        handleSnomedQueryChange(tab, index, selectedIcdCode, value);
                      }}
                    />
                    <CommandList
                      className="max-h-[320px]"
                      onWheelCapture={handleScrollableCommandWheel}
                    >
                      <CommandEmpty>
                        {isSnomedLoading ? 'Memuat data SNOMED-CT...' : 'Tidak ada data SNOMED-CT ditemukan.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {snomedOptions.map((option: SnomedOption) => (
                          <CommandItem
                            key={option.kode}
                            value={`${option.kode} ${option.istilah}`}
                            onSelect={() => {
                              handleSelectSnomed(tab, index, option.kode);
                              setSnomedSearchOpenByKey((prev) => ({ ...prev, [fieldKey]: false }));
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                (tab === 'icd10'
                                  ? (draft as ICD10Data).snomed_concept_id
                                  : (draft as ICD9Data).snomed_concept_id) === option.kode ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{option.istilah}</span>
                              <span className="text-xs text-muted-foreground">{option.kode}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="md:hidden">Status</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tab === 'icd10' ? (draft as ICD10Data).status_layanan : (draft as ICD9Data).status_layanan}
              onChange={() => undefined}
              disabled
            >
              <option value={fallbackStatusLayanan}>{fallbackStatusLayanan}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="md:hidden">Aksi</Label>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removeDraftRow(tab, index)}
              disabled={drafts.length === 1}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus
            </Button>
          </div>
        </div>
      );
    });
  };

  const renderSavedDataCards = (tab: TabType) => {
    if (currentSavedData.length === 0) {
      return (
        <div className="rounded-lg border bg-background p-4 text-sm text-center text-muted-foreground">
          {tab === 'icd10'
            ? 'Belum ada data ICD-10 yang disimpan.'
            : 'Belum ada data ICD-9 yang disimpan.'}
        </div>
      );
    }

    return currentSavedData.map((item: ICD10Data | ICD9Data, index: number) => {
      if (tab === 'icd10') {
        const icd10Item = item as ICD10Data;

        return (
          <div key={icd10Item.kd_penyakit || icd10Item.id || index} className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Kode</p>
                <p className="font-mono text-sm break-all">{icd10Item.kd_penyakit || '-'}</p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="shrink-0"
                onClick={() => handleDeleteSaved('icd10', icd10Item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nama Penyakit</p>
              <p className="text-sm">{icd10Item.nm_penyakit || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SNOMED-CT</p>
              <p className="font-mono text-sm break-all">{icd10Item.snomed_concept_id || '-'}</p>
              <p className="text-sm text-muted-foreground">{icd10Item.snomed_term || '-'}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Prioritas</p>
                <p className="text-sm">{icd10Item.prioritas}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm">{icd10Item.status_layanan}</p>
              </div>
            </div>
          </div>
        );
      }

      const icd9Item = item as ICD9Data;

      return (
        <div key={icd9Item.kode || icd9Item.id || index} className="rounded-lg border bg-background p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Kode</p>
              <p className="font-mono text-sm break-all">{formatIcd9ProcedureCode(icd9Item.kode) || '-'}</p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="shrink-0"
              onClick={() => handleDeleteSaved('icd9', icd9Item)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deskripsi Pendek</p>
            <p className="text-sm">{icd9Item.deskripsi_pendek || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">SNOMED-CT</p>
            <p className="font-mono text-sm break-all">{icd9Item.snomed_concept_id || '-'}</p>
            <p className="text-sm text-muted-foreground">{icd9Item.snomed_term || '-'}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Prioritas</p>
              <p className="text-sm">{icd9Item.prioritas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm">{icd9Item.status_layanan}</p>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>ICD Management System</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-2">
              <TabsTrigger value="icd10" className="px-2 text-xs sm:text-sm">
                ICD-10
              </TabsTrigger>
              <TabsTrigger value="icd9" className="px-2 text-xs sm:text-sm">
                ICD-9-CM
              </TabsTrigger>
            </TabsList>

            <div className="space-y-4 mt-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium break-all">No. Rawat: {noRawat || '-'}</p>
                    <p className="text-sm text-muted-foreground">
                      Gunakan input ringkas untuk ICD, prioritas, SNOMED-CT, dan status layanan per baris.
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => addDraftRow(activeTab as TabType)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Baris
                    </Button>
                    <Button type="button" className="w-full sm:w-auto" onClick={handleSave} disabled={savingData || loadingSavedData}>
                      <Save className="h-4 w-4 mr-2" />
                      {savingData ? 'Menyimpan...' : 'Simpan Data'}
                    </Button>
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleTariffSimulation}>
                      <Calculator className="h-4 w-4 mr-2" />
                      Tarif INACBG's
                    </Button>
                  </div>
                </div>
              </div>

              <TabsContent value="icd10" className="space-y-4">
                {loadingSavedData && (
                  <div className="text-sm text-muted-foreground">Memuat data ICD-10...</div>
                )}
                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3 hidden border-b pb-3 text-sm font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1.7fr)_150px_minmax(0,1.7fr)_140px_140px] md:gap-3">
                    <div>Cari ICD-10</div>
                    <div>Prioritas</div>
                    <div>Cari SNOMED-CT</div>
                    <div>Status</div>
                    <div>Aksi</div>
                  </div>
                  <div className="space-y-3">
                    {renderIcdDraftRows('icd10')}
                  </div>
                </div>

                <div className="space-y-3 md:hidden">
                  {renderSavedDataCards('icd10')}
                </div>

                <div className="hidden rounded-lg border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama Penyakit</TableHead>
                        <TableHead>SNOMED-CT</TableHead>
                        <TableHead>Prioritas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentSavedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Belum ada data ICD-10 yang disimpan.
                          </TableCell>
                        </TableRow>
                      ) : currentSavedData.map((item: ICD10Data | ICD9Data, index: number) => {
                        const icd10Item = item as ICD10Data;
                        return (
                        <TableRow key={icd10Item.kd_penyakit || icd10Item.id || index}>
                          <TableCell className="font-mono">{icd10Item.kd_penyakit}</TableCell>
                          <TableCell>{icd10Item.nm_penyakit}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-mono">{icd10Item.snomed_concept_id || '-'}</div>
                              <div className="text-muted-foreground">{icd10Item.snomed_term || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {icd10Item.prioritas}
                          </TableCell>
                          <TableCell>{icd10Item.status_layanan}</TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteSaved('icd10', icd10Item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="icd9" className="space-y-4">
                {loadingSavedData && (
                  <div className="text-sm text-muted-foreground">Memuat data ICD-9...</div>
                )}
                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3 hidden border-b pb-3 text-sm font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1.7fr)_150px_minmax(0,1.7fr)_140px_140px] md:gap-3">
                    <div>Cari ICD-9-CM</div>
                    <div>Prioritas</div>
                    <div>Cari SNOMED-CT</div>
                    <div>Status</div>
                    <div>Aksi</div>
                  </div>
                  <div className="space-y-3">
                    {renderIcdDraftRows('icd9')}
                  </div>
                </div>

                <div className="space-y-3 md:hidden">
                  {renderSavedDataCards('icd9')}
                </div>

                <div className="hidden rounded-lg border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Deskripsi Pendek</TableHead>
                        <TableHead>SNOMED-CT</TableHead>
                        <TableHead>Prioritas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentSavedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Belum ada data ICD-9 yang disimpan.
                          </TableCell>
                        </TableRow>
                      ) : currentSavedData.map((item: ICD10Data | ICD9Data, index: number) => {
                        const icd9Item = item as ICD9Data;
                        return (
                        <TableRow key={icd9Item.kode || icd9Item.id || index}>
                          <TableCell className="font-mono">{formatIcd9ProcedureCode(icd9Item.kode)}</TableCell>
                          <TableCell>{icd9Item.deskripsi_pendek}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-mono">{icd9Item.snomed_concept_id || '-'}</div>
                              <div className="text-muted-foreground">{icd9Item.snomed_term || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell>{icd9Item.prioritas}</TableCell>
                          <TableCell>{icd9Item.status_layanan}</TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteSaved('icd9', icd9Item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <InacbgTariffSimulationDialog
        open={showTariffModal}
        onOpenChange={setShowTariffModal}
        noRawat={noRawat}
        defaultStatusRawat={fallbackStatusLayanan}
      />
    </>
  );
};
