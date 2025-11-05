import React, { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

interface PaginationProps {
  total: number
  pageSize: number
  current: number
  onChange: (page: number) => void
}

export function Pagination({ current, onChange, pageSize, total }: PaginationProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const totalPages = Math.ceil(total / pageSize)

  const getDisplayedPages = () => {
    const delta = 2
    const pages: (number | string)[] = []

    for (let i = Math.max(1, current - delta); i <= Math.min(totalPages, current + delta); i++) {
      pages.push(i)
    }

    if (pages.length > 0 && typeof pages[0] === 'number' && pages[0] > 2) {
      pages.unshift('...')
    }
    if (pages.length === 0 || (typeof pages[0] === 'number' && pages[0] !== 1)) {
      pages.unshift(1)
    }

    const lastPage = pages[pages.length - 1]
    if (typeof lastPage === 'number' && lastPage < totalPages - 1) {
      pages.push('...')
    }
    if (lastPage !== totalPages) {
      pages.push(totalPages)
    }

    return pages
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const page = params.get('page')
    if (page && Number(page) !== current) {
      onChange(Number(page))
    }
  }, [location.search, current, onChange])

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(location.search)
    params.set('page', page.toString())
    navigate({ search: params.toString() })
    onChange(page)
  }

  return (
    <nav className="flex items-center justify-end space-x-1">
      {current > 1 && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(current - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {getDisplayedPages().map((page, index) =>
        typeof page === 'number' ? (
          <Button
            key={index}
            variant={current === page ? 'default' : 'outline'}
            size="icon"
            onClick={() => handlePageChange(page)}
            disabled={current === page}
          >
            {page}
          </Button>
        ) : (
          <Button key={index} variant="outline" size="icon" disabled>
            {page}
          </Button>
        )
      )}
      {current < totalPages && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(current + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </nav>
  )
}

