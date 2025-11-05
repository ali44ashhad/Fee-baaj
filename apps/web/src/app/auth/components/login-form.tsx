'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserAuthLoginSchema } from '@elearning/schemas';
import Input from '../../../components/ui/input';
import { useMutation } from '@tanstack/react-query';
import {
  IAuthLoginRequest,
  IAuthLoginResponse,
  IErrorResponse,
} from '@elearning/types';
import { loginUser } from '../actions';
import Button from '@/components/ui/button';

interface LoginFormProps {
  successCallback?: (data: IAuthLoginResponse) => void;
}

export default function LoginForm({ successCallback }: LoginFormProps) {
  const { mutate, isPending } = useMutation<
    IAuthLoginResponse,
    IErrorResponse,
    IAuthLoginRequest
  >({
    mutationFn: loginUser,
    onSuccess: (results) => {
      successCallback?.(results);
    },
    onError: (err) => {
      console.error('Login error:', err);
    },
  });

  const form = useForm<IAuthLoginRequest>({
    resolver: zodResolver(UserAuthLoginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const onSubmit = (values: IAuthLoginRequest) => {
    mutate(values);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="p-6 pt-0 h-full space-y-[3vh] box-border max-h-screen overflow-y-auto"
    >
      <Input
        id="identifier"
        type="text"
        label="What’s your email or phone?"
        placeholder="Enter your email or phone number"
        className="px-[clamp(1rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]"
        {...register('identifier')}
        error={errors.identifier?.message }
      />

      <Input
        id="password"
        type="password"
        label="Your password?"
        placeholder="Type your password"
        className="px-[clamp(1rem,2vw,4rem)] py-[clamp(0.7rem,1vh,2rem)]"
        {...register('password')}
        error={errors.password?.message}
      />

      <div className="text-center w-full mx-auto">
        <Button
          type="submit"
          loading={isPending}
          className="text-[clamp(1rem,3vw,2rem)] px-[clamp(1rem,3vw,3rem)] py-[clamp(0.45rem,1.5vh,1.15rem)] whitespace-nowrap text-center font-semibold rounded-full"
        >
          Free Login Now
        </Button>

        <div className="w-full text-center mt-1">
          <span className="text-md font-semibold text-primary">
            Forgot your password?
          </span>
        </div>
      </div>
    </form>
  );
}
