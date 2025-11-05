'use client';

import React from 'react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  title?: string;
  description?: string;
  
}  

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  title = 'Delete message',
  description = 'Are you sure you want to delete this message for everyone? This action cannot be undone.',
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
            type="button"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
            type="button"
            disabled={loading}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
