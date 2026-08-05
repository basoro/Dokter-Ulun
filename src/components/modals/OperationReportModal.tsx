import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Scissors, Calendar, Loader2, Upload, FileImage, FileText, ExternalLink, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { DatePickerPopover } from "@/components/DatePickerPopover";
import { StatusPill } from "@/components/StatusPill";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { formatUIDate } from "@/lib/date-utils";

interface OperationReport {
  id?: number;
  no_rawat: string;
  kd_dokter: string;
  tanggal_op: string;
  hasil_op: string;
  pre_op: string;
  post_op: string;
  implan: string;
  kirim_pa: 'Ya' | 'Tidak';
  nm_op: string;
  created_at?: string;
  dokter_laporan?: string;
  dokter_operator?: string;
  dokter_anestesi?: string;
}

interface OperationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

interface OperationReportDigitalFile {
  id?: string;
  kode?: string;
  nama_berkas?: string;
  no_rawat?: string;
  lokasi_file?: string;
  nama_file: string;
  tipe_file: string;
  url?: string;
  can_delete?: boolean;
}

const getCurrentOperationDateTime = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ACCEPTED_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.pdf';

export const OperationReportModal: React.FC<OperationReportModalProps> = ({ isOpen, onClose, noRawat }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<OperationReport[]>([]);
  const [digitalFiles, setDigitalFiles] = useState<OperationReportDigitalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [digitalFilesLoading, setDigitalFilesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState('');
  const [editingItem, setEditingItem] = useState<OperationReport | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<OperationReport>({
    id: undefined,
    no_rawat: noRawat,
    kd_dokter: user?.kd_dokter || user?.username || '',
    tanggal_op: getCurrentOperationDateTime(),
    hasil_op: '',
    pre_op: '',
    post_op: '',
    implan: '',
    kirim_pa: 'Tidak',
    nm_op: '',
    created_at: '',
  });
  const { toast } = useToast();

  const getTanggalOperasiDate = (value: string) => {
    if (!value) return undefined;

    const normalized = value.includes('T') ? value : `${value.replace(' ', 'T').slice(0, 16)}`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const getTanggalOperasiTime = (value: string) => {
    if (!value) return '00:00';

    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const timePart = normalized.split('T')[1] || '';
    const matched = timePart.match(/^(\d{2}:\d{2})/);
    return matched?.[1] || '00:00';
  };

  const buildTanggalOperasiValue = (date: Date, timeValue: string) => {
    const safeTime = /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : '00:00';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}T${safeTime}`;
  };

  const handleTanggalOperasiSelect = (selectedDate?: Date) => {
    if (!selectedDate) return;

    const nextDate = new Date(selectedDate);
    const currentTime = getTanggalOperasiTime(formData.tanggal_op);

    setFormData((prev) => ({
      ...prev,
      tanggal_op: buildTanggalOperasiValue(nextDate, currentTime)
    }));
  };

  const handleTanggalOperasiTimeChange = (timeValue: string) => {
    const currentDate = getTanggalOperasiDate(formData.tanggal_op) || new Date();

    setFormData((prev) => ({
      ...prev,
      tanggal_op: buildTanggalOperasiValue(currentDate, timeValue)
    }));
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
      fetchDigitalFiles();
    }
  }, [isOpen, noRawat]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, no_rawat: noRawat }));
  }, [noRawat]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      kd_dokter: prev.kd_dokter || user?.kd_dokter || user?.username || '',
    }));
  }, [user]);

  const fetchReports = async () => {
    if (!noRawat) {
      setReports([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URLS.OPERATION_REPORTS}/${encodeURIComponent(noRawat)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat laporan operasi');
      }

      setReports(result.data || []);
    } catch (error) {
      console.error('Error fetching operation reports:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memuat laporan operasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDigitalFiles = async () => {
    if (!noRawat) {
      setDigitalFiles([]);
      return;
    }

    setDigitalFilesLoading(true);
    try {
      const params = new URLSearchParams();
      if (user?.kd_dokter || user?.username) {
        params.set('username', String(user?.kd_dokter || user?.username || ''));
      }

      const response = await fetch(
        `${API_URLS.OPERATION_REPORT_DIGITAL_FILES}/${encodeURIComponent(noRawat)}/files${params.toString() ? `?${params.toString()}` : ''}`,
        { credentials: 'include' }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat berkas digital laporan operasi');
      }

      setDigitalFiles(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching operation report digital files:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memuat berkas digital laporan operasi",
        variant: "destructive",
      });
    } finally {
      setDigitalFilesLoading(false);
    }
  };

  const getDigitalFileIcon = (tipeFile: string) => {
    if (String(tipeFile || '').startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-blue-500" />;
    }

    return <FileText className="h-5 w-5 text-slate-500" />;
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []);

    if (!nextFiles.length) {
      setSelectedUploadFiles([]);
      return;
    }

    const validFiles: File[] = [];
    const invalidMessages: string[] = [];

    nextFiles.forEach((file) => {
      const mimeType = String(file.type || '').toLowerCase();

      if (!ACCEPTED_FILE_TYPES.includes(mimeType)) {
        invalidMessages.push(`${file.name}: format tidak didukung`);
        return;
      }

      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        invalidMessages.push(`${file.name}: ukuran file maksimal 5 MB`);
        return;
      }

      validFiles.push(file);
    });

    setSelectedUploadFiles(validFiles);

    if (invalidMessages.length) {
      toast({
        title: "Sebagian file tidak valid",
        description: invalidMessages.slice(0, 3).join(' | '),
        variant: "destructive",
      });
    }
  };

  const handleUploadDigitalFiles = async () => {
    if (!noRawat) {
      toast({
        title: "No. Rawat belum tersedia",
        description: "Kunjungan pasien tidak ditemukan.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedUploadFiles.length) {
      toast({
        title: "Belum ada file",
        description: "Pilih minimal satu file untuk di-upload.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('no_rawat', noRawat);
      selectedUploadFiles.forEach((file) => {
        uploadFormData.append('files', file);
      });

      const response = await fetch(API_URLS.OPERATION_REPORT_DIGITAL_FILES_UPLOAD, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include'
      });
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || result?.message || 'Upload berkas digital laporan operasi gagal');
      }

      await fetchDigitalFiles();
      setSelectedUploadFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: "Berhasil",
        description: result?.message || 'Berkas digital laporan operasi berhasil di-upload',
      });
    } catch (error) {
      console.error('Error uploading operation report digital files:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Upload berkas digital laporan operasi gagal",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteDigitalFile = async (file: OperationReportDigitalFile) => {
    if (!file?.lokasi_file || !file?.can_delete) {
      return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus berkas digital laporan operasi ini?')) {
      return;
    }

    setDeletingFileId(file.id || file.lokasi_file);
    try {
      const response = await fetch(`${API_URLS.OPERATION_REPORT_DIGITAL_FILES}/files`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          no_rawat: noRawat,
          lokasi_file: file.lokasi_file,
          username: user?.kd_dokter || user?.username || ''
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menghapus berkas digital laporan operasi');
      }

      await fetchDigitalFiles();
      toast({
        title: "Berhasil",
        description: "Berkas digital laporan operasi berhasil dihapus",
      });
    } catch (error) {
      console.error('Error deleting operation report digital file:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menghapus berkas digital laporan operasi",
        variant: "destructive",
      });
    } finally {
      setDeletingFileId('');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const requestBody = {
        ...formData,
        no_rawat: noRawat,
        kd_dokter: formData.kd_dokter || user?.kd_dokter || user?.username || '',
      };

      const response = await fetch(API_URLS.OPERATION_REPORTS, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menyimpan laporan operasi');
      }

      await fetchReports();
      if (editingItem) {
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil diperbarui",
        });
      } else {
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil ditambahkan",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menyimpan laporan operasi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: OperationReport) => {
    setEditingItem(item);
    setFormData({
      ...item,
      no_rawat: noRawat,
    });
    setShowForm(true);
  };

  const handleDelete = async (item: OperationReport) => {
    if (confirm('Apakah Anda yakin ingin menghapus laporan operasi ini?')) {
      try {
        setDeleting(true);
        const response = await fetch(API_URLS.OPERATION_REPORTS, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            no_rawat: noRawat,
            id: item.id,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Gagal menghapus laporan operasi');
        }

        await fetchReports();
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil dihapus",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Gagal menghapus laporan operasi",
          variant: "destructive",
        });
      } finally {
        setDeleting(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: undefined,
      no_rawat: noRawat,
      kd_dokter: user?.kd_dokter || user?.username || '',
      tanggal_op: getCurrentOperationDateTime(),
      hasil_op: '',
      pre_op: '',
      post_op: '',
      implan: '',
      kirim_pa: 'Tidak',
      nm_op: '',
      created_at: '',
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const getPaBadge = (permintaanPa: string) => (
    <StatusPill
      tone={permintaanPa === 'Ya' ? 'green' : 'slate'}
      label={permintaanPa === 'Ya' ? 'PA: Ya' : 'PA: Tidak'}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Laporan Operasi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Berkas Digital Laporan Operasi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="operation-report-digital-files">
                    Pilih Berkas <span className="text-xs text-muted-foreground">(JPG, JPEG, PNG, PDF maks. 5 MB)</span>
                  </Label>
                  <Input
                    id="operation-report-digital-files"
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_EXTENSIONS}
                    multiple
                    onChange={handleFileSelection}
                    disabled={uploadingFiles}
                  />
                </div>
                <Button onClick={handleUploadDigitalFiles} disabled={uploadingFiles || !selectedUploadFiles.length}>
                  {uploadingFiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload Berkas
                </Button>
              </div>

              {selectedUploadFiles.length > 0 ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="mb-2 text-sm font-medium">File terpilih</div>
                  <div className="space-y-2">
                    {selectedUploadFiles.map((file) => (
                      <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{file.name}</div>
                          <div className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedUploadFiles((previous) => previous.filter((item) => item !== file));
                          }}
                          disabled={uploadingFiles}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Berkas Tersimpan</div>
                  {digitalFilesLoading ? (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Memuat berkas...
                    </div>
                  ) : null}
                </div>

                {digitalFiles.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {digitalFiles.map((file) => {
                      const isImage = String(file.tipe_file || '').startsWith('image/');

                      return (
                        <div key={file.id || file.lokasi_file} className="overflow-hidden rounded-lg border bg-background">
                          <div className="flex aspect-video items-center justify-center bg-muted/30">
                            {isImage && file.url ? (
                              <img
                                src={file.url}
                                alt={file.nama_berkas || file.nama_file}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                {getDigitalFileIcon(file.tipe_file)}
                                <span className="text-xs">{file.nama_file}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-3 p-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{file.nama_berkas || file.nama_file}</div>
                              <div className="truncate text-xs text-muted-foreground">{file.nama_file}</div>
                              <div className="mt-1 break-all text-xs text-muted-foreground">{file.lokasi_file || '-'}</div>
                            </div>
                            <div className="flex gap-2">
                              {file.url ? (
                                <Button asChild size="sm" variant="outline" className="flex-1">
                                  <a href={file.url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Buka
                                  </a>
                                </Button>
                              ) : null}
                              {file.can_delete ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteDigitalFile(file)}
                                  disabled={deletingFileId === (file.id || file.lokasi_file)}
                                >
                                  {deletingFileId === (file.id || file.lokasi_file) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    Belum ada berkas digital laporan operasi untuk nomor rawat ini
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Button */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)} disabled={loading || saving}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Laporan
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? 'Edit Laporan Operasi' : 'Tambah Laporan Operasi'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal_operasi">Tanggal Operasi</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <DatePickerPopover
                        triggerId="tanggal_operasi"
                        mode="single"
                        selected={getTanggalOperasiDate(formData.tanggal_op)}
                        onSelect={handleTanggalOperasiSelect}
                        defaultMonth={getTanggalOperasiDate(formData.tanggal_op)}
                        locale={indonesianLocale}
                        placeholder="Pilih tanggal operasi"
                        displayValue={getTanggalOperasiDate(formData.tanggal_op)
                          ? formatUIDate(getTanggalOperasiDate(formData.tanggal_op) as Date)
                          : undefined}
                      />
                      <Input
                        type="time"
                        id="jam_operasi"
                        value={getTanggalOperasiTime(formData.tanggal_op)}
                        onChange={(e) => handleTanggalOperasiTimeChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="nm_op">Nama Operasi</Label>
                    <Input id="nm_op" value={formData.nm_op} onChange={(e) => setFormData(prev => ({ ...prev, nm_op: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="diagnosa_pre_operasi">Diagnosa Pre-Operasi</Label>
                    <Input
                      id="diagnosa_pre_operasi"
                      value={formData.pre_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, pre_op: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="diagnosa_post_operasi">Diagnosa Post-Operasi</Label>
                    <Input
                      id="diagnosa_post_operasi"
                      value={formData.post_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, post_op: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="implan">Implan</Label>
                    <Input
                      id="implan"
                      value={formData.implan}
                      onChange={(e) => setFormData(prev => ({ ...prev, implan: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="kirim_pa">Kirim PA</Label>
                    <select
                      id="kirim_pa"
                      value={formData.kirim_pa}
                      onChange={(e) => setFormData(prev => ({ ...prev, kirim_pa: e.target.value as 'Ya' | 'Tidak' }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="Tidak">Tidak</option>
                      <option value="Ya">Ya</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="hasil_operasi">Hasil Operasi</Label>
                    <Textarea
                      id="hasil_operasi"
                      value={formData.hasil_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasil_op: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Simpan
                  </Button>
                  <Button variant="outline" onClick={resetForm} disabled={saving}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reports List */}
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memuat laporan operasi...
              </div>
            ) : null}
            {reports.map((report) => (
              <Card key={report.id || `${report.no_rawat}-${report.tanggal_op}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {report.nm_op || report.post_op || report.pre_op || 'Laporan Operasi'} - {formatUIDate(report.tanggal_op)}
                    </div>
                    <div className="flex gap-2">
                      {getPaBadge(report.kirim_pa)}
                      <Button size="sm" variant="outline" onClick={() => handleEdit(report)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(report)} disabled={deleting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tanggal Operasi</p>
                      <p className="text-sm">{formatUIDate(report.tanggal_op)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nama Operasi</p>
                      <p className="text-sm">{report.nm_op || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dokter Operator</p>
                      <p className="text-sm">{report.dokter_operator || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Kirim PA</p>
                      <p className="text-sm">{report.kirim_pa}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dokter Anestesi</p>
                      <p className="text-sm">{report.dokter_anestesi || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa Pre-Operasi</p>
                      <p className="text-sm">{report.pre_op}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa Post-Operasi</p>
                      <p className="text-sm">{report.post_op}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Implan</p>
                      <p className="text-sm">{report.implan || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dokter Laporan</p>
                      <p className="text-sm">{report.dokter_laporan || '-'}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa</p>
                      <p className="text-sm">{report.pre_op} → {report.post_op}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-muted-foreground">Hasil Operasi</p>
                      <p className="text-sm whitespace-pre-line break-words">{report.hasil_op}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && reports.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada laporan operasi untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
