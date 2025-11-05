// src/features/users/services.ts
import apiClient from '@/lib/apiClient';
import {
  IUserDeleteResponse,
  IUserResponse,
  IUserSaveRequest,
  IUserSaveResponse,
  IDataLoadedResponse,
} from '@elearning/types';

const basePath = '/users';
const pathMedia = import.meta.env.VITE_MEDIA_API_URL || '';

const create = async (inputs: IUserSaveRequest): Promise<IUserSaveResponse> => {
  return await apiClient<IUserSaveResponse, IUserSaveRequest>(`${basePath}`, 'POST', inputs);
};

const update = async (id: string, inputs: IUserSaveRequest): Promise<IUserSaveResponse> => {
  return await apiClient<IUserSaveResponse, IUserSaveRequest>(`${basePath}/${id}`, 'PUT', inputs);
};

const read = async (id: string): Promise<IUserResponse> => {
  return await apiClient<IUserResponse>(`${basePath}/${id}`);
};

const list = async (
  filters: {
    page: number;
    search: string;
  } = { page: 1, search: '' },
): Promise<IDataLoadedResponse<IUserResponse>> => {
  const qs = `?page=${filters.page}&search=${encodeURIComponent(filters.search || '')}`;
  return await apiClient<IDataLoadedResponse<IUserResponse>>(`${basePath}${qs}`);
};

const remove = async (id: string): Promise<IUserDeleteResponse> => {
  return await apiClient<IUserDeleteResponse>(`${basePath}/${id}`, 'DELETE');
};

/**
 * Delete user image(s) via media server admin delete endpoint.
 * When deleting by prefix, the media server will in turn call your admin webhook
 * (/internal/images/deleted) which clears DB fields for the user.
 *
 * @param userId - the user id (required)
 * @param key - optional single S3 key to delete (if omitted, entire prefix removed)
 */
const deleteImage = async (userId: string, key?: string): Promise<any> => {
  if (!userId) throw new Error('userId required');

  if (!pathMedia) {
    throw new Error('MEDIA API base URL (VITE_MEDIA_API_URL) not configured');
  }

  const url = `${pathMedia.replace(/\/$/, '')}/images/delete`;

  const payload: any = { targetType: 'users', targetId: userId };
  if (key) payload.key = key;

  // Use apiClient so it can attach cookies/auth headers as configured
  return await apiClient(url, 'POST', payload);
};

const userServices = {
  create,
  update,
  read,
  list,
  remove,
  deleteImage,
};

export default userServices;
