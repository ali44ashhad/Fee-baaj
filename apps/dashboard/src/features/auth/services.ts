import apiClient from '@/lib/apiClient';
import { IAuthLoginRequest, IAuthLoginResponse, IAuthLogoutResponse, IAdminResponse } from '@elearning/types';

const basePath = '/auth';

const login = async (inputs: IAuthLoginRequest): Promise<IAdminResponse> => {
  return await apiClient<IAdminResponse, IAuthLoginRequest>(`${basePath}/login`, 'POST', inputs);
};

const logout = async (): Promise<IAuthLogoutResponse> => {
  return await apiClient<IAuthLogoutResponse>(`${basePath}/logout`, 'POST');
};

const check = async (): Promise<IAdminResponse> => {
  return await apiClient<IAdminResponse>(`${basePath}/check`, 'GET');
};

const authServices = {
  login,
  logout,
  check,
};

export default authServices;
