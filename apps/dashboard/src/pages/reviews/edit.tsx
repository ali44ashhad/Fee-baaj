import Layout from '@/components/Layout';
import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EditReviewForm from '@/features/reviews/components/EditReviewForm';
import reviewServices from '@/features/reviews/services';
import { IReviewResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

export default function EditReview() {
  const { id } = useParams();

  const { isLoading, isError, data, isSuccess } = useQuery<IReviewResponse>({
    queryKey: ['review', id],
    queryFn: () => reviewServices.read(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <PageLayout title="Edit review">
      <Card className="p-5">{isLoading || !data ? <Loading /> : <EditReviewForm review={data} courses={[]} users={[]} />}</Card>
    </PageLayout>
  );
}
