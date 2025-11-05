import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import webRoutes from '@/lib/webRoutes';
import { IErrorResponse, IResponse, IAuthLoginRequestAdmin, IAuthLoginResponse, IAdminResponse } from '@elearning/types';
import { AdminAuthLoginSchema, } from '@elearning/schemas';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import authServices from '../services';
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from '@tanstack/react-query';

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const { mutate, isPending } = useMutation<IAdminResponse, IErrorResponse, IAuthLoginRequestAdmin>({
    mutationFn: authServices.login,
    onSuccess: (results) => {
      login(results);
      navigate(webRoutes.dashboard);
    },
  });

  const onSubmit = (values: IAuthLoginRequestAdmin) => {
    mutate(values);
  };

  const form = useForm<IAuthLoginRequestAdmin>({
    resolver: zodResolver(AdminAuthLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { register, handleSubmit } = form;

  const { errors } = form.formState;
  return (
    <Card className="mx-auto max-w-md w-[400px]">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>Enter your email below to login to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4">
            <div className="grid gap-2 text-left">
              <Input
                id="email"
                label="Email"
                type="email"
                placeholder="m@example.com"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>

            <div className="grid gap-2 text-left">
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="******"
                {...register('password')}
                error={errors.password?.message}
              />
            </div>

            <Button type="submit" className="w-full" loading={isPending}>
              Login
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
