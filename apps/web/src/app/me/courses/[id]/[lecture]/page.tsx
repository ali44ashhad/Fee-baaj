import serverRequest from '@/lib/server-request';
import { ICourseResponse } from '@elearning/types';
import MobileViewCourseDetails from './components/mobile-view';
import DesktopViewCourseDetails from './components/desktop-view';
import { redirect } from 'next/navigation';
import webRoutes from '@/lib/webRoutes';

interface PageProps {
  params: Promise<{
    id: string;
    lecture: string;
  }>;
}

export default async function CourseLecture({ params }: PageProps) {
  const { id, lecture } = await params;
  const course = await serverRequest<ICourseResponse>(`/courses/${id}`);

  if (course.enrollment && !course.enrollment.unlocked) {
    return redirect(webRoutes.myCourse(course.id));
  }

  return (
    <>
      <div className="hidden md:block">
        <DesktopViewCourseDetails course={course} />
      </div>
      <div className="md:hidden">
        <MobileViewCourseDetails course={course} />
      </div>
    </>
  );
}
