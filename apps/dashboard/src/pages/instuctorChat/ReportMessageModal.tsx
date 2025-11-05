import React, { useState, useEffect } from 'react';
import { reportMessage } from './api'; // adjust path if your actions file lives elsewhere

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string | null;
  onReported?: (res?: any) => void;
}

export default function ReportMessageModal({ isOpen, onClose, messageId, onReported }: ReportMessageModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!messageId) return;
    if (!reason.trim()) {
      setError('Please provide a reason for reporting.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await reportMessage(messageId, reason.trim());
      setLoading(false);
      onReported?.(res);
      // lightweight UX fallback
      // you can swap with your toast system
      alert('Report submitted. Thank you.');
      onClose();
    } catch (err: any) {
      console.error('report error', err);
      setError(err?.message || 'Failed to submit report.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-2">Report message</h3>
        <p className="text-sm text-gray-600 mb-4">Please tell us why you are reporting this message. This helps moderators review the issue.</p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason (required)"
          className="w-full min-h-[120px] border rounded-md p-3 mb-3 text-sm resize-vertical"
        />

        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 rounded-md bg-primary text-white text-sm" disabled={loading}>
            {loading ? 'Reporting…' : 'Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
