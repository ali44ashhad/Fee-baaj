import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Layout from '@/components/Layout';
import Table, { TableColumn } from '@/components/Table';
import categoryServices from '@/features/categories/services';
import { ICategoryDeleteResponse, ICategoryResponse, IDataLoadedResponse, IErrorResponse } from '@elearning/types';
import webRoutes from '@/lib/webRoutes';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/Layout/PageLayout';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import queryClient from '@/lib/query-client';

interface RowData extends ICategoryResponse {}

export default function Categories() {
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();
  const [filters, setFilters] = useState({ page: 1, search: '' });

  const { data: results, isLoading } = useQuery<IDataLoadedResponse<ICategoryResponse>>({
    queryKey: ['categories', filters],
    queryFn: () => categoryServices.list(filters),
  });

  const { mutateAsync } = useMutation<ICategoryDeleteResponse, IErrorResponse, string>({
    mutationFn: categoryServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories'],
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
      title: 'Category name',
      dataIndex: 'name',
      key: 'name',
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
          <Button variant="ghost" size="icon" href={webRoutes.editCategory(record._id.toString())}>
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
      title="Categories"
      actions={
        <Button href={webRoutes.createCategory} variant="outline">
          <Plus /> New category
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
