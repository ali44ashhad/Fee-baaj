import PageLayout from '@/components/Layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateCategoryForm from '@/features/categories/components/CreateCategoryForm';

export default function CreateReview() {
  return (
    <PageLayout title="New category">
      <Card className="p-5">
        <CreateCategoryForm />
      </Card>
    </PageLayout>
  );
}
