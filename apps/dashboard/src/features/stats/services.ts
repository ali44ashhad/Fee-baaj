import apiClient from '@/lib/apiClient';
import { IDashboardStatsResponse } from '@elearning/types';

const basePath = '/stats';

const list = async (): Promise<IDashboardStatsResponse> => {
  return await apiClient<IDashboardStatsResponse>(`${basePath}`);
};

const statServices = {
  list,
};

export default statServices;
