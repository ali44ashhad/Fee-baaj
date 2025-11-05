import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import categoryServices from '@/features/categories/services';
import EditCourseForm from '@/features/courses/components/EditCourseForm';
import courseServices from '@/features/courses/services';
import instructorServices from '@/features/instructors/services';
import { ICategoryResponse, ICourseResponse, IDataLoadedResponse, IInstructorResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

export default function EditCoursePage() {
  const { id } = useParams();

  const { isLoading, data } = useQuery<ICourseResponse>({
    queryKey: ['course', id],
    queryFn: () => courseServices.read(id!),
    enabled: !!id,
    retry: false,
  });

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
    <PageLayout title="Edit course">
      {instructorsLoading ||
      categoriesLoading ||
      isLoading ||
      !data ||
      !instructorResults?.data ||
      !categoryResults?.data ? (
        <Loading />
      ) : (
        <EditCourseForm categories={categoryResults.data} instructors={instructorResults.data} course={data} />
      )}
    </PageLayout>
  );
}
