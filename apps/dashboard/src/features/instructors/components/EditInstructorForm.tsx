'use client';

import { IInstructorSaveRequest, IErrorResponse, IInstructorSaveResponse, IInstructorResponse } from '@elearning/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InstructorSaveSchema } from '@elearning/schemas';
import instructorServices from '../services';
import { Textarea } from '@/components/ui/textarea';
import ImageUploader from '../../courses/upload/components/ImageUploader';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { Save, Loader2, Trash2 } from 'lucide-react';

const MEDIA_URL =
  (import.meta.env.VITE_MEDIA_API_URL as string | undefined) ??
  (import.meta.env.VITE_NEXT_PUBLIC_MEDIA_API_API_URL as string | undefined) ??
  '';

function uploadToMediaServer(file: File, targetId: string, onProgress: (percent: number) => void) {
  if (!MEDIA_URL) throw new Error('MEDIA_URL is not configured');

  const url = `${MEDIA_URL.replace(/\/$/, '')}/image/upload`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('targetType', 'instructors');
  fd.append('targetId', String(targetId));
  fd.append('uploader', 'admin');

  return new Promise<{ key: string; url: string; raw: any }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      onProgress(100);

      if (xhr.status === 200) {
        try {
          const json = JSON.parse(xhr.responseText);
          const key = json?.key ?? json?.data?.key;
          const url = json?.url ?? json?.data?.url;
          if (!key) throw new Error('Media server did not return an image key');
          resolve({ key, url, raw: json });
        } catch (e) {
          reject(new Error(`Upload successful but response parsing failed: ${e}`));
        }
      } else {
        const errMsg = xhr.responseText || `Upload failed with status ${xhr.status}`;
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.open('POST', url, true);
    xhr.send(fd);
  });
}

interface EditInstructorFormProps {
  instructor: IInstructorResponse;
}

export default function EditInstructorForm({ instructor }: EditInstructorFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient(); // <-- added
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // local pictureUrl state so UI updates immediately after delete/upload
  const [currentPictureUrl, setCurrentPictureUrl] = useState<string | null>(instructor.pictureUrl ?? null);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateMut = useMutation<IInstructorSaveResponse, IErrorResponse, { id: string; payload: any }>(
    {
      mutationFn: ({ id, payload }) => instructorServices.update(id, payload),
      onSuccess: (_) => {
        // noop handled in caller
      },
    }
  );

  const deleteImageMut = useMutation<any, any, void>({
    mutationFn: async () => {
      // instruct media server to delete prefix for this instructor
      return await instructorServices.deleteImage(String(instructor.id));
    },
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: (data) => {
      // update UI: clear picture
      setCurrentPictureUrl(null);
      // also clear form value
      try {
        setValue('picture', '' as any, { shouldDirty: true, shouldValidate: true });
      } catch {}
      // <-- invalidate queries so cached instructor or instructor list refreshes
      qc.invalidateQueries({ queryKey: ['instructor', String(instructor.id)] });
      qc.invalidateQueries({ queryKey: ['instructors'] });
    },
    onError: (err) => {
      console.error('Failed to delete instructor image:', err);
      // optionally show toast
      alert('Failed to delete image. Check console for details.');
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const form = useForm<IInstructorSaveRequest>({
    resolver: zodResolver(InstructorSaveSchema),
    defaultValues: {
      name: instructor.name,
      profession: instructor.profession,
      description: instructor.description,
      picture: instructor.pictureUrl,
    },
  });

  const { register, handleSubmit, setValue, formState } = form;
  const { errors } = formState;

  const isSaving = updateMut.isPending;
  const isUploading = isSaving && uploadProgress !== null && uploadProgress < 100;
  const buttonText = isUploading ? 'Uploading Profile Image...' : isSaving ? 'Saving Changes...' : 'Save Changes';

  const onSubmit = async (data: IInstructorSaveRequest) => {
    setUploadProgress(null);

    const payload: any = {
      name: data.name,
      profession: data.profession,
      description: data.description,
    };

    const fileToUpload = selectedFile ?? (data.picture instanceof File ? data.picture : null);

    if (fileToUpload instanceof File) {
      setUploadProgress(0);
      try {
        const { key, url } = await uploadToMediaServer(fileToUpload, String(instructor.id), setUploadProgress);

        if (key) payload.pictureId = key;
        if (url) {
          payload.pictureUrl = url;
          setCurrentPictureUrl(url);
        }
      } catch (uErr) {
        console.error('Image upload failed', uErr);
        alert('Image upload failed. Non-picture changes will still be saved. Check console.');
      } finally {
        setUploadProgress(100);
      }
    }

    try {
      await updateMut.mutateAsync({ id: instructor.id, payload });
      // invalidate so lists show updated thumbnail immediately after update
      qc.invalidateQueries({ queryKey: ['instructor', String(instructor.id)] });
      qc.invalidateQueries({ queryKey: ['instructors'] });
      navigate('/instructors');
    } catch (err) {
      console.error('Failed to update instructor:', err);
      alert('Instructor update failed. Check console for details.');
    }
  };

  const handleDeleteImage = async () => {
    const ok = window.confirm('Delete instructor profile picture? This will remove it from storage and clear the profile image.');
    if (!ok) return;
    try {
      await deleteImageMut.mutateAsync();
      // Optionally show success toast
    } catch (err) {
      // error handled in mutation onError
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-xl border border-gray-100 mb-20 flex-grow w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Edit Instructor Details</h2>

        <form id="edit-instructor-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <Input
                id="name"
                label="Full Name"
                placeholder="Enter Instructor name"
                {...register('name')}
                error={errors.name?.message?.toString()}
                className="focus:ring-blue-500 focus:border-blue-500"
              />
              <Input
                id="profession"
                label="Profession/Title"
                placeholder="e.g., Senior Developer, Marketing Expert"
                {...register('profession')}
                error={errors.profession?.message?.toString()}
                className="focus:ring-blue-500 focus:border-blue-500"
              />
              <Textarea
                id="description"
                label="Bio/Description"
                placeholder="Provide a brief biography of the instructor."
                rows={5}
                {...register('description')}
                error={errors.description?.message?.toString()}
                className="focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-1 flex flex-col items-center gap-4">
              <div className="w-full text-center p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 transition duration-300 hover:border-blue-400">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Upload New Profile Picture</label>
                <div className="w-full max-w-[200px] aspect-square mx-auto">
                  <ImageUploader
                    onFileSelect={(file: File) => {
                      setSelectedFile(file);
                      setValue('picture', file as any, { shouldValidate: true, shouldDirty: true });
                      setUploadProgress(null);
                      console.log('[EditInstructor] Image selected', file?.name, file?.size);
                    }}
                  />
                </div>
                {errors.picture?.message && <p className="mt-2 text-xs text-red-500 text-center">{errors.picture?.message as string}</p>}
              </div>

              <div className="w-full text-center p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                <span className="text-sm font-medium text-gray-700 mb-2 block">Current Picture</span>
                <div className="w-full max-w-[150px] aspect-square mx-auto rounded-full overflow-hidden border-4 border-indigo-100 shadow-md relative">
                  <img
                    src={currentPictureUrl || '/userPlaceHolder.jpg'}
                    width={200}
                    height={200}
                    alt="Current Instructor Profile"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="mt-3 flex items-center justify-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // trigger file select as alternative
                      // handled via ImageUploader component usually
                    }}
                  >
                    Change
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteImage}
                    disabled={isDeleting || !currentPictureUrl}
                    className="text-red-600"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="pt-2">
              <ProgressBar value={uploadProgress || 0} label="Image Upload Progress" height={10} />
            </div>
          )}
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-2xl z-10">
        <div className="max-w-4xl mx-auto flex justify-end">
          <Button
            type="submit"
            disabled={isSaving}
            form="edit-instructor-form"
            className="w-full md:w-64 h-10 flex items-center justify-center transition-all duration-300 bg-primary text-white hover:bg-indigo-700 shadow-lg"
          >
            {isSaving ? (
              <>
                <Loader2 className={`mr-2 h-4 w-4 ${isUploading ? 'animate-spin' : ''}`} />
                {buttonText}
              </>
            ) : (
              <>
                <Save className="mr-1 h-4 w-4" />
                {buttonText} 
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
