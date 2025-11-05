'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserProfileUpdateSchema } from '@elearning/schemas';
import Input from '@/components/ui/input';
import Radio from '@/components/ui/radio';
import { useMutation } from '@tanstack/react-query';
import {
  IUserProfileUpdateResponse,
  IErrorResponse,
  IUserProfileUpdateRequest,
  IUserResponse,
} from '@elearning/types';
import Button from '@/components/ui/button';
import { updateProfile } from '../actions';
import { useAuth } from '@/hooks/use-auth';
import { IoIosLogOut } from 'react-icons/io';
import { FiTrash2 } from 'react-icons/fi';

import UploadImageButton from '@/components/ui/UploadImageButton';

const MEDIA_URL = (process.env.NEXT_PUBLIC_MEDIA_API_URL || '').replace(/\/$/, '');

interface UpdateProfileFormProps {
  user: IUserResponse;
}

export default function UpdateProfileForm({ user }: UpdateProfileFormProps) {
  const { mutate: mutateAuth, logout } = useAuth();

  // form setup (RHForm + zod)
  const { register, setValue, handleSubmit, watch, formState } = useForm<IUserProfileUpdateRequest>({
    resolver: zodResolver(UserProfileUpdateSchema),
    defaultValues: {
      name: user.name,
      identifier: user.identifier,
      gender: user.gender,
      age: user.age,
    },
  });
  const { errors } = formState;

  // Avatar state
  const initialUrl = user?.pictureUrl || '/userPlaceHolder.jpg';
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>(initialUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // After successful immediate upload we store key/url here to include in profile update
  const [avatarUploadedKey, setAvatarUploadedKey] = useState<string | undefined>(user?.pictureId || undefined);
  const [avatarUploadedUrl, setAvatarUploadedUrl] = useState<string | undefined>(user?.pictureUrl || undefined);

  // Upload / submit states
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Deleting avatar state (new)
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // mutation to update profile (JSON)
  const { mutate, isLoading: isSubmitting } = useMutation<
    IUserProfileUpdateResponse,
    IErrorResponse,
    IUserProfileUpdateRequest
  >({
    mutationFn: (payload) => updateProfile(payload),
    onSuccess: () => {
      // refresh auth state so UI shows new name / pictureUrl etc
      mutateAuth();
    },
  });

  // Upload helper: immediate upload to media server returning { key, url }
  async function uploadAvatarToMediaServer(file: File) {
    setUploadError(null);
    setIsUploadingImage(true);

    // Keep a temporary preview in case upload is slow
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(objectUrl);

    try {
      const form = new FormData();
      // file field name expected by media server
      form.append('file', file);
      form.append('targetType', 'users');
      form.append('targetId', String(user._id));
      form.append('uploader', 'user');

      const resp = await fetch(`${MEDIA_URL}/image/upload`, {
        method: 'POST',
        body: form,
        // include credentials only if your media service requires cookie auth
        credentials: 'include',
      });

      if (!resp.ok) {
        // attempt to parse json error, otherwise throw
        let text = await resp.text().catch(() => null);
        throw new Error(text || `Upload failed: ${resp.status} ${resp.statusText}`);
      }

      const json = await resp.json().catch(() => null);
      // Media server expected shape examples:
      // { ok: true, key, url, variants }
      // or older: { key, url }
      const key = json?.key ?? json?.Key ?? undefined;
      const url = json?.url ?? json?.Url ?? json?.URL ?? undefined;

      if (!key && !url) {
        throw new Error('Upload response missing key/url');
      }

      // Use CDN url if provided, otherwise construct from returned key + S3_CDN_URL
      let finalUrl = url;
      if (!finalUrl && key && process.env.NEXT_PUBLIC_S3_CDN_URL) {
        const cdn = String(process.env.NEXT_PUBLIC_S3_CDN_URL).replace(/\/$/, '');
        finalUrl = `${cdn}/${key}`.replace(/([^:]\/)\/+/g, '$1');
      }

      // finalize UI state
      if (finalUrl) {
        setAvatarPreviewUrl(finalUrl);
        setAvatarUploadedUrl(finalUrl);
      }
      if (key) {
        setAvatarUploadedKey(key);
      }

      // set file / hidden field so form knows there's a change (optional)
      setAvatarFile(file);
      setValue('avatar', (file as unknown) as any);

      return { key, url: finalUrl };
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      setUploadError(msg);
      // keep local objectUrl as preview even if upload failed
      setAvatarPreviewUrl(objectUrl);
      throw err;
    } finally {
      setIsUploadingImage(false);
    }
  }

  // When the user selects a file in UploadImageButton we immediately upload and update UI
  const handleFile = async (file: File) => {
    if (!file) return;
    try {
      await uploadAvatarToMediaServer(file);
    } catch (e) {
      // uploadAvatarToMediaServer already sets uploadError
      console.error('avatar upload error', e);
    }
  };

  // Delete avatar handler (client -> media API -> media server will send webhook to admin API)
  // This calls the media-server /images/delete endpoint with the prefix delete behavior:
  // { targetType: 'users', targetId: user._id }
  const handleRemoveAvatar = async () => {
    setDeleteError(null);
    if (!window.confirm('Remove your profile photo? This will delete it from storage and set a placeholder.')) return;

    if (!MEDIA_URL) {
      setDeleteError('Media server URL is not configured. Cannot remove image.');
      return;
    }

    setIsDeletingAvatar(true);
    try {
      const resp = await fetch(`${MEDIA_URL}/images/delete`, {
        method: 'POST',
        credentials: 'include', // include cookies/session if needed
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ targetType: 'users', targetId: String(user._id) }),
      });

      if (!resp.ok) {
        let txt = await resp.text().catch(() => null);
        try {
          const j = await resp.json().catch(() => null);
          if (j && j.message) txt = j.message;
        } catch {}
        throw new Error(txt || `Delete failed: ${resp.status}`);
      }

      // Success: update UI locally and refresh auth
      setAvatarPreviewUrl('/userPlaceHolder.jpg');
      setAvatarUploadedKey(undefined);
      setAvatarUploadedUrl(undefined);
      setAvatarFile(null);
      setValue('avatar', '' as any, { shouldDirty: true, shouldValidate: true });

      // ensure user state refreshed across app
      mutateAuth();
    } catch (err: any) {
      console.error('Failed to delete avatar', err);
      setDeleteError(err?.message || 'Failed to delete avatar');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  // Build payload and submit to user API
  const onSubmit = handleSubmit(async (vals) => {
    try {
      const payload: IUserProfileUpdateRequest = {
        name: vals.name,
        identifier: vals.identifier,
        gender: vals.gender,
        age: Number(vals.age),
      } as any;

      // If we have an uploaded key from immediate upload, include it
      if (avatarUploadedKey) {
        payload.pictureId = avatarUploadedKey;
      }
      // optionally include pictureUrl (useful if you want immediate display without refetch)
      if (avatarUploadedUrl) {
        payload.pictureUrl = avatarUploadedUrl;
      }

      mutate(payload);
    } catch (err) {
      console.error('submit error', err);
    }
  });

  const uploadingOrSubmitting = isUploadingImage || isSubmitting;

  return (
    <>
      {/* Avatar preview & upload */}
      <div className="flex flex-col items-center mt-4 space-y-2">
        <img
          src={avatarPreviewUrl}
          alt="Profile"
          className="w-32 h-32 rounded-full object-cover ring-4 ring-gray-300"
        />

        <div className="flex  items-center space-x-2">
          <UploadImageButton
            buttonLabel=""
            maxSizeBytes={2 * 1024 * 1024}
            initialFileName={undefined}
            initialPreviewUrl={avatarPreviewUrl}
            onFileSelected={handleFile}
          />

          {/* Icon-only Remove avatar button (react-icons) */}
          <button
            type="button"
            onClick={handleRemoveAvatar}
            disabled={isDeletingAvatar}
            aria-label="Remove avatar"
            title="Remove avatar"
            className="inline-flex items-center justify-center py-3 px-2 rounded-md border-blue-400 border text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {isDeletingAvatar ? (
              <span className="text-sm">Removing...</span>
            ) : (
              <FiTrash2 className="h-5 w-5 " />
            )}
          </button>
        </div>

        {isUploadingImage && <div className="text-sm text-gray-500">Uploading image...</div>}
        {uploadError && <div className="text-sm text-red-500">{uploadError}</div>}
        {deleteError && <div className="text-sm text-red-500">{deleteError}</div>}
      </div>

      {/* Profile form */}
      <form onSubmit={onSubmit} className="p-6 pt-0 space-y-6">
        <Input
          className="p-2"
          id="name"
          label="Name"
          placeholder="Enter your name"
          {...register('name')}
          error={errors.name?.message}
        />

        <Input
          className="p-2"
          id="identifier"
          type="text"
          label="Email or Phone"
          placeholder="Enter your identifier"
          {...register('identifier')}
          error={errors.identifier?.message}
        />

        <Radio
          label="Gender"
          options={[
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
          ]}
          value={watch('gender')}
          changeHandler={(v) => setValue('gender', v)}
          error={errors.gender?.message}
        />

        <Input
          className="p-2"
          label="Age"
          type="number"
          placeholder="23"
          {...register('age', { valueAsNumber: true })}
          error={errors.age?.message}
        />

        <Button className="w-full" type="submit" loading={uploadingOrSubmitting}>
          Save
        </Button>
      </form>

      <button
        onClick={logout}
        className="mt-4 text-gray-400 flex items-center gap-2 hover:text-gray-600 font-semibold"
      >
        <IoIosLogOut />
        Logout
      </button>
    </>
  );
}
