/**
 * QR Code Modal Component
 * Displays a QR code for a student's registration ID
 */

'use client';

import { useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeModalProps {
  registrationId: string;
  studentName: string;
  onClose: () => void;
}

export default function QRCodeModal({
  registrationId,
  studentName,
  onClose,
}: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        registrationId,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('QR Code generation error:', error);
        }
      );
    }
  }, [registrationId]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${registrationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Student QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {studentName}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Registration ID: {registrationId}
          </p>

          <div className="flex justify-center mb-4">
            <canvas ref={canvasRef} className="border-2 border-gray-200 rounded" />
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Scan this QR code with the mobile app to check in
          </p>

          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Download size={18} />
              <span>Download QR Code</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
