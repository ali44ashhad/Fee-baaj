import {
  IReviewSaveRequest,
  IReviewSaveResponse,
  IErrorResponse,
  IUserResponse,
  ICourseResponse,
} from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import reviewServices from '../services';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ReviewSaveSchema } from '@elearning/schemas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { SearchableSelect } from '@/features/courses/components/SearchableSelect';
import { StarRating } from './StarRating';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CreateReviewFormProps {
  users: IUserResponse[];
  courses: ICourseResponse[];
}

export default function CreateReviewForm({ courses, users }: CreateReviewFormProps) {
  const { mutate, isPending } = useMutation<IReviewSaveResponse, IErrorResponse, IReviewSaveRequest>({
    mutationFn: reviewServices.create,
    onSuccess: (_) => {
      form.reset();
    },
  });

  const onSubmit = (values: IReviewSaveRequest) => {
    mutate(values);
  };

  const form = useForm<IReviewSaveRequest>({
    resolver: zodResolver(ReviewSaveSchema),
    defaultValues: {
      rating: 0,
      comment: '',
      userId: '',
      courseId: '',
      approved: false,
    },
  });

  const { register, handleSubmit, setValue, getValues, control } = form;

  const { errors } = form.formState;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <Controller
          name="rating"
          control={control}
          render={({ field }) => (
            <StarRating
              label="Rating"
              rating={field.value}
              onRatingChange={(newRating) => setValue('rating', newRating)}
            />
          )}
        />
        <Textarea id="comment" {...register('comment')} label="Comment" error={errors.comment?.message} />
        <Controller
          name="userId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              options={users.map((c) => ({ value: c._id.toString(), label: c.name }))}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select user"
              label="User"
              id="userId"
              error={errors.userId?.message}
            />
          )}
        />
        <Controller
          name="courseId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              options={courses.map((c) => ({ value: c._id.toString(), label: c.title }))}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select course"
              label="Course"
              id="courseId"
              error={errors.courseId?.message}
            />
          )}
        />
        <Controller
          name="approved"
          control={control}
          render={({ field }) => (
            <div className="flex items-center space-x-2">
              <Switch id="approved" checked={field.value} onCheckedChange={field.onChange} />
              <Label htmlFor="approved">Approved</Label>
            </div>
          )}
        />
        <Button type="submit" loading={isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
