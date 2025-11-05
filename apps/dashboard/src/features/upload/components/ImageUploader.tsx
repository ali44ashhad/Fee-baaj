import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Upload, Check, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import uploadServices from '../services';
import { IErrorResponse, IUploadResponse } from '@elearning/types';

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void;
  maxSize?: number;
  acceptedFileTypes?: string[];
  isProfilePicture?: boolean;
  value?: string;
  error?: string;
}

export function ImageUploader({
  onUploadComplete,
  maxSize = 5 * 1024 * 1024,
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/jpg'],
  isProfilePicture = false,
  value,
  error: fieldError,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!value) setPreview(null);
  }, [value]);

  const { mutate, isPending, isSuccess, data } = useMutation<IUploadResponse, IErrorResponse, File>({
    mutationFn: (file) =>
      uploadServices.upload(file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? 1));
        setProgress(percentCompleted);
      }),
    onMutate: () => {
      setError(null);
      setProgress(0);
    },
    onSuccess: (dataRes) => {
      setPreview(dataRes.url);
      onUploadComplete(dataRes.path);
    },
    onError: (err) => {
      console.error(err);
      setError('Failed to upload file. Please try again.');
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      const selectedFile = acceptedFiles[0];

      if (selectedFile.size > maxSize) {
        setError(`File size should be less than ${maxSize / (1024 * 1024)}MB`);
        return;
      }

      //setPreview(URL.createObjectURL(selectedFile));
      mutate(selectedFile);
    },
    [maxSize, mutate],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpeg', '.jpg'],
    },
    multiple: false,
  });

  const removeFile = () => {
    setPreview(null);
    setError(null);
  };

  return (
    <Card className={cn('w-full', isProfilePicture ? 'max-w-xs' : 'max-w-md')}>
      <CardContent className="p-5">
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed text-center cursor-pointer transition-colors relative',
            preview ? 'p-3' : 'p-8',
            isProfilePicture ? 'rounded-full aspect-square flex flex-col items-center justify-center' : 'rounded-lg',
            isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary hover:bg-primary/5',
          )}
        >
          <input {...getInputProps()} />
          {isProfilePicture ? (
            preview ? (
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <img src={preview} alt="Profile preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm">Change picture</p>
                </div>
              </div>
            ) : (
              <>
                <UserCircle2 className="mx-auto h-16 w-16 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Upload profile picture</p>
                <p className="mt-1 text-xs text-gray-400">PNG, JPG up to {maxSize / (1024 * 1024)}MB</p>
              </>
            )
          ) : (
            <>
              {preview ? (
                <div className="relative w-full h-full">
                  <img src={preview} alt="Image preview" className="w-full h-full object-cover rounded-lg" />
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm">Change image</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    {isDragActive ? 'Drop the image here' : "Drag 'n' drop an image here, or click to select"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">PNG, JPG up to {maxSize / (1024 * 1024)}MB</p>
                </>
              )}
            </>
          )}
        </div>

        {(fieldError || error) && <p className="mt-2 text-sm text-red-500">{fieldError || error}</p>}

        {isPending && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-gray-500">{progress}% uploaded</p>
          </div>
        )}

        {isSuccess && preview && (
          <div className="mt-4 flex items-center justify-center text-green-500">
            <Check className="mr-2 h-5 w-5" />
            <span>Upload complete</span>
          </div>
        )}

        {preview && (
          <Button variant="outline" className="mt-4 w-full" onClick={removeFile}>
            Remove {isProfilePicture ? 'picture' : 'image'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
