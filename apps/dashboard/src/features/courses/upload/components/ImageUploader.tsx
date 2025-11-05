import React, { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ProgressBar from '@/components/ui/ProgressBar';
import courseServices from '@/features/courses/services'; // adjust path if needed
// Importing Lucide icons for a professional, clean interface
import { UploadCloud, XCircle, RefreshCw, Trash2 } from 'lucide-react'; 

interface ImageUploadProps {
  onFileSelect: (file: File) => void; // Parent will handle file selection state
  uploadCourseId?: string;           // optional: if provided, uploader will POST to course thumbnail route
  onUploadComplete?: (res: any) => void; // server response
  maxFileSizeMB?: number;
}

const DEFAULT_MAX_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ImageUploader: React.FC<ImageUploadProps> = ({
  onFileSelect,
  uploadCourseId,
  onUploadComplete,
  maxFileSizeMB = DEFAULT_MAX_MB,
}) => {
  const [imageDetails, setImageDetails] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null });
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    // Cleanup function to revoke the object URL when the component unmounts or preview changes
    return () => {
      if (imageDetails.preview) URL.revokeObjectURL(imageDetails.preview);
    };
  }, [imageDetails.preview]);

  const handleUploadToServer = async (file: File) => {
    if (!uploadCourseId) return null;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await courseServices.uploadCourseThumbnail(file, uploadCourseId, (pct: number) => {
        setUploadProgress(pct);
      }, 'admin');
      setUploadProgress(100);
      setIsUploading(false);
      if (typeof onUploadComplete === 'function') onUploadComplete(res);
      return res;
    } catch (err: any) {
      setIsUploading(false);
      setError(err?.message || 'Upload failed');
      console.error('uploadCourseThumbnail error', err);
      throw err;
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Invalid file type. Please upload JPG, PNG, GIF, or WEBP.');
      return;
    }
    if (f.size > maxFileSizeMB * 1024 * 1024) {
      setError(`File is too large. Max size is ${maxFileSizeMB}MB.`);
      return;
    }
    setError(null);
    const previewURL = URL.createObjectURL(f);
    setImageDetails({ file: f, preview: previewURL });
    onFileSelect(f);

    // If uploadCourseId provided, upload immediately
    if (uploadCourseId) {
      try {
        await handleUploadToServer(f);
      } catch {
        // error already set in handler
      }
    }
  };
  
  // Utility function to clear the selected file
  const removeImage = () => {
      if (imageDetails.preview) {
        URL.revokeObjectURL(imageDetails.preview);
      }
      setImageDetails({ file: null, preview: null });
      onFileSelect(null as any); // Clear file selection in parent
      setError(null);
      setIsUploading(false);
      setUploadProgress(0);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    multiple: false,
  });

  return (
    <div className="w-full">
      {/* 1. Dropzone Area - Styled with smooth transitions and shadow */}
      <div
        {...getRootProps()}
        className={`
          flex flex-col items-center justify-center 
          border-2 rounded-xl p-8 transition-all duration-300 min-h-[150px]
          ${imageDetails.file ? 'border-dashed border-green-500 hover:bg-green-50' : 'border-dashed'}
          ${isDragActive 
            ? 'border-blue-600 bg-blue-50/50 scale-[1.02]' 
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          } 
          cursor-pointer shadow-sm
        `}
      >
        <input {...getInputProps()} />
        
        {/* Professional Icon */}
        <UploadCloud className="w-10 h-10 text-indigo-500 mb-2" />
        
        <p className="text-gray-700 text-center font-semibold">
          {isDragActive ? 'Drop image to upload' : 'Click to Browse or Drag & Drop'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {ALLOWED_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')} | Max size: {maxFileSizeMB} MB
        </p>
      </div>

      {/* 2. Error Message - Styled as a distinct alert box */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mt-3 text-sm font-medium border border-red-200">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
        </div>
      )}

      {/* 3. Selected File Preview & Actions - Styled as an elevated card */}
      {imageDetails.file && !error && (
        <div className="mt-6 p-4 bg-white rounded-xl shadow-md ring-1 ring-gray-100 transition duration-300 hover:shadow-xl">
          <div className="flex justify-between items-start mb-3 border-b pb-2">
            <h3 className="text-lg font-semibold text-gray-800">Selected File:</h3>
            <button
                type="button"
                onClick={removeImage}
                className="text-red-500 hover:text-red-700 transition duration-150 p-1 rounded-full hover:bg-red-50"
                title="Remove image"
            >
                <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Image Preview Container */}
            <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 shadow-md">
                {imageDetails.preview && (
                    <img 
                        src={imageDetails.preview} 
                        alt="Selected Preview" 
                        className="w-full h-full object-cover" 
                    />
                )}
            </div>

            {/* File Details and Progress */}
            <div className="flex-grow w-full min-w-0">
                <p className="text-gray-800 w-full text-sm truncate font-medium mb-1">{imageDetails.file.name}</p>
                <p className="text-sm text-gray-500">
                    Size: {(imageDetails.file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {/* Conditional Upload/Progress */}
                {isUploading && (
                    <div className="mt-3">
                      <ProgressBar value={uploadProgress} label="Uploading..." />
                    </div>
                )}

                {!isUploading && uploadCourseId && (
                    <div className="mt-4">
                      <button
                        type="button"
                        className="
                          px-4 py-2 rounded-lg 
                          bg-indigo-600 text-white font-semibold 
                          hover:bg-indigo-700 
                          transition duration-150 shadow-md flex items-center gap-2 text-sm
                        "
                        onClick={() => imageDetails.file && handleUploadToServer(imageDetails.file)}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Re-upload Thumbnail
                      </button>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;