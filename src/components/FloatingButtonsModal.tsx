import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from "@/components/ui/button";
import { 
  Code, 
  StickyNote, 
  FileText, 
  File, 
  ArrowRight, 
  Scissors,
  Plus,
  X,
  ChevronUp
} from 'lucide-react';
import { ICDModal } from './modals/ICDModal';
import { PatientNotesModal } from './modals/PatientNotesModal';
import { DigitalFilesModal } from './modals/DigitalFilesModal';
import { MedicalResumeModal } from './modals/MedicalResumeModal';
import { InternalReferralModal } from './modals/InternalReferralModal';
import { OperationReportModal } from './modals/OperationReportModal';

interface FloatingButtonsModalProps {
  noRawat: string;
  noRkmMedis?: string;
  defaultStatusRawat?: 'Ralan' | 'Ranap';
  onIcdDataChanged?: () => void;
}

export const FloatingButtonsModal: React.FC<FloatingButtonsModalProps> = ({
  noRawat,
  noRkmMedis,
  defaultStatusRawat = 'Ralan',
  onIcdDataChanged
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const buttons = [
    {
      id: 'icd',
      label: 'ICD Management',
      icon: Code,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'notes',
      label: 'Catatan Pasien',
      icon: StickyNote,
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      id: 'files',
      label: 'Berkas Digital',
      icon: File,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      id: 'resume',
      label: 'Resume Medis',
      icon: FileText,
      color: 'bg-indigo-500 hover:bg-indigo-600'
    },
    {
      id: 'referral',
      label: 'Rujukan Internal',
      icon: ArrowRight,
      color: 'bg-orange-500 hover:bg-orange-600'
    },
    {
      id: 'operation',
      label: 'Laporan Operasi',
      icon: Scissors,
      color: 'bg-red-500 hover:bg-red-600'
    }
  ];

  const closeModal = () => setActiveModal(null);

  const handleMenuItemClick = (buttonId: string) => {
    setActiveModal(buttonId);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 240);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* Floating Action Button Group - Rendered via Portal */}
      {createPortal(
        <>
          {showScrollToTop && (
            <div className="fixed bottom-6 left-6 z-[9999]">
              <Button
                type="button"
                onClick={handleScrollToTop}
                className="h-12 w-12 rounded-full bg-red-600 text-white shadow-lg transition-all duration-300 hover:bg-red-700 hover:shadow-xl"
                size="icon"
                aria-label="Scroll ke atas"
              >
                <ChevronUp className="h-5 w-5" />
              </Button>
            </div>
          )}

          <div className="fixed bottom-6 right-6 z-[9999]">
            {/* Drop-up Menu */}
            {isMenuOpen && (
              <div className="absolute bottom-16 right-0 mb-2 flex flex-col items-end gap-2 animate-scale-in">
                {buttons.map((button, index) => {
                  const IconComponent = button.icon;
                  return (
                    <div
                      key={button.id}
                      className="flex items-center gap-3 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="whitespace-nowrap rounded-lg border bg-background px-3 py-1 text-sm text-foreground shadow-md">
                        {button.label}
                      </span>
                      <Button
                        onClick={() => handleMenuItemClick(button.id)}
                        className={`${button.color} flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:shadow-xl`}
                        size="sm"
                      >
                        <IconComponent className="h-5 w-5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Main FAB Button */}
            <Button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:bg-primary/90 hover:shadow-xl"
              size="sm"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6 transition-transform duration-200" />
              ) : (
                <Plus className="h-6 w-6 transition-transform duration-200" />
              )}
            </Button>
          </div>
        </>,
        document.body
      )}

      {/* Modals */}
      <ICDModal 
        isOpen={activeModal === 'icd'} 
        onClose={closeModal}
        noRawat={noRawat}
        defaultStatusLayanan={defaultStatusRawat}
        onDataChanged={onIcdDataChanged}
      />
      <PatientNotesModal 
        isOpen={activeModal === 'notes'} 
        onClose={closeModal}
        noRawat={noRawat}
        noRkmMedis={noRkmMedis}
      />
      <DigitalFilesModal 
        isOpen={activeModal === 'files'} 
        onClose={closeModal}
        noRawat={noRawat}
      />
      <MedicalResumeModal 
        isOpen={activeModal === 'resume'} 
        onClose={closeModal}
        noRawat={noRawat}
        defaultStatusRawat={defaultStatusRawat}
      />
      <InternalReferralModal 
        isOpen={activeModal === 'referral'} 
        onClose={closeModal}
        noRawat={noRawat}
      />
      <OperationReportModal 
        isOpen={activeModal === 'operation'} 
        onClose={closeModal}
        noRawat={noRawat}
      />
    </>
  );
};
