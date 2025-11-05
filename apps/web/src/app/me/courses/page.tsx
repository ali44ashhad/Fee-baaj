import { CourseCard } from '@/components/course-card';
import serverRequest from '@/lib/server-request';
import { ICourseResponse, IDataLoadedResponse } from '@elearning/types';

export default async function MyCourses() {
  const courses = await serverRequest<IDataLoadedResponse<ICourseResponse>>('/courses?enrolled=true');
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex gap-10">
        {/* <div className="">
          <ul className="shadow border w-[300px]">
            <li className="p-3 px-4 border-b">
              <Link href={'#'}>My courses</Link>
            </li>
            <li className="p-3 px-4 border-b">
              <Link href={'#'}>Profile</Link>
            </li>
            <li className="p-3 px-4 border-b">
              <Link href={'#'}>Passwords</Link>
            </li>
            <li className="p-3 px-4 border-b">
              <Link href={'#'}>Payment methods</Link>
            </li>
            <li className="p-3 px-4 border-b">
              <Link href={'#'}>Account settings</Link>
            </li>
          </ul>
        </div> */}
        <div className="">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">My Course</h2>
          <p className="text-gray-600 mb-8">View and study your enrolled courses</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.data.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
