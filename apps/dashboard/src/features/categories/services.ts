import apiClient from '@/lib/apiClient';
import {
  ICategoryDeleteResponse,
  ICategoryResponse,
  ICategorySaveRequest,
  ICategorySaveResponse,
  IDataLoadedResponse,
} from '@elearning/types';

const basePath = '/categories';

const create = async (inputs: ICategorySaveRequest): Promise<ICategorySaveResponse> => {
  return await apiClient<ICategorySaveResponse, ICategorySaveRequest>(`${basePath}`, 'POST', inputs);
};

const update = async (id: string, inputs: ICategorySaveRequest): Promise<ICategorySaveResponse> => {
  return await apiClient<ICategorySaveResponse, ICategorySaveRequest>(`${basePath}/${id}`, 'PUT', inputs);
};

const read = async (id: string): Promise<ICategoryResponse> => {
  return await apiClient<ICategoryResponse>(`${basePath}/${id}`);
};

const list = async (
  filters: {
    page: number;
    search: string;
  } = { page: 1, search: '' },
): Promise<IDataLoadedResponse<ICategoryResponse>> => {
  return await apiClient<IDataLoadedResponse<ICategoryResponse>>(
    `${basePath}?page=${filters.page}&search=${filters.search}`,
  );
};

const remove = async (id: string): Promise<ICategoryDeleteResponse> => {
  return await apiClient<ICategoryDeleteResponse>(`${basePath}/${id}`, 'DELETE');
};

const categoryServices = {
  create,
  update,
  read,
  list,
  remove,
};

export default categoryServices;
