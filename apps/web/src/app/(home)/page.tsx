// app/(public)/home/page.tsx
import serverRequest from '@/lib/server-request';
import { ICourseResponse, IDataLoadedResponse } from '@elearning/types';
import CourseItem from '@/components/home-courseItem';

export default async function Home() {
  // Fetch courses data from backend (same as before)
  const coursesResponse = await serverRequest<IDataLoadedResponse<ICourseResponse>>('/courses');
  const courses = coursesResponse.data || [];

  // Map courses to include playlistUrl derived from course.videoStatus.playbackUrl


  return (
    <main className="min-h-screen w-full bg-[url('/cover-homepage.webp')] bg-repeat bg-center">
      <div className="max-w-5xl mx-auto lg:px-4 py-1 lg:py-3 space-y-6">
        {courses.length > 0 ? (
          courses.map((course, index) => (
            <CourseItem key={course.id} course={course} eagerLoad={index === 0} />
          ))
        ) : (
          <div className="text-center py-8">Loading courses...</div>
        )}
      </div>
    </main>
  );
}