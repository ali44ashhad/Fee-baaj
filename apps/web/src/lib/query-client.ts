import { keepPreviousData, MutationCache, QueryClient } from '@tanstack/react-query';
import { errorAlert, successAlert } from './utils';

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (data: any) => {
      if (data?.message) {
        successAlert(data?.message);
      }
    },
    onError: (error: any) => {
      //console.error('error #1: ', JSON.parse(error));
      //console.error('error #2: ', JSON.parse(error.message));
      const message = error.message || 'Error occurred';
      errorAlert(message);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      placeholderData: keepPreviousData,
    },
  },
});

export default queryClient;
