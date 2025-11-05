import PageLayout from '@/components/Layout/PageLayout';
import { Card } from '@/components/ui/card';
import CreateInstructorForm from '@/features/instructors/components/CreateInstructorForm';

export default function CreateInstructor() {
  return (
    <PageLayout title="New Instructor">
      <Card className="p-5">
        <CreateInstructorForm />
      </Card>
    </PageLayout>
  );
}
