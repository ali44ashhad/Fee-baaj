import Button from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import serverRequest from '@/lib/server-request';
import webRoutes from '@/lib/webRoutes';
import { ICourseResponse, IEnrollmentResponse } from '@elearning/types';
import { Check, Copy, Lock, User } from 'lucide-react';
import { redirect } from 'next/navigation';
import CopyLink from './components/copy-link';
import Objectives from './components/objectives';
import UnlockEnrollment from './components/unlock-enrollment';

interface PageProps {
  params: Promise<{
    id: string;
    lecture: string;
  }>;
}

export default async function Course({ params }: PageProps) {
  const { id } = await params;
  const course = await serverRequest<ICourseResponse>(`/courses/${id}`);

  if (!course.enrollment) return redirect(webRoutes.myCourses);

  if (course.enrollment.unlocked) {
    return redirect(webRoutes.myCourse(course.id, course.currentLectureId));
  }

  const enrollment = await serverRequest<IEnrollmentResponse>(`/enrollments/${course.enrollment._id}`);

  if (!enrollment.referralData) return redirect(webRoutes.myCourses);

  const referralData = enrollment.referralData;

  const progress = (referralData.referralCount / referralData.requiredReferrals) * 100;

  const allowUnlock = referralData.referralCount === referralData.requiredReferrals;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          {/* Course Card */}
          <Card>
            <CardHeader className="">
              <div className="relative">
                <img
                  src={course.thumbnail || '/placeholder.svg'}
                  alt={course.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                {!allowUnlock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-lg">
                    <div className="bg-background p-4 rounded-lg flex flex-col items-center gap-2">
                      <Lock className="h-8 w-8 text-primary" />
                      <p className="font-semibold text-center text-primary">Unlock this course by inviting 5 friends</p>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <CardTitle className="text-2xl">{course.title}</CardTitle>
                <CardDescription className="text-lg mt-2">{course.description}</CardDescription>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div>Instructor: {course.instructor.name}</div>
                {/* <div>Duration: {course.duration}</div> */}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

              <Objectives objectives={course.objectives} />
            </CardContent>
            <CardFooter>
              {allowUnlock ? (
                <UnlockEnrollment
                  courseId={course.id}
                  enrollmentId={enrollment.id}
                  lectureId={course.currentLectureId}
                />
              ) : (
                <Button disabled={true} className="bg-gray-400 cursor-not-allowed text-lg">
                  Course Locked
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Unlock This Course</CardTitle>
              <CardDescription>Invite 5 friends to join to unlock this course for free</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Referral Progress</span>
                  <span className="font-medium">
                    {referralData.referralCount}/{referralData.requiredReferrals}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Your Referral Link</label>
                <div className="flex">
                  <div className="bg-muted px-3 py-2 rounded-l-md border border-r-0 border-input flex-1 truncate text-sm">
                    {referralData.referralLink}
                  </div>
                  <CopyLink link={referralData.referralLink} />
                </div>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <h4 className="font-medium text-sm mb-2">Referral Status</h4>
                <div className="space-y-2">
                  {[...Array(referralData.requiredReferrals)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-sm ${i < referralData.referralCount ? 'text-green-600' : 'text-muted-foreground'}`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${i < referralData.referralCount ? 'bg-green-600/20' : 'bg-muted-foreground/20'}`}
                      >
                        {i < referralData.referralCount ? <Check className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      </div>
                      <span>{i < referralData.referralCount ? 'Friend joined' : 'Pending invitation'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
