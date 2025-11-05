import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import courseServices from '@/features/courses/services';
import CreateReviewForm from '@/features/reviews/components/CreateReviewForm';
import userServices from '@/features/users/services';
import { ICourseResponse, IDataLoadedResponse, IUserResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';

export default function CreateReview() {
  // typed wrappers so useQuery knows the exact shape
  const fetchCourses = (): Promise<IDataLoadedResponse<ICourseResponse>> =>
    courseServices.list() as Promise<IDataLoadedResponse<ICourseResponse>>;

  const fetchUsers = (): Promise<IDataLoadedResponse<IUserResponse>> =>
    userServices.list() as Promise<IDataLoadedResponse<IUserResponse>>;

  const { data: courseResults, isLoading: coursesLoading } = useQuery<IDataLoadedResponse<ICourseResponse>, unknown>({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  });

  const { data: userResults, isLoading: usersLoading } = useQuery<IDataLoadedResponse<IUserResponse>, unknown>({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const loading = coursesLoading || usersLoading;

  return (
    <PageLayout title="New review">
      <Card className="p-5">
        {loading || !courseResults?.data || !userResults?.data ? (
          <Loading />
        ) : (
          <CreateReviewForm users={userResults.data} courses={courseResults.data} />
        )}
      </Card>
    </PageLayout>
  );
}
