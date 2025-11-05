import apiClient from '@/lib/apiClient';
import { ISettingResponse, ISettingSaveRequest, ISettingSaveResponse } from '@elearning/types';

const basePath = '/settings';

const update = async (inputs: ISettingSaveRequest): Promise<ISettingSaveResponse> => {
  return await apiClient<ISettingSaveResponse, ISettingSaveRequest>(`${basePath}`, 'PUT', inputs);
};

const read = async (): Promise<ISettingResponse> => {
  return await apiClient<ISettingResponse>(`${basePath}`);
};

const settingServices = {
  update,
  read,
};

export default settingServices;
