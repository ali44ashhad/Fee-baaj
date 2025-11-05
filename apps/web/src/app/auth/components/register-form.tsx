'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserRegisterSchema } from '@elearning/schemas';
import Input from '../../../components/ui/input';
import Radio from '../../../components/ui/radio';
import { useMutation } from '@tanstack/react-query';
import type { IAuthLoginResponse, IErrorResponse, IUserRegisterRequest } from '@elearning/types';
import { registerUser } from '../actions';
import Button from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { getDeviceFingerprint, isPWA } from '@/lib/device-fingerprint';

import UploadImageButton from '@/components/ui/UploadImageButton';

type AuthMode = 'login' | 'signup' | null;

interface RegisterFormProps {
  successCallback?: (data: IAuthLoginResponse) => void;
  setAuthMode: (mode: AuthMode) => void;
}

/**
 * MEDIA_URL fallback: prefer explicit media server url, else use API url
 * Ensure you set NEXT_PUBLIC_MEDIA_API_URL in your .env for the client.
 */
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || '';

export default function RegisterForm({ successCallback, setAuthMode }: RegisterFormProps) {
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState<string | null>(searchParams.get('ref') || null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');

  // Keep track of avatar file + preview
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);

  // react-hook-form setup
  const form = useForm<IUserRegisterRequest>({
    resolver: zodResolver(UserRegisterSchema),
    defaultValues: {
      name: '',
      identifier: '',
      password: '',
      gender: undefined,
      age: undefined,
      isPWA: false,
      fingerprint: '',
      referralSourceCode: referralCode || '',
      avatar: undefined,
    },
  });
  const { register, setValue, watch, handleSubmit, getValues, formState } = form;
  const { errors } = formState;

  // Prevent races before react-query `isLoading` becomes true
  const submittingRef = useRef(false);

  // Now the mutation expects a JSON payload (not FormData).
  // Keep variable name `isPending` so your JSX doesn't change.
  const { mutate, isLoading: isPending } = useMutation<IAuthLoginResponse, IErrorResponse, any>({
    mutationFn: (payload) => registerUser(payload),
    onSuccess: successCallback,
  });

  // — PWA & device fingerprint logic —
  useEffect(() => {
    (async () => {
      const pwa = isPWA();
      setIsPwaInstalled(pwa);
      const fp = await getDeviceFingerprint();
      setDeviceFingerprint(fp);
      setValue('isPWA', pwa);
      setValue('fingerprint', fp);
    })();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const pwa = isPWA();
        setIsPwaInstalled(pwa);
        setValue('isPWA', pwa);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [setValue]);

  // — Referral code logic —
  useEffect(() => {
    const urlRef = searchParams.get('ref');
    const localRef = localStorage.getItem('pendingReferralCode');
    const sessRef = sessionStorage.getItem('pendingReferralCode');
    const code = urlRef || localRef || sessRef;
    if (code && !referralCode) {
      setReferralCode(code);
      setValue('referralSourceCode', code);
      if (localRef) localStorage.removeItem('pendingReferralCode');
      if (sessRef) sessionStorage.removeItem('pendingReferralCode');
    }
  }, [searchParams, referralCode, setValue]);

  /**
   * Upload avatar to Media Server
   * Returns { key, url } on success.
   *
   * NOTE: because this is the registration flow and there's no userId yet,
   * we use the device fingerprint as a temporary targetId. For a more robust
   * production flow you can choose to register first (without avatar) then upload.
   */
  async function uploadAvatarToMediaServer(file: File) {
    if (!MEDIA_URL) throw new Error('MEDIA_URL not configured (NEXT_PUBLIC_MEDIA_API_URL)');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetType', 'users');
    // use fingerprint as temporary id — ensures uniqueness per-device
    formData.append('targetId', String(deviceFingerprint || `temp-${Date.now()}`));
    formData.append('uploader', 'user');

    const resp = await fetch(`${MEDIA_URL.replace(/\/$/, '')}/image/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include', // adjust if you use token-based auth
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(txt || `Upload failed with status ${resp.status}`);
    }

    const json = await resp.json();
    // Accept either { ok:true, key, url } or { key, url }
    const key = json.key ?? json.data?.key;
    const url = json.url ?? json.data?.url;
    if (!key) throw new Error('Media server did not return an image key');
    return { key, url };
  }

  // Build payload and submit (upload avatar first if present)
  const onSubmit = handleSubmit(async () => {
    // Guard: prevent double submission (covers very fast double-click before isPending updates)
    if (isPending || submittingRef.current) return;
    submittingRef.current = true;

    const fp = deviceFingerprint || (await getDeviceFingerprint());
    const pwa = isPWA();

    const vals = getValues();
    // Build JSON payload for User API
    const payload: any = {
      name: vals.name,
      identifier: vals.identifier,
      password: vals.password,
      gender: vals.gender,
      age: typeof vals.age === 'number' ? Number(vals.age) : undefined,
      isPWA: Boolean(pwa),
      fingerprint: fp,
      referralSourceCode: referralCode || '',
    };

    // If a new avatar was selected, upload it first to Media Server
    if (avatarFile instanceof File) {
      try {
        const { key, url } = await uploadAvatarToMediaServer(avatarFile);
        payload.pictureId = key;
        if (url) payload.pictureUrl = url;
      } catch (e) {
        // Upload failed — log & continue without avatar, or you can abort
        console.error('Avatar upload failed:', (e as Error).message || e);
        // Decision: allow registration to continue without avatar (keeps UX smooth)
        // If you'd rather abort, uncomment next line:
        // submittingRef.current = false; return;
      }
    }

    // For debugging parity with previous code that logged FormData entries,
    // we log payload key/values here.
    for (const k of Object.keys(payload)) {
      // eslint-disable-next-line no-console
      console.log(`${k}: ${payload[k]}`);
    }

    // Call registerUser (expects JSON payload now)
    // pass an onSettled override to reset the submittingRef in all cases
    mutate(payload, {
      onSettled: () => {
        submittingRef.current = false;
      },
    });
  });

  // Callback from UploadImageButton
  const handleFile = (file: File) => {
    const preview = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl(preview);
    setAvatarFileName(file.name);
    // For validation, store it in RHF state (optional)
    setValue('avatar', file as any);
  };

  // ---------------------------
  // NAME FIELD: allow spaces (only normalize on blur/paste)
  // ---------------------------

  const nameReg = register('name');

  const normalizeName = (s: string) =>
    String(s ?? '')
      .replace(/[\u0000-\u001F\u007F]+/g, '') // remove control chars
      .trim()
      .replace(/\s+/g, ' ');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = (e.target.value ?? '').replace(/[\u0000-\u001F\u007F]+/g, '');
    if (typeof nameReg.onChange === 'function') {
      nameReg.onChange({ ...e, target: { ...e.target, value: raw } } as unknown as Event);
    }
  };

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalized = normalizeName((e.target as HTMLInputElement).value ?? '');
    if (typeof nameReg.onChange === 'function') {
      nameReg.onChange({ ...e, target: { ...e.target, value: normalized } } as unknown as Event);
    }
    if (typeof nameReg.onBlur === 'function') {
      nameReg.onBlur(e as unknown as Event);
    }
  };

  const handleNamePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData('text') ?? '';
    const normalized = normalizeName(text);
    if (typeof nameReg.onChange === 'function') {
      nameReg.onChange({ target: { value: normalized } } as unknown as Event);
    }
  };

  // keydown capture to allow space in inputs (best-effort)
  useEffect(() => {
    const onKeyDownCapture = (ev: KeyboardEvent) => {
      try {
        if (ev.key !== ' ' && ev.code !== 'Space' && ev.keyCode !== 32) return;
        const active = document.activeElement;
        if (!active) return;
        const isTextInput =
          (active.tagName === 'INPUT' &&
            (active as HTMLInputElement).type !== 'checkbox' &&
            (active as HTMLInputElement).type !== 'radio' &&
            (active as HTMLInputElement).type !== 'range' &&
            (active as HTMLInputElement).type !== 'button' &&
            (active as HTMLInputElement).type !== 'submit') ||
          active.tagName === 'TEXTAREA';
        if (!isTextInput) return;
        // If you want to only allow for name input: uncomment next line
        // if ((active as HTMLElement).id !== 'name') return;
        ev.stopImmediatePropagation();
      } catch {
        // ignore
      }
    };
    window.addEventListener('keydown', onKeyDownCapture, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDownCapture, { capture: true });
  }, []);

  return (
    // We do NOT rely on the native <form> serialization of names. handleSubmit prevents default.
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-[1vh] p-[clamp(1rem,2vw,2rem)] text-[clamp(0.75rem,1.5vh,1rem)] box-border max-h-screen"
    >
      <div className="flex items-end justify-start gap-2">
        {/* “name” field is registered explicitly, so RHF sets <input name="name" … /> */}
        <Input
          id="name"
          label="What's your name?"
          placeholder="Enter your name (e.g. Jhon Do)"
          {...nameReg}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          onPaste={handleNamePaste}
          error={errors.name?.message}
          className="px-[clamp(2rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]"
          disabled={isPending}
        />

        <UploadImageButton
          buttonLabel="Avatar"
          maxSizeBytes={2 * 1024 * 1024}
          initialFileName={avatarFileName || undefined}
          initialPreviewUrl={avatarPreviewUrl || undefined}
          onFileSelected={handleFile}
          disabled={isPending}
        />
      </div>

      <div className="">
        <span className="font-semibold text-[5vw] sm:text-[clamp(0.5rem,3vh,29px)] text-gray-900">Gender & Age</span>
        <div className="flex items-center justify-between gap-[clamp(0.3rem,1vw,0.5rem)]">
          <Radio
            options={[{ label: 'Male', value: 'male' }]}
            value={watch('gender')}
            changeHandler={(v) => setValue('gender', v)}
            error={errors.gender?.message}
            className="w-full"
            disabled={isPending}
          />
          <Radio
            options={[{ label: 'Female', value: 'female' }]}
            value={watch('gender')}
            changeHandler={(v) => setValue('gender', v)}
            error={errors.gender?.message}
            className="w-full"
            disabled={isPending}
          />

          <div className="relative w-full flex">
            <select
              id="age"
              defaultValue=""
              {...register('age', { valueAsNumber: true })}
              disabled={isPending}
              className={clsx(
                'w-full px-[clamp(0.6rem,2vw,1rem)] py-[clamp(0.8rem,1vh,2rem)]',
                'rounded-[19px] text-center appearance-none outline-none',
                errors.age
                  ? 'border border-red-400 focus:border-red-600'
                  : watch('age')
                  ? 'border border-yellow-400 focus:border-yellow-600'
                  : 'border border-blue-400 focus:border-blue-600',
              )}
            >
              <option value="" disabled hidden />
              {Array.from({ length: 90 - 13 + 1 }, (_, i) => 13 + i).map((n) => (
                <option key={n} value={n} className="text-gray-700 text-lg">
                  {n}
                </option>
              ))}
            </select>
            <label
              htmlFor="age"
              className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500"
            >
              {watch('age') ? '' : 'Age'}
            </label>
          </div>
        </div>
      </div>

      <Input
        id="email"
        type="text"
        label="What’s your email/phone?"
        placeholder="Enter your email/phone number"
        {...register('identifier')}
        error={errors.identifier?.message}
        className="px-[clamp(2rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]"
        disabled={isPending}
      />

      <Input
        id="password"
        type="password"
        label="What's your password?"
        placeholder="Enter your password"
        {...register('password')}
        error={errors.password?.message}
        className="px-[clamp(2rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]"
        disabled={isPending}
      />

      {referralCode && (
        <div className="bg-muted p-[clamp(0.75rem,1.5vw,1rem)] rounded-md text-[clamp(0.75rem,1.25vw,0.875rem)]">
          <p className="font-medium">Referral code applied: {referralCode}</p>
          {isPwaInstalled ? (
            <p className="text-green-600 mt-1">✓ PWA installation detected</p>
          ) : (
            <p className="text-amber-600 mt-1">⚠️ For full referral benefits, please install the app</p>
          )}
        </div>
      )}

      <div className="w-full text-center">
        <Button
          type="submit"
          loading={isPending}
          disabled={isPending}
          aria-busy={isPending}
          className="
            rounded-full
            mx-auto
            whitespace-nowrap
            text-white
            mt-3
            text-[clamp(17px,2vw,30px)]
            px-[clamp(1rem,3vw,3rem)]
            py-[clamp(0.45rem,1vh,1.15rem)]
          "
        >
          {isPending ? (
            <>
              <svg
                className="inline-block animate-spin mr-2 w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              Creating…
            </>
          ) : (
            'Create Free Account'
          )}
        </Button>
        <p onClick={() => setAuthMode('login')} className="text-primary cursor-pointer mt-1 font-semibold text-lg">
          Log In Now
        </p>
      </div>
    </form>
  );
}
