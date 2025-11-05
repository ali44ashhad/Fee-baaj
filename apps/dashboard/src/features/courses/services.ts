import apiClient from '@/lib/apiClient';
import {
  ICourseDeleteResponse,
  ICourseResponse,
  ICourseSaveResponse,
  IDataLoadedResponse,
} from '@elearning/types';

// Updated to accept FormData
const basePath = '/courses';
const path = import.meta.env.VITE_API_BASE_URL
const pathMedia = import.meta.env.VITE_MEDIA_API_URL || "";


export const uploadCourseThumbnail = (file: File, courseId: string, onProgress?: (pct: number) => void, uploader = 'admin'): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      if (!courseId) return reject(new Error('courseId required'));
      const url = `${pathMedia}/image/upload`;
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('targetType', 'courses');
      fd.append('targetId', courseId);
      fd.append('uploader', uploader);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && typeof onProgress === 'function') {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const json = xhr.responseText ? JSON.parse(xhr.responseText) : { ok: true };
            resolve(json);
          } else {
            let body = null;
            try {
              body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch {}
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} ${body ? JSON.stringify(body) : ''}`));
          }
        } catch (err) {
          reject(err);
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        reject(new Error('Upload aborted'));
      };

      xhr.send(fd);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * NEW: Function to delete all thumbnail images associated with a course.
 * This triggers the S3 prefix delete and the Admin API webhook update.
 */
export const deleteCourseThumbnail = async (courseId: string): Promise<any> => {
  if (!courseId) {
    throw new Error('courseId required for deletion');
  }

  // NOTE: This calls the internal/admin route on the media server, 
  // which requires the Admin API key (handled by apiClient headers, assuming it's configured).
  const url = `${pathMedia}/images/delete`;
  
  const payload = {
    targetType: 'courses',
    targetId: courseId,
    // When 'key' is omitted, the entire prefix 'images/courses/<courseId>/' is deleted.
  };

  try {
    // Assuming apiClient is configured to handle the necessary Authorization headers for the internal route
    const res = await apiClient(url, 'POST', payload);
    return res;
  } catch (error) {
    console.error('Error deleting course thumbnail:', error);
    throw error;
  }
};

// metadata-only create (returns course object with _id)
export const createMeta = async (payload: any): Promise<ICourseSaveResponse> => {
  try {
    const res = await fetch(`${path}${basePath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to create course metadata: ${res.status} ${res.statusText}`);
    }

    const data: ICourseSaveResponse = await res.json();
    
    return data;
  } catch (error) {
    console.error('Error creating course metadata:', error);
    throw error;
  }
};

// metadata update (by course _id)
export const updateMeta = async (id: string, payload: any): Promise<ICourseSaveResponse> => {
  try {
    const res = await fetch(`${path}${basePath}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to update course metadata: ${res.status} ${res.statusText}`);
    }

    const data: ICourseSaveResponse = await res.json();
    console.log('from the service (updateMeta):', data);
    return data;
  } catch (error) {
    console.error('Error updating course metadata:', error);
    throw error;
  }
};

export default {
  createMeta,
  uploadCourseThumbnail,
  deleteCourseThumbnail,
  updateMeta,
  read: async (id: string) => apiClient<ICourseResponse>(`${basePath}/${id}`),

  // LIST: added support for published filter (published?: boolean)
  // filters: { page?: number, search?: string, published?: boolean | undefined }
  list: async (filters: { page?: number; search?: string; published?: boolean | undefined } = { page: 1, search: '' }) => {
    const page = filters.page ?? 1;
    const search = encodeURIComponent(filters.search ?? '');
    const published = filters.published === undefined ? '' : `&published=${filters.published}`;

    // build URL
    const url = `${basePath}?page=${page}&search=${search}${published}`;

    return apiClient<IDataLoadedResponse<ICourseResponse>>(url);
  },

  remove: async (id: string) => apiClient<ICourseDeleteResponse>(`${basePath}/${id}`, 'DELETE'),
};
