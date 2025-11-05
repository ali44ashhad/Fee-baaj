import { IUserSaveResponse, IErrorResponse, IUserResponse, IUserSaveRequest } from '@elearning/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSaveSchema } from '@elearning/schemas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import userServices from '../services';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ImageUploader from '../../courses/upload/components/ImageUploader';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
// 🌟 UI Enhancements Imports 🌟
import ProgressBar from '@/components/ui/ProgressBar';
import { Save, Loader2, UserCog, Trash2 } from 'lucide-react';

const MEDIA_URL = (import.meta.env.VITE_MEDIA_API_URL || import.meta.env.VITE_MEDIA_BASE_URL || '').replace(/\/$/, '');

// --- PROGRESS BAR ENABLED UPLOAD HELPER ---
function uploadFileToMediaServer(file: File, targetId: string, onProgress: (percent: number) => void) {
  if (!MEDIA_URL) throw new Error('MEDIA_URL is not configured');

  const uploadUrl = `${MEDIA_URL}/image/upload`.replace(/\/$/, '') || '/image/upload';

  const fd = new FormData();
  fd.append('file', file);
  fd.append('targetType', 'users');
  fd.append('targetId', targetId);
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

interface EditUserFormProps {
  user: IUserResponse;
}

export default function EditUserForm({ user }: EditUserFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient(); // <-- added
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 🌟 New State for progress tracking 🌟
  const [isSaving, setIsSaving] = useState(false); // Controls overall save process
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // Tracks file upload progress

  // Local current picture URL state so UI updates instantly after deletion/upload
  const [currentPictureUrl, setCurrentPictureUrl] = useState<string | null>(user.pictureUrl ?? null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { mutateAsync: apiUpdate } = useMutation<
    IUserSaveResponse,
    IErrorResponse,
    { id: string; payload: Partial<IUserSaveRequest> }
  >({
    mutationFn: ({ id, payload }) => userServices.update(id, payload),
  });

  // Mutation to call media server admin delete for this user's images
  const deleteImageMut = useMutation<any, any, void>({
    mutationFn: async () => {
      return await userServices.deleteImage(String(user._id));
    },
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      // Optimistically clear picture in UI and form
      setCurrentPictureUrl(null);
      try {
        // best-effort: clear the avatar form field if present
        setValue('avatar', '' as any, { shouldDirty: true, shouldValidate: true });
      } catch {}
      // invalidate queries so cached user and users list refresh
      qc.invalidateQueries({ queryKey: ['user', String(user._id)] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      console.error('Failed to delete user image:', err);
      alert('Failed to delete image. Check console for details.');
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const form = useForm<IUserSaveRequest>({
    resolver: zodResolver(UserSaveSchema),
    defaultValues: {
      name: user.name,
      identifier: user.identifier,
      password: '',
      active: user.active,
      avatar: (user.pictureUrl as any) || '',
      gender: user.gender,
      age: user.age,
      fingerprint: user.fingerprint || 'fromAdmin',
    },
  });

  const { register, handleSubmit, setValue, control } = form;
  const { errors } = form.formState;

  // --- onSubmit uses typed data to satisfy RHF/TS
  const onSubmit = async (data: IUserSaveRequest) => {
    setIsSaving(true);
    setUploadProgress(null);
    setUploadError(null);

    const values = data;
    const updatePayload: Partial<IUserSaveRequest> = {
      name: values.name,
      identifier: values.identifier,
      gender: values.gender,
      age: Number(values.age),
      active: Boolean(values.active),
      fingerprint: values.fingerprint,
    };
    if (values.password) updatePayload.password = values.password;

    try {
      // 1. If a new avatar selected, upload first
      if (selectedFile) {
        setUploadProgress(0); // Start progress bar
        try {
          const { key, url } = await uploadFileToMediaServer(
            selectedFile,
            String(user._id),
            (percent) => {
              setUploadProgress(percent);
            }, // Progress callback
          );

          const p = updatePayload as any;
          if (key) p.pictureId = String(key);
          if (url) {
            p.pictureUrl = String(url);
            setCurrentPictureUrl(String(url));
          }
        } catch (e: any) {
          setUploadError(e?.message || 'Upload failed. Non-picture changes will be saved.');
          console.error('upload failed', e);
          // continue without picture
        }
      }

      // 2. Update user data
      await apiUpdate({ id: String(user._id), payload: updatePayload });
      // invalidate so data is fresh after update
      qc.invalidateQueries({ queryKey: ['user', String(user._id)] });
      qc.invalidateQueries({ queryKey: ['users'] });
      navigate('/users');
    } catch (err: any) {
      console.error('update failed', err);
      alert(err?.message || 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Dynamic button state calculation
  const isUploading = isSaving && uploadProgress !== null && uploadProgress < 100;
  const buttonText = isUploading ? 'Uploading Profile Image...' : isSaving ? 'Saving Changes...' : 'Save Changes';

  const handleDeleteImage = async () => {
    const ok = window.confirm(
      'Delete user profile picture? This will remove it from storage and clear the profile image.',
    );
    if (!ok) return;
    try {
      await deleteImageMut.mutateAsync();
      // optionally show toast
    } catch (err) {
      // error handled in mutation
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-xl border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2 flex items-center">
        <UserCog className="mr-3 h-6 w-6 text-indigo-600" />
        Edit User: {user.name}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Main Form Grid - Left (Details) and Right (Image) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT COLUMN (2/3 Width) - All Details Consolidated */}
          <div className="md:col-span-2 space-y-6">
            <Input
              id="name"
              label="Full Name"
              placeholder="Enter user's full name"
              {...register('name')}
              error={errors.name?.message as string | undefined}
            />
            <Input
              id="identifier"
              type="text"
              label="Identifier (Email/Username)"
              placeholder="Enter unique identifier (e.g., email)"
              {...register('identifier')}
              error={errors.identifier?.message as string | undefined}
            />
            <Input
              id="password"
              placeholder="Leave blank to keep current password"
              type="password"
              label="New Password"
              {...register('password')}
              error={errors.password?.message as string | undefined}
            />

            {/* Gender Section - No large gap now */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <Label className="font-semibold text-gray-700">Gender</Label>
              <div className="flex space-x-8">
                <div className="flex items-center space-x-2">
                  <input
                    id="male"
                    type="radio"
                    value="male"
                    {...register('gender')}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="female"
                    type="radio"
                    value="female"
                    {...register('gender')}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <Label htmlFor="female">Female</Label>
                </div>
              </div>
              {errors.gender?.message && (
                <p className="text-xs text-red-500 pt-1">{errors.gender?.message?.toString()}</p>
              )}
            </div>

            <Input
              id="age"
              type="number"
              label="Age"
              placeholder="Enter user's age"
              {...register('age', { valueAsNumber: true })}
              error={errors.age?.message as string | undefined}
            />

            {/* Account Active Status - Moved to the left column */}
            <div className="pt-4">
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="active" className="text-sm font-medium">
                      Account Active
                    </Label>
                  </div>
                )}
              />
              {errors.active && <p className="text-xs text-red-500 pt-1">{errors.active.message?.toString()}</p>}
            </div>
          </div>

          {/* RIGHT COLUMN (1/3 Width) - Profile Picture Section */}
          <div className="md:col-span-1 flex flex-col items-center gap-4">
            {/* New Image Uploader */}
            <div className="w-full text-center p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 transition duration-300 hover:border-blue-400">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Change Profile Picture</label>
              <div className="w-full max-w-[200px] aspect-square mx-auto">
                <ImageUploader
                  onFileSelect={(file: File) => {
                    setValue('avatar', file as any, { shouldValidate: true, shouldDirty: true });
                    setSelectedFile(file);
                    setUploadProgress(null);
                  }}
                />
              </div>
              {errors.avatar?.message && (
                <p className="mt-2 text-xs text-red-500 text-center">{String(errors.avatar.message)}</p>
              )}
            </div>

            {/* Current Picture Display */}
            <div className="w-full text-center p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
              <span className="text-sm font-medium text-gray-700 mb-2 block">Current Picture</span>
              <div className="w-full max-w-[150px] aspect-square mx-auto rounded-full overflow-hidden border-4 border-indigo-100 shadow-md relative">
                <img
                  src={currentPictureUrl || '/userPlaceHolder.jpg'}
                  width={200}
                  height={200}
                  alt="Current User Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="mt-3 flex items-center justify-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // placholder: main change is via ImageUploader
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

        {/* Progress Bar Display */}
        {isUploading && (
          <div className="pt-2">
            <ProgressBar value={uploadProgress || 0} label="Image Upload Progress" height={10} />
          </div>
        )}

        {/* Error Message */}
        {uploadError && (
          <div className="text-sm font-medium text-red-600 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            {uploadError}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 flex justify-end">
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
