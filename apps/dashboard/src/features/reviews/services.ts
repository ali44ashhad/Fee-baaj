import apiClient from '@/lib/apiClient';
import {
  IReviewDeleteResponse,
  IReviewResponse,
  IReviewSaveRequest,
  IReviewSaveResponse,
  IDataLoadedResponse,
} from '@elearning/types';

const basePath = '/reviews';

const create = async (inputs: IReviewSaveRequest): Promise<IReviewSaveResponse> => {
  return await apiClient<IReviewSaveResponse, IReviewSaveRequest>(`${basePath}`, 'POST', inputs);
};

const update = async (id: string, inputs: IReviewSaveRequest): Promise<IReviewSaveResponse> => {
  return await apiClient<IReviewSaveResponse, IReviewSaveRequest>(`${basePath}/${id}`, 'PUT', inputs);
};

const read = async (id: string): Promise<IReviewResponse> => {
  return await apiClient<IReviewResponse>(`${basePath}/${id}`);
};

const list = async (
  filters: {
    page: number;
    search: string;
  } = { page: 1, search: '' },
): Promise<IDataLoadedResponse<IReviewResponse>> => {
  return await apiClient<IDataLoadedResponse<IReviewResponse>>(
    `${basePath}?page=${filters.page}&search=${filters.search}`,
  );
};

const remove = async (id: string): Promise<IReviewDeleteResponse> => {
  return await apiClient<IReviewDeleteResponse>(`${basePath}/${id}`, 'DELETE');
};

const reviewServices = {
  create,
  update,
  read,
  list,
  remove,
};

export default reviewServices;
