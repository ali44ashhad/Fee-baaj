import apiClient from '@/lib/apiClient';
import {
  ICourseDeleteResponse,
  ICourseResponse,
  ILectureSaveRequest,
  ILectureSaveResponse,
  IChapterSaveRequest,
  IChapterSaveResponse,
  IDataLoadedResponse,
  IChapterUpdateRequest,
  IChapterUpdateResponse,
} from '@elearning/types';

const basePath = '/chapters';

const create = async (inputs: IChapterSaveRequest): Promise<IChapterSaveResponse> => {
  return await apiClient<IChapterSaveResponse, IChapterSaveRequest>(`${basePath}`, 'POST', inputs);
};

const update = async (id: string, inputs: IChapterUpdateRequest): Promise<IChapterUpdateResponse> => {
  return await apiClient<IChapterUpdateResponse, IChapterUpdateRequest>(`${basePath}/${id}`, 'PUT', inputs);
};

const read = async (id: string): Promise<ICourseResponse> => {
  return await apiClient<ICourseResponse>(`${basePath}/${id}`);
};

const list = async (
  filters: {
    page: number;
    search: string;
  } = { page: 1, search: '' },
): Promise<IDataLoadedResponse<ICourseResponse>> => {
  return await apiClient<IDataLoadedResponse<ICourseResponse>>(
    `${basePath}?page=${filters.page}&search=${filters.search}`,
  );
};

const remove = async (id: string): Promise<ICourseDeleteResponse> => {
  return await apiClient<ICourseDeleteResponse>(`${basePath}/${id}`, 'DELETE');
};

const addLecture = async (chapterId: string, inputs: ILectureSaveRequest): Promise<ILectureSaveResponse> => {
  return await apiClient<ILectureSaveResponse, ILectureSaveRequest>(
    `${basePath}/${chapterId}/lectures`,
    'POST',
    inputs,
  );
};

const updateLecture = async (
  chapterId: string,
  lectureId: string,
  formData: FormData,                      // ← change here
): Promise<ILectureSaveResponse> => {
  return apiClient<
    ILectureSaveResponse,                  // T
    FormData                               // R
  >(
    `${basePath}/${chapterId}/lectures/${lectureId}`,
    'PUT',
    formData
  );
};

const removeLecture = async (id: string, lectureId: string): Promise<ICourseDeleteResponse> => {
  return await apiClient<ICourseDeleteResponse>(`${basePath}/${id}/lectures/${lectureId}`, 'DELETE');
};

const chapterServices = {
  create,
  update,
  read,
  list,
  remove,
  addLecture,
  updateLecture,
  removeLecture,
};

export default chapterServices;
