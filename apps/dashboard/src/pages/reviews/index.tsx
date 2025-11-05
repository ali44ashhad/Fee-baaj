import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Table, { TableColumn } from '@/components/Table';
import reviewServices from '@/features/reviews/services';
import { IReviewDeleteResponse, IReviewResponse, IDataLoadedResponse, IErrorResponse } from '@elearning/types';
import webRoutes from '@/lib/webRoutes';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/Layout/PageLayout';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import queryClient from '@/lib/query-client';

interface RowData extends IReviewResponse {}

export default function Reviews() {
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();
  const [filters, setFilters] = useState({ page: 1, search: '' });

  const { data: results, isLoading } = useQuery<IDataLoadedResponse<IReviewResponse>>({
    queryKey: ['reviews', filters],
    queryFn: () => reviewServices.list(filters),
  });

  const { mutateAsync } = useMutation<IReviewDeleteResponse, IErrorResponse, string>({
    mutationFn: reviewServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reviews'],
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const page = params.get('page');
    if (page) {
      setFilters((prev) => ({ ...prev, page: parseInt(page, 10) }));
    }
  }, [location.search]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(location.search);
    params.set('page', page.toString());
    navigate({ search: params.toString() });
    setFilters((prev) => ({ ...prev, page }));
  };

  const deleteHandler = (id: string) => {
    dialog.show({
      title: 'Confirm Deletion',
      description: `Are you sure you want to delete it?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await mutateAsync(id);
      },
    });
  };

  const columns: TableColumn<RowData>[] = [
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
    },
    {
      title: 'Comment',
      dataIndex: 'comment',
      key: 'comment',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '',
      key: 'action',
      render: (record) => (
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" href={webRoutes.editReview(record._id.toString())}>
            <Pencil className="text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteHandler(record.id)}>
            <Trash className="text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout
      title="Reviews"
      actions={
        <Button href={webRoutes.createReview} variant="outline">
          <Plus /> New review
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={results?.data || []}
        loading={isLoading}
        pagination={{
          total: results?.total || 0,
          pageSize: results?.perPage || 10,
          current: results?.currentPage || 1,
          onChange: handlePageChange,
        }}
      />
    </PageLayout>
  );
}
