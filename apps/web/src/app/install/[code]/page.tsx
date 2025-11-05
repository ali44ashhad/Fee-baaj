import serverRequest from '@/lib/server-request';
import Install from './components/install';
import { IEnrollmentResponse } from '@elearning/types';
import { redirect } from 'next/navigation';
import webRoutes from '@/lib/webRoutes';

interface PageProps {
  params: Promise<{
    code: string;
  }>;
}

export default async function InstallPage({ params }: PageProps) {
  const { code } = await params;
  const enrollment = await serverRequest<IEnrollmentResponse>(`/enrollments/${code}`);

  if (!enrollment) redirect(webRoutes.home);

  return <Install />;
}
