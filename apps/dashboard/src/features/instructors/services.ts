// src/features/instructors/services.ts
import apiClient from '@/lib/apiClient';
import {
  IInstructorDeleteResponse,
  IInstructorResponse,
  IInstructorSaveRequest,
  IInstructorSaveResponse,
  IDataLoadedResponse,
} from '@elearning/types';

const basePath = '/instructors';
const pathMedia = import.meta.env.VITE_MEDIA_API_URL || '';

const create = async (payload: any): Promise<IInstructorSaveResponse> => {
  const result = await apiClient<IInstructorSaveResponse>(basePath, 'POST', payload);
  return result;
};

const update = async (id: string, inputs: FormData): Promise<IInstructorSaveResponse> => {
  return await apiClient<IInstructorSaveResponse, FormData>(`${basePath}/${id}`, 'PUT', inputs);
};

const read = async (id: string): Promise<IInstructorResponse> => {
  return await apiClient<IInstructorResponse>(`${basePath}/${id}`);
};

const list = async (
  filters: {
    page: number;
    search: string;
  } = { page: 1, search: '' },
): Promise<IDataLoadedResponse<IInstructorResponse>> => {
  return await apiClient<IDataLoadedResponse<IInstructorResponse>>(
    `${basePath}?page=${filters.page}&search=${filters.search}`,
  );
};

const remove = async (id: string): Promise<IInstructorDeleteResponse> => {
  return await apiClient<IInstructorDeleteResponse>(`${basePath}/${id}`, 'DELETE');
};
 
/**
 * Delete all images under the instructor prefix (images/instructors/<id>/)
 * or optionally delete a single key (if `key` provided).
 *
 * Calls the MEDIA API's admin delete endpoint which will in turn call the admin webhook
 * to clear DB fields. Ensure apiClient is configured with proper auth headers if the
 * media server requires an admin token.
 *
 * @param instructorId ID of the instructor
 * @param key optional single S3 key to delete (if omitted, entire prefix removed)
 */
const deleteImage = async (instructorId: string, key?: string): Promise<any> => {
  if (!instructorId) throw new Error('instructorId required');

  if (!pathMedia) {
    throw new Error('MEDIA API base URL (VITE_MEDIA_API_URL) not configured');
  }

  const url = `${pathMedia.replace(/\/$/, '')}/images/delete`;

  const payload: any = { targetType: 'instructors', targetId: instructorId };
  if (key) payload.key = key;

  // Use apiClient so it can attach cookies/auth headers as configured
  return await apiClient(url, 'POST', payload);
};

const instructorServices = {
  create,
  update,
  read,
  list, 
  remove,
  deleteImage,
};

export default instructorServices;
