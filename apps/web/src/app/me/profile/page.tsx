import Container from '@/components/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UpdateProfileForm from './components/update-profile-form';
import serverRequest from '@/lib/server-request';
import { IUserResponse } from '@elearning/types';
import UpdatePasswordForm from './components/update-password-form';



export default async function Profile() {
  const user = await serverRequest<IUserResponse>('/auth/check');

  return (
    <Container title="My account">
      <div className="flex flex-col md:flex-row mt-10 space-y-4 md:space-y-0 md:space-x-4">
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Profile information</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateProfileForm user={user} />
          </CardContent>
        </Card>
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Update password</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm user={user} />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
