'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPasswordUpdateSchema } from '@elearning/schemas';
import Input from '@/components/ui/input';
import Radio from '@/components/ui/radio';
import { useMutation } from '@tanstack/react-query';
import {
  IUserProfileUpdateResponse,
  IErrorResponse,
  IUserRegisterRequest,
  IUserResponse,
  IUserProfileUpdateRequest,
  IUserPasswordUpdateResponse,
  IUserPasswordUpdateRequest,
} from '@elearning/types';
import Button from '@/components/ui/button';
import { updatePassword, updateProfile } from '../actions';
import { useAuth } from '@/hooks/use-auth';

interface UpdatePasswordFormProps {
  user: IUserResponse;
}

export default function UpdatePasswordForm({ user }: UpdatePasswordFormProps) {
  const { mutate: mutateAuth } = useAuth();
  const { mutate, isPending } = useMutation<IUserPasswordUpdateResponse, IErrorResponse, IUserPasswordUpdateRequest>({
    mutationFn: updatePassword,
    onSuccess: () => {
      mutateAuth();
    },
  });

  const form = useForm<IUserPasswordUpdateRequest>({
    resolver: zodResolver(UserPasswordUpdateSchema),
    defaultValues: {
      currentPassword: '',
      password: '',
    },
  });

  const { register, getValues, setValue, handleSubmit, watch } = form;

  const { errors } = form.formState;

  const onSubmit = (values: IUserPasswordUpdateRequest) => {
    console.log(values);
    mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-0 space-y-6">
      <Input
        id="currentPassword"
        type="currentPassword"
        label="Current password"
        placeholder="Enter your current password"
        className='px-[clamp(2rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]'
        {...register('currentPassword')}
        error={errors.currentPassword?.message}
      />
      <Input
        id="password"
        type="password"
        className='px-[clamp(2rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]'
        label="New password"
        placeholder="Enter your new password"
        {...register('password')}
        error={errors.password?.message}
      />
      <Button className='w-full' type="submit" loading={isPending}>
        Save
      </Button>
    </form>
  );
}
