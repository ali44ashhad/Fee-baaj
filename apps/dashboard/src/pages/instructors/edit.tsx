import Layout from '@/components/Layout';
import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card } from '@/components/ui/card';
import EditInstructorForm from '@/features/instructors/components/EditInstructorForm';
import instructorServices from '@/features/instructors/services';
import { IInstructorResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

export default function EditInstructor() {
  const { id } = useParams();

  const { isLoading, data } = useQuery<IInstructorResponse>({
    queryKey: ['instructor', id],
    queryFn: () => instructorServices.read(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <PageLayout title="Edit instructor">
      <Card className="p-5">{isLoading || !data ? <Loading /> : <EditInstructorForm instructor={data} />}</Card>
    </PageLayout>
  );
}
