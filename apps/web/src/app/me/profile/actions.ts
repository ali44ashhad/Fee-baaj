'use server';

import serverRequest from '@/lib/server-request';
import {
  IUserProfileUpdateRequest,
  IUserProfileUpdateResponse,
  IUserPasswordUpdateRequest,
  IUserPasswordUpdateResponse,
} from '@elearning/types';

export async function updateProfile(formData: FormData): Promise<IUserProfileUpdateResponse> {
  const responseData = await serverRequest<
    IUserProfileUpdateResponse,
    FormData
  >('/user', 'PUT', formData);
  return responseData;
}

export async function updatePassword(values: IUserPasswordUpdateRequest): Promise<IUserPasswordUpdateResponse> {
  const responseData = await serverRequest<IUserPasswordUpdateResponse, IUserPasswordUpdateRequest>(
    '/password',
    'PUT',
    values,
  );
  return responseData;
}
