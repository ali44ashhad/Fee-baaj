import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card } from '@/components/ui/card';
import EditSettingForm from '@/features/settings/components/EditSettingForm';
import settingServices from '@/features/settings/services';
import { ISettingResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

export default function EditSetting() {
  const { isLoading, isError, data, isSuccess } = useQuery<ISettingResponse>({
    queryKey: ['setting'],
    queryFn: () => settingServices.read(),
    enabled: true,
    retry: false,
  });

  return (
    <PageLayout title="Edit category">
      <div>{isLoading || !data ? <Loading /> : <EditSettingForm setting={data} />}</div>
    </PageLayout>
  );
}
