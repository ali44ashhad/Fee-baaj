import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IChapterResponse, IChapterUpdateRequest, IChapterUpdateResponse, IErrorResponse } from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import chapterServices from '../services';
import queryClient from '@/lib/query-client';
import { useForm } from 'react-hook-form';
import { ChapterUpdateSchema } from '@elearning/schemas';
import { zodResolver } from '@hookform/resolvers/zod';

interface EditChapterProps {
  chapter: IChapterResponse;
}

export default function EditChapter({ chapter }: EditChapterProps) {
  const { mutate, isPending } = useMutation<IChapterUpdateResponse, IErrorResponse, IChapterUpdateRequest>({
    mutationFn: (inputs) => chapterServices.update(chapter._id, inputs),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['course', chapter.courseId.toString()],
      });
    },
  });

  const form = useForm<IChapterUpdateRequest>({
    resolver: zodResolver(ChapterUpdateSchema),
    defaultValues: {
      title: chapter.title || '',
    },
  });

  const onSubmit = (values: IChapterUpdateRequest) => {
    mutate(values);
  };

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = form;

  return (
    <div
      className="space-y-4"
      // Prevent form submission on Enter
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <Input
        id="title"
        label="Chapter Title"
        placeholder="Enter chapter title"
        {...register('title')}
        error={errors.title?.message}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(onSubmit)();
          }
        }}
      />
      <Button type="button" onClick={handleSubmit(onSubmit)} loading={isPending}>
        Update chapter
      </Button>
    </div>
  );
}
