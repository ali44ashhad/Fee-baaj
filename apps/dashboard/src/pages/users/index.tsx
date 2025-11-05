// src/features/users/pages/Users.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Table, { TableColumn } from '@/components/Table';
import userServices from '@/features/users/services';
import { IUserDeleteResponse, IUserResponse, IDataLoadedResponse, IErrorResponse } from '@elearning/types';
import webRoutes from '@/lib/webRoutes';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/Layout/PageLayout';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import queryClient from '@/lib/query-client';

interface RowData extends IUserResponse {}

const MEDIA_API_BASE = (import.meta.env.VITE_MEDIA_API_URL || '').replace(/\/$/, '');

export default function Users() {
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();
  const [filters, setFilters] = useState({ page: 1, search: '' });

  const { data: results, isLoading } = useQuery<IDataLoadedResponse<IUserResponse>>({
    queryKey: ['users', filters],
    queryFn: () => userServices.list(filters),
  });

  const { mutateAsync } = useMutation<IUserDeleteResponse, IErrorResponse, string>({
    mutationFn: userServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
        try {
          // find pictureId in cached results (if present)
          const user = (results?.data || []).find((u) => String(u._id) === String(id));
          const pictureId = user?.pictureId;

          // If we have a pictureId, call admin-server to delete images folder
          if (pictureId) {
            try {
              const url = `${MEDIA_API_BASE}/images/delete`;
              // NOTE: we delete the whole prefix based on targetType + targetId.
              // We send credentials so existing admin session auth is used (instead of sending ADMIN_API_KEY from browser).
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ targetType: 'users', targetId: id }),
              });
              if (!resp.ok) {
                // log error but continue with DB deletion
                const text = await resp.text().catch(() => '');
                console.warn('Image delete endpoint returned non-ok:', resp.status, text);
              } else {
                // optionally read response
                // const json = await resp.json().catch(() => null);
              }
            } catch (err) {
              console.warn('Failed to call image delete endpoint', err);
            }
          }

          // Now delete the user record (existing flow)
          await mutateAsync(id);
        } catch (err) {
          console.error('Failed to delete user:', err);
        }
      },
    });
  };

  const columns: TableColumn<RowData>[] = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Identifier', dataIndex: 'identifier', key: 'identifier' },
    { title: 'Active', dataIndex: 'active', key: 'active', render: (val: any) => (val ? 'Yes' : 'No') },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '',
      key: 'action',
      render: (record: RowData) => (
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" href={webRoutes.editUser(String(record._id))}>
            <Pencil className="text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteHandler(String(record._id))}>
            <Trash className="text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout
      title="Users"
      actions={
        <Button href={webRoutes.createUser} variant="outline">
          <Plus /> New user
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
