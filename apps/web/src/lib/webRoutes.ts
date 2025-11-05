const webRoutes = {
  home: '/',
  courses: '/',

  courseDetails: (id: string) => `/courses/${id}`,

  myCourse: (id: string, lectureId?: string) => (lectureId ? `/me/courses/${id}/${lectureId}` : `/me/courses/${id}`),
  myCourses: '/me/courses',
  profile: '/me/profile',
  auth: '/auth'
};

export default webRoutes;
