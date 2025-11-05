import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VideoUpload from '@/features/courses/components/VideoUpload';
import CourseEditStatus from '../../courses/components/CourseEditStatus';
// Assuming you have imported ProgressBar and LectureVideoPreview
import ProgressBar from '@/components/ui/ProgressBar'; 
// Assuming LectureVideoPreview is a utility component you defined
// import LectureVideoPreview from './LectureVideoPreview'; 

import {
  IChapterResponse,
  ILectureSaveResponse,
  IErrorResponse,
  ILecture,
  ILectureSaveRequest,
  ILectureVideoPopup,
} from '@elearning/types';
import { LectureSaveSchema } from '@elearning/schemas';
import chapterServices from '../services';
import queryClient from '@/lib/query-client';
import VideoPopupManager from '@/features/courses/components/EditPopups';

import { uploadSmallFile, uploadLargeFileMultipart } from '../../courses/uploadService'; // adjust path if needed

// --- Lecture Video Preview Component (Re-included for completeness) ---
interface LectureVideoPreviewProps {
  watchedVideo: string | undefined;
}

const LectureVideoPreview: React.FC<LectureVideoPreviewProps> = ({ watchedVideo }) => {
  const videoSourceURL = watchedVideo || null;

  if (videoSourceURL && typeof videoSourceURL === 'string') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-100 p-2 overflow-hidden shadow-md">
        {/* Placeholder for your actual Video Player, e.g., HlsVideoPlayer */}
        <video 
          key={videoSourceURL} 
          src={videoSourceURL} 
          controls 
          className="w-full h-auto max-h-96 rounded-md bg-black"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        <p className="text-sm text-gray-500 mt-2 text-center">
          {videoSourceURL.startsWith('blob:') ? 'New Video Preview (Local File)' : 'Existing Lecture Video'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-32 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
      No Video Selected
    </div>
  );
};
// -------------------------------------------------------------------

interface EditLectureProps {
  chapter: IChapterResponse;
  lecture: ILecture;
  courseId: string;
}

export default function EditLecture({ chapter, lecture, courseId }: EditLectureProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // NEW STATE: Toggle visibility of the VideoUpload component
  const [showVideoUpload, setShowVideoUpload] = useState(false); 

  const navigate = useNavigate();

  const { mutate, isPending } = useMutation<ILectureSaveResponse, IErrorResponse, FormData>({
    mutationFn: (formData: FormData) => chapterServices.updateLecture(chapter._id, lecture._id.toString(), formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', chapter.courseId.toString()] });
      // Optionally navigate away after a successful update if required
      // navigate(`/courses`); 
      setShowVideoUpload(false); // Hide the uploader on success
      setVideoFile(null); // Clear the file state
    },
  });

  const {
    register,
    formState: { errors },
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<ILectureSaveRequest>({
    resolver: zodResolver(LectureSaveSchema),
    defaultValues: {
      title: lecture.title || '',
      video: lecture.video || '', // This holds the existing URL or the temporary 'blob:' URL
      duration: lecture.duration || 0,
      videoPopups: lecture.videoPopups || [],
    },
  });

  const watchedVideo = watch('video');

  useEffect(() => {
    // Reset RHF fields
    reset({
      title: lecture.title || '',
      video: lecture.video || '',
      duration: lecture.duration || 0,
      videoPopups: lecture.videoPopups || [],
    });
    // Reset local state
    setVideoFile(null);
    setUploadProgress(0);
    setUploading(false);
    setShowVideoUpload(false); // Hide uploader on lecture load/change
  }, [lecture, reset, chapter]);

  const extractVideoDuration = (previewURL: string) => {
    const videoEl = document.createElement('video');
    videoEl.src = previewURL;
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      if (videoEl.duration === Infinity) {
        videoEl.currentTime = 1e6; // seek to end
        videoEl.ontimeupdate = () => {
          videoEl.ontimeupdate = null;
          setValue('duration', videoEl.currentTime, { shouldValidate: true });
        };
      } else {
        setValue('duration', videoEl.duration, { shouldValidate: true });
      }
    };
  };

  // wire extraction into file select
  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setVideoFile(null);
      // Revert RHF 'video' to the original lecture URL upon file clearing
      setValue('video', lecture.video || '', { shouldValidate: true });
      setValue('duration', lecture.duration || 0, { shouldValidate: true });
      return;
    }
    
    setVideoFile(file);

    const preview = URL.createObjectURL(file);
    // Set the temporary URL in RHF 'video' field for the previewer
    setValue('video', preview, { shouldValidate: true }); 
    extractVideoDuration(preview);
  };

  const handleAddPopup = (link: string, popupDuration: number, triggerAt: number) => {
    const existing = (getValues('videoPopups') || []) as ILectureVideoPopup[];
    setValue('videoPopups', [...existing, { link, popupDuration, triggerAt }], { shouldValidate: true });
  };

  const onSubmit = async () => {
    const { title, duration, videoPopups } = getValues();
    const form = new FormData();

    form.append('title', title);
    form.append('duration', duration?.toString() || '0');
    form.append('videoPopups', JSON.stringify(videoPopups));

    try {
      // If a new file was selected, upload to media server first
      if (videoFile) {
        setUploading(true);
        setUploadProgress(0);

        const THRESH = Number(import.meta.env.VITE_DIRECT_UPLOAD_THRESHOLD || 200 * 1024 * 1024);

        let uploadRes: any = null;
        if (videoFile.size <= THRESH) {
          uploadRes = await uploadSmallFile(
            videoFile,
            { courseId, lectureId: lecture._id.toString(), isIntro: false },
            (pct) => {
              setUploadProgress(pct);
            },
          );
        } else {
          uploadRes = await uploadLargeFileMultipart(
            videoFile,
            { courseId, lectureId: lecture._id.toString(), isIntro: false },
            (pct) => {
              setUploadProgress(pct);
            },
          );
        }

        // Check upload success
        if (!uploadRes || !uploadRes.ok) {
          setUploading(false);
          throw new Error(uploadRes?.message || 'Upload failed');
        }
        
        setUploadProgress(100);

        // attach returned videoId (or key) to the lecture update payload
        if (uploadRes.videoId) form.append('videoId', uploadRes.videoId);
        else if (uploadRes.key) form.append('videoKey', uploadRes.key);
      } else {
        // No new file — preserve existing video reference (string URL or id)
        const currentVideo = lecture.video || ''; // Use the original lecture.video if no new file
        if (currentVideo) form.append('video', currentVideo);
      }

      await mutate(form, {
          onSettled: () => setUploading(false) // Stop loading state after mutation attempt
      });

    } catch (err) {
      console.error('EditLecture upload error', err);
      setUploading(false);
      alert((err as any)?.message || 'Upload failed');
    }
  };

  const popups = watch('videoPopups') || [];
  
  // Logic to determine the button text
  const videoButtonText = lecture.video || videoFile 
    ? "Change Lecture Video" 
    : "Upload Lecture Video";

  return (
    <div className="space-y-6">
      <CourseEditStatus courseId={courseId} lectureId={lecture._id?.toString()} type="lecture" />
      
      {/* 1. Video Preview (Only show if not uploading) */}
      {!uploading && (
        <div className="space-y-2">
          <label className="text-lg font-medium">Current Video Preview</label>
          {/* Note: lecture.previewUrl image removed as per instruction */}
          <LectureVideoPreview watchedVideo={watchedVideo} />
        </div>
      )}

      <Input
        id="title"
        label="Lecture Title"
        placeholder="Enter lecture title"
        {...register('title')}
        error={errors.title?.message}
      />

      {/* 2. Toggle Button for VideoUpload */}
      {/* Show the button if not currently uploading a video */}
      {!uploading && (
        <Button 
          type="button" 
          variant="outline"
          onClick={() => setShowVideoUpload(!showVideoUpload)}
          className="w-full justify-center"
        >
          {showVideoUpload ? 'Hide Upload ' : videoButtonText}
        </Button>
      )}

      {/* 3. Conditional VideoUpload Component */}
      {(showVideoUpload || videoFile) && !uploading && (
        <div className="p-4 border rounded-lg shadow-inner bg-gray-50 transition-all duration-300">
          <VideoUpload onFileSelect={handleFileSelect} onAddPopup={handleAddPopup} />
          {videoFile && <p className="mt-2 text-sm text-gray-600">File selected: {videoFile.name}. Click 'Update Lecture' to upload.</p>}
        </div>
      )}

      {/* 4. Progress Bar */}
      {uploading && (
        <div className="mt-4">
          <ProgressBar value={uploadProgress} label="Video Uploading..." />
        </div>
      )}

      {/* 5. Popups Manager */}
      {popups.length > 0 && (
        <VideoPopupManager
          videoPopups={popups}
          videoLength={watch('duration') || 0}
          onUpdate={(updated) => setValue('videoPopups', updated, { shouldValidate: true })}
        />
      )}
      
      {/* 6. Submit Button */}
      <Button 
        type="button" 
        onClick={handleSubmit(onSubmit)} 
        loading={isPending || uploading}
        className="w-full"
      >
        Update Lecture
      </Button>
    </div>
  );
}