import { ICategorySaveRequest, ICategorySaveResponse, IErrorResponse } from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import categoryServices from '../services';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategorySaveSchema } from '@elearning/schemas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function CreateCategoryForm() {
  const { mutate, isPending } = useMutation<ICategorySaveResponse, IErrorResponse, ICategorySaveRequest>({
    mutationFn: categoryServices.create,
    onSuccess: (_) => {
      form.reset();
    },
  });

  const onSubmit = (values: ICategorySaveRequest) => {
    mutate(values);
  };

  const form = useForm<ICategorySaveRequest>({
    resolver: zodResolver(CategorySaveSchema),
    defaultValues: {
      name: '',
    },
    mode: 'onChange',
  });

  const { register, handleSubmit } = form;

  const { errors } = form.formState;

  useEffect(() => {
    console.log(errors);
  }, [errors]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center space-x-4">
        <Input id="name" placeholder="Enter category name" {...register('name')} error={errors.name?.message} />
        <Button type="submit" loading={isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
