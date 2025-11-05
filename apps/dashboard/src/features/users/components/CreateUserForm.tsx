'use client';

import type { IUserSaveRequest, IUserSaveResponse, IErrorResponse } from '@elearning/types';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSaveSchema } from '@elearning/schemas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import userServices from '../services';
import ImageUploader from '../../courses/upload/components/ImageUploader';
import { useState } from 'react';
//  Import Progress Bar and Icons 
import ProgressBar from '@/components/ui/ProgressBar'; 
import { Save, Loader2, UserPlus } from 'lucide-react';

const MEDIA_URL = (import.meta.env.VITE_MEDIA_API_URL || import.meta.env.VITE_MEDIA_BASE_URL || '').replace(/\/$/, '');

// --- PROGRESS BAR ENABLED UPLOAD HELPER ---
/**
 * Uploads a file to the media server using XHR to enable progress tracking.
 */
function uploadFileToMediaServer(file: File, targetId: string, onProgress: (percent: number) => void) {
  if (!MEDIA_URL) throw new Error('MEDIA_URL is not configured');
  
  const uploadUrl = `${MEDIA_URL}/image/upload`.replace(/\/$/, '') || '/image/upload';
  console.log('[uploadToMediaServer] POST', uploadUrl, { fileName: file.name, size: file.size });

  const fd = new FormData();
  fd.append('file', file);
  fd.append('targetType', 'users');
  fd.append('targetId', targetId);
  fd.append('uploader', 'admin');

  return new Promise<{ key: string; url: string; raw: any }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    //  PROGRESS LISTENER 
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    // Error/Success listener
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      onProgress(100); // Ensure progress bar hits 100% on completion/failure

      if (xhr.status === 200) {
        try {
          const json = JSON.parse(xhr.responseText);
          // Accept various shapes
          const key = json?.key || json?.data?.key || json?.result?.key;
          const url = json?.url || json?.data?.url || json?.result?.url;

          if (!key && !url) throw new Error('Media server did not return an image key or URL');
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
    xhr.open('POST', uploadUrl, true);
    xhr.send(fd);
  });
}
// --- END PROGRESS BAR ENABLED UPLOAD HELPER ---


export default function CreateUserForm() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  //  New State for progress tracking 
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const { mutateAsync: createUser } = useMutation<IUserSaveResponse, IErrorResponse, IUserSaveRequest>({
    mutationFn: (payload) => userServices.create(payload),
  });

  const { mutateAsync: updateUser } = useMutation<IUserSaveResponse, IErrorResponse, { id: string; payload: Partial<IUserSaveRequest> }>({
    mutationFn: ({ id, payload }) => userServices.update(id, payload),
  });

  const form = useForm<IUserSaveRequest>({
    resolver: zodResolver(UserSaveSchema),
    defaultValues: {
      name: '',
      identifier: '',
      password: '',
      gender: undefined,
      age: undefined,
      active: false,
      avatar: '',
      fingerprint: 'fromAdmin',
    },
  });

  const { register, handleSubmit, setValue, getValues, control } = form;
  const { errors } = form.formState;

  const onSubmit = handleSubmit(async () => {
    setIsSaving(true);
    setUploadProgress(null);
    setUploadError(null);

    const values = getValues();
    const payload: IUserSaveRequest = {
      name: values.name,
      identifier: values.identifier,
      password: values.password,
      gender: values.gender,
      age: Number(values.age),
      active: Boolean(values.active),
      fingerprint: values.fingerprint,
    };

    try {
      // 1) Create user (JSON)
      const created = await createUser(payload);

      console.debug('create user response:', created);

      // 2) Try extracting id
      let userId: string | undefined;

      if ((created as any)?.data?._id) userId = (created as any).data._id;
      else if ((created as any)?._id) userId = (created as any)._id;
      else if ((created as any)?.user?._id) userId = (created as any).user._id;
      else if ((created as any)?.id) userId = (created as any).id;
      else if ((created as any)?.data?.id) userId = (created as any).data.id;

      if (!userId) {
        const maybe = (created as any);
        if (maybe && typeof maybe === 'object') {
          const keys = ['_id', 'id'];
          for (const k of keys) {
            if (maybe[k]) {
              userId = String(maybe[k]);
              break;
            }
          }
        }
      }

      if (!userId) {
        console.warn('Could not determine created user id from server response:', created);
      }

      // 3) If avatar selected AND we have userId -> upload and then update user with pictureId/url
      if (selectedFile && userId) {
        setUploadProgress(0); // Start progress bar
        try {
          const { key, url } = await uploadFileToMediaServer(
            selectedFile, 
            userId,
            (percent) => { setUploadProgress(percent); } // Progress callback
          );

          const updatePayload: any = {};
          if (key) updatePayload.pictureId = key;
          if (url) updatePayload.pictureUrl = url;
          if (Object.keys(updatePayload).length) {
            await updateUser({ id: userId, payload: updatePayload });
          }
        } catch (e: any) {
          console.error('upload failed', e);
          setUploadError(e?.message || 'Upload failed');
        } finally {
          setUploadProgress(100); // Ensure it finishes
        }
      }

      form.reset();
      navigate('/users');
    } catch (err: any) {
      console.error('create user failed', err);
      alert(err?.message || 'Unable to create user');
    } finally {
      setIsSaving(false);
    }
  });
  
  const isUploading = isSaving && uploadProgress !== null && uploadProgress < 100;
  const buttonText = isUploading 
    ? 'Uploading Profile Image...' 
    : isSaving 
      ? 'Creating User...' 
      : 'Create User';

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-xl border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2 flex items-center">
        <UserPlus className="mr-3 h-6 w-6 text-indigo-600" />
        New User Creation
      </h2>
      
      <form onSubmit={onSubmit} className="space-y-6">
        
        {/* Main Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Input id="name" label="Full Name" placeholder="Enter user's full name" {...register('name')} error={errors.name?.message?.toString()} />
            <Input id="identifier" type="text" label="Identifier (Email/Phone)" placeholder="Enter unique identifier (e.g., email)" {...register('identifier')} error={errors.identifier?.message?.toString()} />
            <Input id="password" type="password" label="Password" placeholder="Set initial password" {...register('password')} error={errors.password?.message?.toString()} />
          </div>

          {/* Profile Picture Upload Section */}
          <div className="md:col-span-1 flex flex-col items-center p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/50">
            <label className="text-sm font-medium text-gray-700 mb-3 block">User Profile Picture (Optional)</label>
            <div className="w-full max-w-[200px] aspect-square">
              <ImageUploader
                onFileSelect={(file: File) => {
                  setValue('avatar', file as any, { shouldValidate: true, shouldDirty: true });
                  setSelectedFile(file);
                  setUploadProgress(null);
                }}
              />
            </div>
            {errors.avatar?.message && <p className="mt-2 text-xs text-red-500 text-center">{errors.avatar?.message as string}</p>}
          </div>
        </div>

        {/* Details and Active Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
          
          {/* Gender and Age */}
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold text-gray-700">Gender</Label>
              <div className="flex space-x-8">
                <div className="flex items-center space-x-2">
                  <Input id="male" type="radio" value="male" {...register('gender')} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Input id="female" type="radio" value="female" {...register('gender')} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                  <Label htmlFor="female">Female</Label>
                </div>
              </div>
              {errors.gender?.message && <p className="text-xs text-red-500 pt-1">{errors.gender?.message?.toString()}</p>}
            </div>

            <Input 
              id="age" 
              type="number" 
              label="Age" 
              placeholder="Enter user's age" 
              {...register('age', { valueAsNumber: true })} 
              error={errors.age?.message?.toString()} 
            />

             {/* Active Status */}
          <div className="md:col-span-1 flex flex-col justify-start pt-8">
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="active" className="text-sm font-medium">Account Active</Label>
                </div>
              )}
            />
            {errors.active && <p className="text-xs text-red-500 pt-1">{errors.active.message?.toString()}</p>}
          </div>
          </div>

         

        </div>

        {/* Progress Bar Display */}
        {isUploading && (
          <div className="pt-2">
            <ProgressBar value={uploadProgress || 0} label="Image Upload Progress" height={10} />
          </div>
        )}

        {/* Error Message */}
        {uploadError && <div className="text-sm font-medium text-red-600 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">{uploadError}</div>}

        {/* Action Button */}
        <div className="pt-4">
          <Button 
            type="submit" 
            disabled={isSaving}
            className="w-full md:w-64 h-10 flex items-center justify-center transition-all duration-300 bg-primary text-white hover:bg-indigo-700 shadow-md"
          >
            {isSaving ? (
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