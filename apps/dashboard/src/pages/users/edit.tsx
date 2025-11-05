import Layout from '@/components/Layout';
import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EditUserForm from '@/features/users/components/EditUserForm';
import userServices from '@/features/users/services';
import { IUserResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

export default function EditUser() {
  const { id } = useParams();

  const { isLoading, isError, data, isSuccess } = useQuery<IUserResponse>({
    queryKey: ['user', id],
    queryFn: () => userServices.read(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <PageLayout title="Edit user">
      <Card className="p-5">{isLoading || !data ? <Loading /> : <EditUserForm user={data} />}</Card>
    </PageLayout>
  );
}
