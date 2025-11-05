'use client';

import { IInstructorSaveRequest, IInstructorSaveResponse } from '@elearning/types';
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
// Import the custom ProgressBar component
import ProgressBar from '@/components/ui/ProgressBar'; 
// Use a common icon library (like Lucide React) for better visual feedback
import { Save, Loader2 } from 'lucide-react';

const MEDIA_URL =
  (import.meta.env.VITE_MEDIA_API_URL as string | undefined) ??
  (import.meta.env.VITE_NEXT_PUBLIC_MEDIA_API_URL as string | undefined) ??
  '';

export default function CreateInstructorForm() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const form = useForm<IInstructorSaveRequest>({
    resolver: zodResolver(InstructorSaveSchema),
    defaultValues: { name: '', profession: '', description: '', picture: '' },
  });

  const { register, handleSubmit, setValue, getValues, formState, reset } = form;
  const { errors } = formState;

  function uploadToMediaServer(file: File, instructorId: string, onProgress: (percent: number) => void) {
    if (!MEDIA_URL) throw new Error('MEDIA_URL is not configured');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetType', 'instructors');
    fd.append('targetId', String(instructorId));
    fd.append('uploader', 'admin');

    const url = `${MEDIA_URL.replace(/\/$/, '')}/image/upload`;
    console.log('[uploadToMediaServer] POST', url, { fileName: file.name, size: file.size });

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

        if (xhr.status === 200) {
          try {
            const json = JSON.parse(xhr.responseText);
            console.log('[uploadToMediaServer] response json', json);
            const key = json?.key ?? json?.data?.key;
            const url = json?.url ?? json?.data?.url;
            if (!key) throw new Error('Media server did not return an image key');
            resolve({ key, url, raw: json });
          } catch (e) {
            reject(new Error(`Upload successful but response parsing failed: ${e}`));
          }
        } else {
          const errMsg = xhr.responseText || `Upload failed with status ${xhr.status}`;
          console.error('[uploadToMediaServer] failed response', xhr.status, xhr.responseText);
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.open('POST', url, true);
      // xhr.withCredentials = true; 
      xhr.send(fd);
    });
  }

  const onSubmit = handleSubmit(async () => {
    setSaving(true);
    setUploadProgress(null); 
    
    try {
      const values = getValues();
      console.log('[CreateInstructor] form values', values, 'selectedFile-', selectedFile);

      // 1️⃣ Prepare JSON payload for instructor API
      const createPayload: Omit<IInstructorSaveRequest, 'picture' | 'pictureId' | 'pictureUrl'> = {
        name: values.name,
        profession: values.profession,
        description: values.description,
      };

      // 2️⃣ Create instructor
      const created: IInstructorSaveResponse = await instructorServices.create(createPayload);
      console.log('Instructor created:', created);

      const instructorId = created?._id || (created as any)?.id;
      if (!instructorId) throw new Error('Failed to get instructor ID from create response');

      // 3️⃣ Upload picture if present 
      const fileToUpload = selectedFile ?? (values.picture as unknown as File);
      if (fileToUpload instanceof File) {
        setUploadProgress(0); 
        try {
          const uploadRes = await uploadToMediaServer(
            fileToUpload, 
            String(instructorId),
            (percent) => { setUploadProgress(percent); } 
          );
          console.log('[CreateInstructor] upload result', uploadRes);
        } catch (e) {
          console.error('Image upload failed:', e);
          alert('Image upload failed. Instructor created without picture. Check console.');
        } finally {
          setUploadProgress(100); 
        }
      } else {
        console.log('[CreateInstructor] no file to upload');
      }

      // 4️⃣ Reset form and navigate
      reset();
      navigate('/instructors');
    } catch (err) {
      console.error('Failed to create instructor:', err);
      alert('Instructor creation failed. Check console for details.');
    } finally {
      setSaving(false);
    }
  });

  const isUploading = saving && uploadProgress !== null && uploadProgress < 100;
  const buttonText = isUploading 
    ? 'Uploading Profile Image...' 
    : saving 
      ? 'Saving Instructor...' 
      : 'Create Instructor';

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white  rounded-xl border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">New Instructor Details</h2>
      
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Main Form Fields */}
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

          {/* Image Uploader Section */}
          <div className="md:col-span-1 flex flex-col items-center p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 transition duration-300 hover:border-blue-400">
            <label className="text-sm font-medium text-gray-700 mb-2">Instructor Profile Picture</label>
            <div className="w-full max-w-[200px] aspect-square">
                <ImageUploader
                  onFileSelect={(file: File) => {
                    setSelectedFile(file);
                    setValue('picture', file as any, { shouldValidate: true, shouldDirty: true });
                    setUploadProgress(null); 
                    console.log('[CreateInstructor] Image selected', file?.name, file?.size);
                  }}
                />
            </div>
            {errors.picture?.message && <p className="mt-2 text-xs text-red-500 text-center">{errors.picture?.message as string}</p>}
          </div>
        </div>
        
        {/* Progress Bar Display */}
        {isUploading && (
          <div className="pt-2">
            <ProgressBar value={uploadProgress || 0} label="Image Upload Progress" height={10} />
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4">
          <Button 
            type="submit" 
            disabled={saving}
            className="w-full md:w-64 h-10 flex items-center justify-center transition-all duration-300"
          >
            {saving ? (
              <>
                <Loader2 className={`mr-2 h-4 w-4 ${isUploading ? 'animate-spin' : ''}`} /> 
                {buttonText}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> 
                {buttonText}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}