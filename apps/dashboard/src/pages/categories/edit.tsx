import Layout from '@/components/Layout';
import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateCategoryForm from '@/features/categories/components/CreateCategoryForm';
import EditCategoryForm from '@/features/categories/components/EditCategoryForm';
import categoryServices from '@/features/categories/services';
import { ICategoryResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

export default function EditCategory() {
  const { id } = useParams();

  const { isLoading, isError, data, isSuccess } = useQuery<ICategoryResponse>({
    queryKey: ['category', id],
    queryFn: () => categoryServices.read(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <PageLayout title="Edit category">
      <Card className="p-5">{isLoading || !data ? <Loading /> : <EditCategoryForm category={data} />}</Card>
    </PageLayout>
  );
}
