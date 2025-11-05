// src/pages/admin/courses/index.tsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, UseQueryOptions } from '@tanstack/react-query';
import Table, { TableColumn } from '@/components/Table';
import { ICourseDeleteResponse, ICourseResponse, IDataLoadedResponse, IErrorResponse } from '@elearning/types';
import webRoutes from '@/lib/webRoutes';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/Layout/PageLayout';
import { Pencil, Plus, Trash, Check, X } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import queryClient from '@/lib/query-client';
import courseServices, { deleteCourseThumbnail } from '@/features/courses/services';

interface RowData extends ICourseResponse {}

const pathMedia = (import.meta.env.VITE_MEDIA_API_URL as string) || '';

export default function Courses() {
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();

  // filters: page, search, published: 'all' | 'published' | 'draft'
  const [filters, setFilters] = useState<{ page: number; search: string; published: 'all' | 'published' | 'draft' }>({
    page: 1,
    search: '',
    published: 'all',
  });

  const queryKey = ['courses', filters] as const;

  const queryOptionsRaw = {
    queryKey,
    queryFn: () =>
      courseServices.list({
        page: filters.page,
        search: filters.search,
        published: filters.published === 'all' ? undefined : filters.published === 'published',
      }) as Promise<IDataLoadedResponse<ICourseResponse>>,
    keepPreviousData: true,
  };

  // Cast to the expected UseQueryOptions type (avoid TS trying to validate properties)
  const queryOptions = queryOptionsRaw as unknown as UseQueryOptions<
    IDataLoadedResponse<ICourseResponse>,
    IErrorResponse,
    IDataLoadedResponse<ICourseResponse>,
    typeof queryKey
  >;

  const { data: results, isLoading } = useQuery(queryOptions);

  const { mutateAsync } = useMutation<ICourseDeleteResponse, IErrorResponse, string>({
    mutationFn: courseServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  // Read page query param on mount / navigation
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const page = params.get('page');
    const published = params.get('published');
    const search = params.get('search');

    setFilters((prev) => ({
      ...prev,
      page: page ? parseInt(page, 10) : prev.page,
      published: published === 'published' ? 'published' : published === 'draft' ? 'draft' : prev.published,
      search: search ?? prev.search,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(location.search);
    params.set('page', page.toString());
    // keep published param in URL too
    if (filters.published && filters.published !== 'all') params.set('published', filters.published);
    else params.delete('published');

    navigate({ search: params.toString() });
    setFilters((prev) => ({ ...prev, page }));
  };

  // NEW: helper to call media delete endpoint
  async function callMediaDelete(courseId: string) {
    const mediaDeleteUrl = pathMedia ? `${pathMedia.replace(/\/$/, '')}/api/media/delete` : '/api/media/delete';
    const resp = await fetch(mediaDeleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'course', courseId }),
      // credentials: 'include' // uncomment if your server uses cookie-based auth
    });

    // try parse json, fallback to raw text on parse fail
    const text = await resp.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { ok: resp.ok, raw: text };
    }

    if (!resp.ok || (json && json.ok === false)) {
      const msg = json?.message || json?.error || `Media delete failed (status ${resp.status})`;
      throw new Error(msg);
    }
    return json;
  }

  const deleteHandler = (id: string) => {
    dialog.show({
      title: 'Confirm Deletion',
      description: `Are you sure you want to delete it? This will remove course media (intro + lectures) and thumbnails.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        if (!id) {
          alert('Missing course id');
          return;
        }

        try {
          // 1) Delete media (videos under videos/courses/<courseId>/ etc)
          await callMediaDelete(id);

          // 2) Delete thumbnails via existing service helper
          await deleteCourseThumbnail(id);

          // 3) Delete course record (DB) using existing mutation
          await mutateAsync(id);

          alert('Course, media, and thumbnails deleted successfully.');
          // ensure list refresh
          queryClient.invalidateQueries({ queryKey: ['courses'] });
        } catch (err: any) {
          console.error('Delete flow error:', err);
          alert(`Delete failed: ${String(err?.message || err)}`);
        }
      },
    });
  };

  // Table columns including the new Published column
  const columns: TableColumn<RowData>[] = useMemo(
    () => [
      {
        title: 'Title',
        dataIndex: 'title',
        key: 'title',
      },
      {
        title: 'Date',
        dataIndex: 'createdAt',
        key: 'createdAt',
      },
      {
        title: 'Published',
        dataIndex: 'published',
        key: 'published',
        render: (record: RowData) => {
          const published = (record as any).published === true || (record as any).published === 'true';
          return (
            <div className="flex items-center">
              {published ? <Check className="text-green-600 w-4 h-4" /> : <X className="text-red-600 w-4 h-4" />}
            </div>
          );
        },
      },
      {
        title: '',
        key: 'action',
        render: (record: RowData) => {
          const recordId = (record as any)._id ?? (record as any).id;
          const editId = (record as any)._id ? String((record as any)._id) : String((record as any).id ?? recordId);
          return (
            <div className="flex space-x-1">
              <Button variant="ghost" size="icon" href={webRoutes.editCourse(String(editId))}>
                <Pencil className="text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteHandler(String(recordId))}>
                <Trash className="text-red-600" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  // Local UI: published filter control
  const onChangePublishedFilter = (value: 'all' | 'published' | 'draft') => {
    const params = new URLSearchParams(location.search);
    if (value === 'all') params.delete('published');
    else params.set('published', value);

    // reset to page 1 when filter changes
    params.set('page', '1');

    navigate({ search: params.toString() });
    setFilters((prev) => ({ ...prev, page: 1, published: value }));
  };

  // If backend doesn't support server-side published filter, fallback filter (client-side)
  const dataToShow = useMemo(() => {
    const items = results?.data || [];
    if (filters.published === 'all') return items;
    const wantPublished = filters.published === 'published';
    return items.filter((c) => {
      const pub = (c as any).published === true || (c as any).published === 'true';
      return wantPublished ? pub : !pub;
    });
  }, [results, filters.published]);



  return (
    <PageLayout
      title="Courses"
      actions={
        <div className="flex items-center space-x-2">
          <div>
            <Button href={webRoutes.createCourse} variant="outline">
              <Plus /> New course
            </Button>
          </div>

          {/* Published filter control */}
          <div className="flex items-center space-x-1">
            <label className="text-sm mr-2">Filter:</label>
            <div className="flex space-x-1">
              <Button variant={filters.published === 'all' ? 'default' : 'outline'} onClick={() => onChangePublishedFilter('all')} size="sm">
                All
              </Button>
              <Button variant={filters.published === 'published' ? 'default' : 'outline'} onClick={() => onChangePublishedFilter('published')} size="sm">
                Published
              </Button>
              <Button variant={filters.published === 'draft' ? 'default' : 'outline'} onClick={() => onChangePublishedFilter('draft')} size="sm">
                Draft
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={dataToShow}
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
