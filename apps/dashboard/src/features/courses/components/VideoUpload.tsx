import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation } from 'react-router-dom';
import VideoPopup from "./VideoPopup";

interface VideoUploadProps {
  onFileSelect: (file: File) => void;
  onAddPopup: (link: string, popupDuration: number, triggerAt: number) => void;
}

const MAX_FILE_SIZE_MB = 10000;
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/mkv', 'video/quicktime'];

const VideoUpload = ({ onFileSelect, onAddPopup }: VideoUploadProps) => {
  const [videoDetails, setVideoDetails] = useState({
    file: null as File | null,
    preview: null as string | null,
    duration: null as number | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const location = useLocation();
  const isEditPage = location.pathname.includes('/edit'); // Detect if on an edit page

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      return setError('Invalid file type. Please upload MP4, WebM, MKV, or OGG.');
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return setError(`File is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
    }

    setError(null);
    const previewURL = URL.createObjectURL(file);
    onFileSelect(file)
    setVideoDetails({ file, preview: previewURL, duration: null });
    extractVideoDuration(previewURL);
    handleUpload(file);
  };

  const extractVideoDuration = (previewURL: string) => {
    const videoElement = document.createElement('video');
    videoElement.src = previewURL;
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => {
      if (videoElement.duration === Infinity) {
        videoElement.currentTime = 999999;
        videoElement.ontimeupdate = () => {
          videoElement.ontimeupdate = null;
          setVideoDetails((prev) => ({ ...prev, duration: videoElement.currentTime }));
        };
      } else {
        setVideoDetails((prev) => ({ ...prev, duration: videoElement.duration }));
      }
    };
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    multiple: false,
  });

  const handleUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsUploading(false);
      }
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (videoDetails.preview) URL.revokeObjectURL(videoDetails.preview);
    };
  }, [videoDetails.preview]);

  return (
    <div className="max-w-lg mx-auto">
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 transition ${
          isDragActive ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-gray-50'
        } cursor-pointer`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-700 text-center">
          {isDragActive ? 'Drop the video here...' : 'Drag & drop a video, or click to browse'}
        </p>
      </div>

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      {videoDetails.file && !error && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Selected Video:</h3>
          {/* {videoDetails.preview && (
            <video src={videoDetails.preview} className="w-full rounded-md mb-3" controls />
          )} */}
          <p className="text-gray-600 text-sm break-all">
            {videoDetails.file.name} ({(videoDetails.file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
          {videoDetails.duration !== null && !isUploading && (
            <div className="text-gray-600 text-sm mt-2">
              <p>Duration: {`${Math.floor(videoDetails.duration / 60).toString().padStart(2, '0')}:${Math.floor(videoDetails.duration % 60).toString().padStart(2, '0')}`}</p>
            </div>
          )}
          {isUploading && (
            <div className="mt-3 w-full bg-gray-200 rounded h-3 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
          {/* Only show the VideoPopup if not on the edit page */}
          {videoDetails.duration !== null && !isUploading && (
            <VideoPopup
              videoDuration={videoDetails.duration}
              onAddPopup={onAddPopup}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
