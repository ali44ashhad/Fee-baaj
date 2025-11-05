// app/courses/[id]/page.tsx
import serverRequest from '@/lib/server-request';
import type { ICourseResponse } from '@elearning/types';
import CourseDetailClientView from './components/CourseDetailClientView';

interface PageProps {
  params: { id: string };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id } = await  params;

  // 1️⃣ fetch course data
  const course = await serverRequest<ICourseResponse>(`/courses/${id}`);

  // 2️⃣ fetch playlist URL server‑side
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/video/stream/${course.bunnyVideoId}`,
    { cache: 'force-cache' }
  );
  const { playlistUrl } = await res.json();

  // 3️⃣ render client view with both pieces of data
  
  return <CourseDetailClientView course={course} playlistUrl={playlistUrl} />;
}
