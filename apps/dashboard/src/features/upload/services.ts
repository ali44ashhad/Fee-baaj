import apiClient from '@/lib/apiClient';
import { IUploadGetVideoUrlRequest, IUploadGetVideoUrlResponse, IUploadResponse } from '@elearning/types';
import { AxiosProgressEvent } from 'axios';

const basePath = '/upload';

const upload = async (file: File, onProgress: (p: AxiosProgressEvent) => void): Promise<IUploadResponse> => {
  const formData = new FormData();
  formData.append('picture', file);
  return await apiClient<IUploadResponse>(`${basePath}`, 'POST', formData, {
    onUploadProgress: onProgress,
  });
};

const getUploadUrl = async (inputs: IUploadGetVideoUrlRequest): Promise<IUploadGetVideoUrlResponse> => {
  return await apiClient<IUploadGetVideoUrlResponse>(`${basePath}/video/upload-url`, 'POST', inputs);
};

const uploadServices = {
  upload,
  getUploadUrl,
};

export default uploadServices;
