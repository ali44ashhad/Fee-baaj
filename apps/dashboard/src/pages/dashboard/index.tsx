import PageLayout from '@/components/Layout/PageLayout';
import Loading from '@/components/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import statServices from '@/features/stats/services';
import { IDashboardStatsResponse } from '@elearning/types';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Star, Users } from 'lucide-react';

export default function DasboardPage() {
  const { data, isLoading } = useQuery<IDashboardStatsResponse>({
    queryKey: ['stats'],
    queryFn: statServices.list,
  });

  return (
    <PageLayout title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loading /> : <div className="text-2xl font-bold">{data?.courses}</div>}
            <p className="text-xs text-muted-foreground mt-1">Active courses in platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loading /> : <div className="text-2xl font-bold">{data?.students}</div>}
            <p className="text-xs text-muted-foreground mt-1">Active registered students</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loading /> : <div className="text-2xl font-bold">{data?.reviews}</div>}
            <p className="text-xs text-muted-foreground mt-1">Approved reviews submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loading /> : <div className="text-2xl font-bold">{data?.enrollments}</div>}
            <p className="text-xs text-muted-foreground mt-1">Total courses enrollments</p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
