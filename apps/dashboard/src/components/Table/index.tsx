import React, { ReactNode } from 'react';
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from './Pagination';
import { Loader2 } from 'lucide-react';
import Loading from '../Loading';

export interface TableColumn<T> {
  title: string;
  dataIndex?: keyof T;
  key: string;
  render?: (record: T) => ReactNode;
}

interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  dataSource: Array<T>;
  loading: boolean;
  pagination: {
    total: number;
    pageSize: number;
    current: number;
    onChange: (page: number) => void;
  };
}

export default function Table<T extends object>({ columns, dataSource, loading, pagination }: TableProps<T>) {
  return (
    <div className="w-full space-y-4">
      <div className="rounded-md">
        <ShadcnTable>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  <Loading />
                </TableCell>
              </TableRow>
            ) : dataSource.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              dataSource.map((record, index) => (
                <TableRow key={index} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell className="font-medium">
                    {index + 1 + (pagination.current - 1) * pagination.pageSize}
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render
                        ? column.render(record)
                        : column.dataIndex
                          ? (record[column.dataIndex] as ReactNode)
                          : ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </ShadcnTable>
      </div>
      {!loading && dataSource.length > 0 && (
        <Pagination
          total={pagination.total}
          pageSize={pagination.pageSize}
          current={pagination.current}
          onChange={pagination.onChange}
        />
      )}
    </div>
  );
}
