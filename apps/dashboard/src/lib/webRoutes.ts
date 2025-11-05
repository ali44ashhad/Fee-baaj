const webRoutes = {
  login: '/login',

  dashboard: '/',

  instructors: '/instructors',
  createInstructor: '/instructors/create',
  editInstructor: (id: string) => `/instructors/${id}/edit`,

  categories: '/categories',
  createCategory: '/categories/create',
  editCategory: (id: string) => `/categories/${id}/edit`,

  reviews: '/reviews',
  createReview: '/reviews/create',
  editReview: (id: string) => `/reviews/${id}/edit`,
  
  reports: '/reports',

  users: '/users',
  createUser: '/users/create',
  editUser: (id: string) => `/users/${id}/edit`,

  courses: '/courses',
  createCourse: '/courses/create',
  editCourse: (id: string) => `/courses/${id}/edit`,

  settings: '/settings/edit',

  instructorChat: (id: string) => `/instructors/${id}/chat`
};

export default webRoutes;
