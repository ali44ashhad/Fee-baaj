import Layout from '@/components/Layout';
import PageLayout from '@/components/Layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateUserForm from '@/features/users/components/CreateUserForm';

export default function CreateUser() {
  return (
    <PageLayout title="New user">
      <Card className="p-5">
        <CreateUserForm />
      </Card>
    </PageLayout>
  );
}
