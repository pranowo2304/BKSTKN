import React from 'react';
import { DigitalSignaturePad, SignatureData } from './DigitalSignaturePad';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  initialSignature?: string;
  defaultSignerName?: string;
  defaultSignerTitle?: string;
  savedDefaultSignature?: string;
  receiptNumber?: string;
  memberName?: string;
  onSave: (data: SignatureData) => void;
  onClose: () => void;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  initialSignature,
  defaultSignerName,
  defaultSignerTitle,
  savedDefaultSignature,
  receiptNumber,
  memberName,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-xl my-auto">
        <DigitalSignaturePad
          initialSignature={initialSignature}
          defaultSignerName={defaultSignerName}
          defaultSignerTitle={defaultSignerTitle}
          savedDefaultSignature={savedDefaultSignature}
          onSave={onSave}
          onCancel={onClose}
          title="Tanda Tangan Digital Verifikasi Admin"
          subtitle={
            receiptNumber
              ? `Pengesahan resmi untuk Kwitansi No: ${receiptNumber} (${memberName || 'Warga Paguyuban'})`
              : 'Bubuhkan tanda tangan digital resmi untuk verifikasi transaksi kas warga.'
          }
        />
      </div>
    </div>
  );
};
