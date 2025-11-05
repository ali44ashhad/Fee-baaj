import axios, { AxiosError, AxiosRequestConfig, Method } from 'axios';
import axiosInstance from './axiosConfig';
import { IResponse } from '@elearning/types';



const apiClient = async <T, R = unknown>(
  url: string,
  method: Method = 'GET',
  data?: R,
  params?: Record<string, any>,   // 👈 added explicit params
  options?: AxiosRequestConfig,
): Promise<T> => {
  try {
    const response = await axiosInstance<IResponse<T, R>>({
      method,
      url,
      data,
      params, // 👈 pass params to axios
      ...options,
    });
    return response.data.results;
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      const data = err.response?.data as IResponse<T, R>;
      throw data.results || err.message;
    }
    throw err;
  }
};

export default apiClient;
