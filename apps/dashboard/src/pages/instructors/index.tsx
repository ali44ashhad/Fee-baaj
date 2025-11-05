// src/features/instructors/pages/Instructors.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Table, { TableColumn } from '@/components/Table';
import instructorServices from '@/features/instructors/services';
import { IInstructorDeleteResponse, IInstructorResponse, IDataLoadedResponse, IErrorResponse } from '@elearning/types';
import webRoutes from '@/lib/webRoutes';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/Layout/PageLayout';
import { Pencil, Plus, Trash, MessageSquareIcon } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import queryClient from '@/lib/query-client';

interface RowData extends IInstructorResponse {}

const MEDIA_API_BASE = (import.meta.env.VITE_MEDIA_API_URL || '').replace(/\/$/, '');

export default function Instructors() {
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();
  const [filters, setFilters] = useState({ page: 1, search: '' });

  const { data: results, isLoading } = useQuery<IDataLoadedResponse<IInstructorResponse>>({
    queryKey: ['instructors', filters],
    queryFn: () => instructorServices.list(filters),
  });

  const { mutateAsync } = useMutation<IInstructorDeleteResponse, IErrorResponse, string>({
    mutationFn: instructorServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
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
          // find instructor in cached list to check for pictureId
          const instructor = (results?.data || []).find((i) => String(i._id) === String(id));
          const pictureId = instructor?.pictureId;

          // If pictureId present, call media API to delete the instructor images folder/prefix.
          if (pictureId && MEDIA_API_BASE) {
            try {
              const url = `${MEDIA_API_BASE}/images/delete`;
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // use admin session cookies
                body: JSON.stringify({ targetType: 'instructors', targetId: id }),
              });
              if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                console.warn('Instructor image delete endpoint returned non-ok:', resp.status, text);
              } else {
                // optionally parse result: const json = await resp.json().catch(() => null);
              }
            } catch (err) {
              console.warn('Failed to call instructor image delete endpoint', err);
            }
          }

          // Now delete the instructor DB record
          await mutateAsync(id);
        } catch (err) {
          console.error('Failed to delete instructor:', err);
          // optionally surface error to user via dialog.toast or similar
        }
      },
    });
  };

  const columns: TableColumn<RowData>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: 'Chat Direct',
      key: 'chatDirect',
      render: (record) => (
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" href={webRoutes.instructorChat(String(record._id))}>
            <MessageSquareIcon className="text-gray-600" />
          </Button>
        </div>
      ),
    },
    {
      title: '',
      key: 'action',
      render: (record) => (
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" href={webRoutes.editInstructor(String(record._id))}>
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
      title="Instructors"
      actions={
        <Button href={webRoutes.createInstructor} variant="outline">
          <Plus /> New instructor
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
  