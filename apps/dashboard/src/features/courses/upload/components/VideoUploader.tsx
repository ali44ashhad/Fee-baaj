import React, { useCallback } from 'react';
import MuxUploader from '@mux/mux-uploader-react';
import uploadServices from '../services';

interface VideoUploaderProps {
  courseId: string;
  chapterId: string;
  lectureId: string;
  onUploadSuccess?: () => void;
}

const VideoUploader = ({ courseId, lectureId, chapterId, onUploadSuccess }: VideoUploaderProps) => {
  const getUploadUrl = useCallback(async () => {
    const response = await uploadServices.getUploadUrl({ courseId, chapterId, lectureId });
    return response.uploadUrl;
  }, [courseId, lectureId, chapterId]);

  return (
    <div className="max-w-2xl mx-auto p-4 border-2 border-dashed border-gray-300 rounded-lg">
      <MuxUploader
        endpoint={getUploadUrl}
        onSuccess={(ev) => {
          console.log(ev.detail);
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        }}
      />
    </div>
  );
};

export default VideoUploader;
