'use server';

import serverRequest from '@/lib/server-request';
import { IUserRegisterRequest, IAuthLoginResponse, IUserResponse, IAuthLoginRequest } from '@elearning/types';

export async function registerUser(formData: FormData): Promise<IAuthLoginResponse> {
  
  const responseData = await serverRequest<
    IAuthLoginResponse,
    FormData
  >('/auth/register', 'POST', formData);
  return responseData;
}

export async function checkAuth(): Promise<IUserResponse> {
  const responseData = await serverRequest<IUserResponse>('/auth/check');
  return responseData;
}

export async function loginUser(values: IAuthLoginRequest): Promise<IAuthLoginResponse> {
  try {
    const responseData = await serverRequest<IAuthLoginResponse, IAuthLoginRequest>('/auth/login', 'POST', values);
    return responseData;
  } catch (err: any) {
    throw err.message;
  }
}

export async function logoutUser(): Promise<void> {
  await serverRequest<void>('/auth/logout', 'POST');
}