import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import categoryServices from '@/features/categories/services';
import CreateCourseForm from '@/features/courses/components/CreateCourseForm';
import instructorServices from '@/features/instructors/services';
import { ICategoryResponse, IDataLoadedResponse, IInstructorResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';

export default function CreateCoursePage() {
  const { data: categoryResults, isLoading: categoriesLoading } = useQuery<IDataLoadedResponse<ICategoryResponse>>({
    queryKey: ['categories'],
    queryFn: () => categoryServices.list(),
  });

  const { data: instructorResults, isLoading: instructorsLoading } = useQuery<IDataLoadedResponse<IInstructorResponse>>(
    {
      queryKey: ['instructors'],
      queryFn: () => instructorServices.list(),
    },
  );

  return (
    <PageLayout title="Add new course">
      {instructorsLoading || categoriesLoading || !instructorResults?.data || !categoryResults?.data ? (
        <Loading />
      ) : (
        <CreateCourseForm categories={categoryResults.data} instructors={instructorResults.data} />
      )}
    </PageLayout>
  );
}
