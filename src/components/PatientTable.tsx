import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleCheck, Clock, User } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { PaginationControls } from '@/components/PaginationControls';
import { StatusPill } from '@/components/StatusPill';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { dispatchOpenMedicalRecordTab } from '@/lib/medical-record-tabs';
import { buildMedicalRecordVisitUrl, normalizeMedicalRecordVisitNoRawat } from '@/lib/medical-record-url';
import { formatUIDate, formatUIDateTime } from '@/lib/date-utils';


interface Patient {
  id: number | string;
  name: string;
  visits?: number;
  status?: string;
  [key: string]: any; // Allow any additional properties
}

interface Column {
  accessor: string;
  header: string;
  render?: (row: any) => React.ReactNode;
}

interface RowMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: (row: Patient) => void;
}

interface PatientTableProps {
  title?: string;
  patients: Patient[];
  type?: 'active' | 'queue';
  columns?: Array<Column>;
  loading?: boolean;
  getRowClassName?: (row: Patient) => string;
  getRowMenuItems?: (row: Patient) => RowMenuItem[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (itemsPerPage: number) => void;
  };
}

type SortDirection = 'asc' | 'desc';

const PatientTable: React.FC<PatientTableProps> = ({ 
  title, 
  patients, 
  type = 'active',
  columns,
  loading = false,
  getRowClassName,
  getRowMenuItems,
  pagination
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeRowMenuKey, setActiveRowMenuKey] = useState<string | null>(null);
  
  // Helper function to decode no_rawat from encoded format
  const decodeNoRawat = (encodedNoRawat: string) => {
    if (!encodedNoRawat) return '';
    return encodedNoRawat.replace(/(\d{4})(\d{2})(\d{2})(\d+)/, '$1/$2/$3/$4');
  };

  const handleRowClick = (patient: any) => {
    if (patient.no_rkm_medis && patient.no_rawat) {
      const compactNoRawat = normalizeMedicalRecordVisitNoRawat(String(patient.no_rawat));

      if (location.pathname.startsWith('/pasien')) {
        dispatchOpenMedicalRecordTab({
          noRkmMedis: String(patient.no_rkm_medis),
          noRawat: compactNoRawat,
          patientName: String(patient.name || patient.nm_pasien || '').trim(),
          sourcePath: `${location.pathname}${location.search}`
        });
        return;
      }

      navigate(buildMedicalRecordVisitUrl(String(patient.no_rkm_medis), compactNoRawat), {
        state: {
          from: `${location.pathname}${location.search}`
        }
      });
    }
  };
  
  // If patients is passed as 'data' prop from older code
  const patientData = Array.isArray(patients) ? patients : [];
  
  // Use local pagination only if external pagination is not provided
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const normalizeSortValue = (accessor: string, rawValue: any) => {
    if (rawValue === null || rawValue === undefined) {
      return '';
    }

    if (typeof rawValue === 'number') {
      return rawValue;
    }

    if (rawValue instanceof Date) {
      return rawValue.getTime();
    }

    const normalizedText = String(rawValue).trim();
    if (!normalizedText) {
      return '';
    }

    const parsedNumeric = Number(normalizedText.replace(/,/g, '.'));
    if (Number.isFinite(parsedNumeric) && /^[0-9.,-]+$/.test(normalizedText)) {
      return parsedNumeric;
    }

    const formattedDate = formatPotentialDateValue(accessor, normalizedText);
    if (formattedDate) {
      const parsed = Date.parse(normalizedText.replace(' ', 'T'));
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return normalizedText.toLowerCase();
  };

  const resolveSortValue = (row: any, accessor: string) => {
    if (!accessor) {
      return '';
    }
    return normalizeSortValue(accessor, row?.[accessor]);
  };

  const toggleSort = (accessor: string) => {
    if (!accessor) {
      return;
    }

    setSortKey((prev) => {
      if (prev !== accessor) {
        setSortDirection('asc');
        return accessor;
      }

      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return prev;
    });
  };

  const getSortIcon = (accessor: string) => {
    if (!accessor || sortKey !== accessor) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    }

    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const sortedPatientData = useMemo(() => {
    if (!sortKey) {
      return patientData;
    }

    const rowsWithIndex = patientData.map((row, index) => ({ row, index }));
    rowsWithIndex.sort((left, right) => {
      const leftValue = resolveSortValue(left.row, sortKey);
      const rightValue = resolveSortValue(right.row, sortKey);

      if (leftValue === rightValue) {
        return left.index - right.index;
      }

      if (leftValue === '') {
        return 1;
      }

      if (rightValue === '') {
        return -1;
      }

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      const leftText = String(leftValue);
      const rightText = String(rightValue);
      return sortDirection === 'asc'
        ? leftText.localeCompare(rightText, 'id')
        : rightText.localeCompare(leftText, 'id');
    });

    return rowsWithIndex.map((item) => item.row);
  }, [patientData, sortDirection, sortKey]);

  // If external pagination is provided, use all data; otherwise use local pagination
  const displayData = pagination
    ? sortedPatientData
    : sortedPatientData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = pagination ? pagination.totalPages : Math.ceil(sortedPatientData.length / itemsPerPage);

  // Simple pagination helper
  const getVisiblePages = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 3);
    const end = Math.min(totalPages, currentPage + 3);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };
  
  const getStatusPillTone = (status: string) => {
    switch (String(status || '').trim()) {
      case 'Sudah':
      case 'Diterima':
      case 'Dirawat':
        return 'green' as const;
      case 'Belum':
      case 'Menunggu':
        return 'amber' as const;
      case 'Ditolak':
      case 'Meninggal':
        return 'red' as const;
      case 'Batal':
      case 'Dirujuk':
      case 'Pulang Paksa':
        return 'slate' as const;
      default:
        return 'blue' as const;
    }
  };

  const getRowMenuKey = (patient: Patient, fallbackIndex?: number) => (
    String(patient.id || patient.no_rawat || patient.no_rkm_medis || fallbackIndex || '')
  );

  const getMenuItemsForRow = (patient: Patient) => (
    Array.isArray(getRowMenuItems?.(patient)) ? getRowMenuItems?.(patient) || [] : []
  );

  const renderRowMenuHint = (patient: Patient) => {
    if (!getMenuItemsForRow(patient).length) {
      return null;
    }

    return (
      <span className="text-[11px] font-normal text-primary/80 dark:text-primary/70">
        Klik untuk menu
      </span>
    );
  };

  const renderTableRow = (
    patient: Patient,
    rowContent: React.ReactElement,
    fallbackIndex?: number
  ) => {
    const menuItems = getMenuItemsForRow(patient);
    if (!menuItems.length) {
      return rowContent;
    }

    const rowMenuKey = getRowMenuKey(patient, fallbackIndex);
    const triggerRow = React.cloneElement(rowContent, {
      className: cn(
        rowContent.props.className,
        activeRowMenuKey === rowMenuKey
          ? "bg-primary/10 ring-1 ring-inset ring-primary/20 hover:bg-primary/10 dark:bg-primary/15 dark:hover:bg-primary/15"
          : ""
      ),
      onClick: (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (typeof window === 'undefined') {
          return;
        }

        (event.currentTarget as HTMLElement).dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: event.clientX,
            clientY: event.clientY,
            button: 2,
            buttons: 2
          })
        );
      }
    });

    return (
      <ContextMenu
        key={`context-menu-${rowMenuKey}`}
        onOpenChange={(open) => {
          setActiveRowMenuKey((current) => {
            if (open) {
              return rowMenuKey;
            }

            return current === rowMenuKey ? null : current;
          });
        }}
      >
        <ContextMenuTrigger asChild>
          {triggerRow}
        </ContextMenuTrigger>
        <ContextMenuContent className="z-20 min-w-[220px]">
          {menuItems.map((item) => (
            <ContextMenuItem
              key={`${rowMenuKey}-${item.key}`}
              className="flex items-center gap-2"
              onSelect={() => item.onSelect(patient)}
            >
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <span>{item.label}</span>
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const getPaymentStatusPillTone = (status: string) => {
    switch (String(status || '').trim()) {
      case 'Sudah Bayar':
        return 'green' as const;
      case 'Belum Bayar':
        return 'red' as const;
      default:
        return 'slate' as const;
    }
  };

  function formatPotentialDateValue(accessor: string, value: any) {
    const accessorLower = String(accessor || '').toLowerCase();
    const shouldConsiderDate =
      accessorLower.includes('tgl') ||
      accessorLower.includes('tanggal') ||
      accessorLower.includes('waktu') ||
      accessorLower.includes('date');

    if (!shouldConsiderDate) {
      return null;
    }

    if (value instanceof Date || typeof value === 'number') {
      return accessorLower.includes('jam') || accessorLower.includes('time') || accessorLower.includes('waktu')
        ? formatUIDateTime(value)
        : formatUIDate(value);
    }

    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return null;
    }

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
    const isDateTime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(normalized);

    if (isDateTime) {
      return formatUIDateTime(normalized);
    }

    if (isDateOnly) {
      return formatUIDate(normalized);
    }

    return null;
  }
  
  // Handle the case when simple view is used (with type and without columns)
  const renderSimpleView = () => {
    const shouldShowLoadingState = loading && displayData.length === 0;

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-2"
                  onClick={() => toggleSort('id')}
                >
                  <span>No</span>
                  {getSortIcon('id')}
                </button>
              </TableHead>
              <TableHead className="font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-2"
                  onClick={() => toggleSort('name')}
                >
                  <span>Nama {isMobile ? '' : 'Lengkap'}</span>
                  {getSortIcon('name')}
                </button>
              </TableHead>
              {type === 'active' ? (
                <TableHead className="font-medium text-right sm:text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort('visits')}
                  >
                    <span>Kunj</span>
                    {getSortIcon('visits')}
                  </button>
                </TableHead>
              ) : (
                <TableHead className="font-medium text-right sm:text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort('status')}
                  >
                    <span>Status</span>
                    {getSortIcon('status')}
                  </button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shouldShowLoadingState ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center italic text-slate-500 dark:text-slate-400">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : displayData.length > 0 ? (
              displayData.map((patient, rowIndex) => renderTableRow(
                patient,
                <TableRow
                  key={patient.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
                  onClick={() => {
                    if (!getMenuItemsForRow(patient).length) {
                      handleRowClick(patient);
                    }
                  }}
                >
                  <TableCell className="py-2 px-2 sm:py-3 sm:px-4">{patient.id}</TableCell>
                  <TableCell className="py-2 px-2 sm:py-3 sm:px-4">
                    <div className="flex items-center">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:h-8 sm:w-8">
                        <User size={isMobile ? 14 : 16} />
                      </div>
                      <div className={cn(
                        "ml-2 font-medium text-slate-900 dark:text-slate-100 sm:ml-4",
                        isMobile ? "text-xs sm:text-sm max-w-[120px] truncate" : ""
                      )}>
                        <div className="flex flex-col gap-0.5">
                          <span>{patient.name}</span>
                          {renderRowMenuHint(patient)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {type === 'active' ? (
                    <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-right sm:text-left">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/15 dark:text-green-300">
                        {patient.visits}
                      </span>
                    </TableCell>
                  ) : (
                    <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-right sm:text-left">
                      <StatusPill
                        tone={getStatusPillTone(patient.status || '')}
                        label={
                          <>
                            {patient.status === 'Menunggu' ? <Clock size={12} className="mr-1" /> : <CircleCheck size={12} className="mr-1" />}
                            {patient.status}
                          </>
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>,
                rowIndex
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center italic text-slate-500 dark:text-slate-400">
                  Tidak ada data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  // Handle the case when columns are provided (for complex tables)
  const renderColumnsView = () => {
    if (!columns) return renderSimpleView();
    const shouldShowLoadingState = loading && displayData.length === 0;
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index} className="font-medium whitespace-nowrap">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-2",
                      column.accessor ? "cursor-pointer" : "cursor-default"
                    )}
                    onClick={() => toggleSort(column.accessor)}
                    disabled={!column.accessor}
                  >
                    <span>{column.header}</span>
                    {column.accessor ? getSortIcon(column.accessor) : null}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shouldShowLoadingState ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center italic text-slate-500 dark:text-slate-400">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : displayData.length > 0 ? (
              displayData.map((patient, rowIndex) => renderTableRow(
                patient,
                <TableRow
                  key={patient.id || rowIndex}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70",
                    getRowClassName ? getRowClassName(patient) : ""
                  )}
                  onClick={() => {
                    if (!getMenuItemsForRow(patient).length) {
                      handleRowClick(patient);
                    }
                  }}
                >
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex} className="py-2 px-2 sm:py-3 sm:px-4 whitespace-nowrap">
                      {column.render ? (
                        column.render(patient)
                      ) : column.accessor === 'nama' || column.accessor === 'name' ? (
                        <div className="flex items-center">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:h-8 sm:w-8">
                            <User size={isMobile ? 14 : 16} />
                          </div>
                          <div className={cn(
                            "ml-2 font-medium text-slate-900 dark:text-slate-100 sm:ml-4",
                            isMobile ? "text-xs sm:text-sm max-w-[120px] truncate" : ""
                          )}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>{patient[column.accessor]}</span>
                              {(String(patient.prb || '').trim() || String(patient.prb_program || '').trim()) ? (
                                <p
                                  className="text-xs font-normal text-amber-700 dark:text-amber-400"
                                  title={[patient.prb, patient.prb_program].filter(Boolean).join(', ')}
                                >
                                  ({[patient.prb, patient.prb_program].filter(Boolean).join(', ')})
                                </p>
                              ) : null}
                            </div>
                            {renderRowMenuHint(patient)}
                          </div>
                        </div>
                      ) : column.accessor === 'status' ? (
                        <StatusPill
                          tone={getStatusPillTone(String(patient[column.accessor] || ''))}
                          label={patient[column.accessor]}
                        />
                      ) : column.accessor === 'paymentStatus' ? (
                        <StatusPill
                          tone={getPaymentStatusPillTone(String(patient[column.accessor] || ''))}
                          label={patient[column.accessor]}
                        />
                      ) : column.accessor === 'tanggal' || column.accessor === 'tanggal_booking' ? (
                        formatUIDate(patient[column.accessor])
                      ) : (
                        formatPotentialDateValue(column.accessor, patient[column.accessor]) ?? patient[column.accessor]
                      )}
                    </TableCell>
                  ))}
                </TableRow>,
                rowIndex
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center italic text-slate-500 dark:text-slate-400">
                  Tidak ada data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  return (
    // <div className="bg-white rounded-xl shadow-md overflow-hidden h-full hover:shadow-lg transition-shadow duration-300">
        <div className="p-0 sm:p-0">
          {title && <h2 className="mb-3 text-lg font-bold text-slate-800 dark:text-slate-100 sm:mb-6 sm:text-xl">{title}</h2>}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800">
            {columns ? renderColumnsView() : renderSimpleView()}
          </div>
          
          {/* Pagination Controls */}
          {pagination ? (
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={pagination.onPageChange}
              onItemsPerPageChange={pagination.onItemsPerPageChange}
              loading={loading}
            />
          ) : totalPages > 1 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, patientData.length)} dari {patientData.length} data
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    Sebelumnya
                  </button>
                  {getVisiblePages().map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded border px-3 py-1 text-sm dark:border-slate-700 ${
                        currentPage === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted dark:bg-slate-900 dark:hover:bg-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      // </div>
  );
};

export default PatientTable;
