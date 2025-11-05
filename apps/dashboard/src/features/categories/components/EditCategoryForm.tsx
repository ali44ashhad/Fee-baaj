import Layout from '@/components/Layout';
import { ICategoryResponse, ICategorySaveRequest, ICategorySaveResponse, IErrorResponse } from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import categoryServices from '../services';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategorySaveSchema } from '@elearning/schemas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface EditCategoryFormProps {
  category: ICategoryResponse;
}

export default function EditCategoryForm({ category }: EditCategoryFormProps) {
  const { mutate, isPending } = useMutation<ICategorySaveResponse, IErrorResponse, ICategorySaveRequest>({
    mutationFn: (inputs) => categoryServices.update(category.id, inputs),
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
      name: category.name,
    },
  });

  const { register, handleSubmit } = form;

  const { errors } = form.formState;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center space-x-4">
        <Input
          id="name"
          type="name"
          placeholder="Enter category name"
          {...register('name')}
          error={errors.name?.message}
        />
        <Button type="submit" loading={isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
