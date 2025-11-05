'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';
import { CiImageOn } from 'react-icons/ci';

interface UploadImageButtonProps {
  onFileSelected?: (file: File) => void;
  maxSizeBytes?: number;
  buttonLabel?: string;
  initialFileName?: string;
  initialPreviewUrl?: string;
}

export default function UploadImageButton({
  onFileSelected,
  maxSizeBytes = 5 * 1024 * 1024,
  buttonLabel = 'Upload Image',
  initialFileName,
  initialPreviewUrl,
}: UploadImageButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ref for the modal container
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Prevent default browser behavior for dropped files
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);

    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', preventDefault);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setErrorMsg(null);
      // Focus the modal container so that it can listen for Escape
      modalRef.current?.focus();
    }
  }, [isOpen]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      setErrorMsg(null);

      if (fileRejections.length > 0) {
        const firstRej = fileRejections[0];
        if (firstRej.errors.some((e: any) => e.code === 'file-too-large')) {
          setErrorMsg(`File is too large. Max ${(maxSizeBytes / 1024 / 1024).toFixed(1)} MB.`);
        } else {
          setErrorMsg('Invalid file type. Please select an image.');
        }
        return;
      }

      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      setSelectedFile(file);
      if (!file) {
        setErrorMsg('Please select an image first.');
        return;
      }
      onFileSelected?.(file);
    },
    [maxSizeBytes],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    maxSize: maxSizeBytes,
    multiple: false,
  });

  if (!isOpen) {
    const displayName =
    initialFileName && initialFileName.length > 10
      ? `${initialFileName.slice(0, 10)}...`
      : initialFileName;
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`px-2 border border-blue-400 whitespace-nowrap py-3 w-1/2 bg-white text-gray-500 rounded-lg hover:bg-gray-100 ${initialFileName && 'border font-semibold border-blue-400'}`}
      >
        {displayName ? (
          `${displayName}`
        ) : (
          <div className="  flex items-center justify-center gap-1">
            <CiImageOn size={20} />
            <span>{buttonLabel}</span>
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 flex items-center  justify-center z-50"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-[90vw] max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 border  text-gray-500 hover:text-gray-800"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold mb-4">Upload an Image</h2>

        <div
          {...getRootProps()}
          className={clsx(
            'flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
            {
              'border-blue-500 bg-blue-50': isDragActive,
              'border-gray-300 hover:border-blue-400 hover:bg-blue-50': !isDragActive,
            },
          )}
        >
          <input {...getInputProps()} className="hidden" />
          <p className="text-center text-gray-600">
            {isDragActive ? 'Drop the image here…' : 'Drag & drop an image here, or click to browse'}
          </p>
          <em className="mt-2 text-sm text-gray-400">
            (PNG, JPG, GIF, WEBP up to {(maxSizeBytes / 1024 / 1024).toFixed(1)} MB)
          </em>
        </div>

        {errorMsg && <p className="mt-2 text-sm text-red-500">{errorMsg}</p>}

        {selectedFile && (
          <div className="mt-4 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border border-gray-300">
              <img src={initialPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>

            <p className="mt-2 font-medium truncate w-[80%] text-center">{initialFileName}</p>
            <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              onClick={() => {
                setSelectedFile(null);
                setErrorMsg(null);
              }}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!selectedFile) {
                setErrorMsg('Please select an image first.');
                return;
              }
              onFileSelected?.(selectedFile);
              setIsOpen(false);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
