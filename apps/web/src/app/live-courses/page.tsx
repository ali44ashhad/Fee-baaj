import serverRequest from '@/lib/server-request';
import { ICourseResponse, IDataLoadedResponse } from '@elearning/types';
import CourseItem from '@/components/home-courseItem';

export default async function Home() {
  // Ensure API URL is defined
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('Missing NEXT_PUBLIC_API_URL environment variable');
  }

  // Fetch courses data from backend
  const coursesResponse = await serverRequest<IDataLoadedResponse<ICourseResponse>>('/courses/paid');
  const courses = coursesResponse.data || [];



  return (
    <main className="min-h-screen w-full bg-[url('/cover-homepage.webp')] bg-cover bg-center">
      <div className="max-w-5xl mx-auto lg:px-4 py-1 lg:py-3 space-y-6">
       {courses  ?  courses?.map((course, index) => (
            <CourseItem
              key={course.id}
              course={course}
              eagerLoad={index === 0}
            />
          )) : (
            <div className='text-lg text-red-600'> No live course found </div>
          )}
      </div>
    </main>
  );
}
