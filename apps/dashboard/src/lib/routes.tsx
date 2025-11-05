import { lazy } from 'react';
import webRoutes from './webRoutes';
import { Flag } from 'lucide-react';
import {
  BookOpen,
  Folder,
  Home,
  LayoutDashboard,
  Settings2,
  MessageSquare,
  Star,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react';

const Login = lazy(() => import('@/pages/auth/login'));
const Dashboard = lazy(() => import('@/pages/dashboard'));

const Instructors = lazy(() => import('@/pages/instructors'));
const CreateInstructor = lazy(() => import('@/pages/instructors/create'));
const EditInstructor = lazy(() => import('@/pages/instructors/edit'));

const Categories = lazy(() => import('@/pages/categories'));
const CreateCategory = lazy(() => import('@/pages/categories/create'));
const EditCategory = lazy(() => import('@/pages/categories/edit'));
const Reports = lazy(() => import('@/pages/reports/reports'));

const Reviews = lazy(() => import('@/pages/reviews'));
const CreateReview = lazy(() => import('@/pages/reviews/create'));
const EditReview = lazy(() => import('@/pages/reviews/edit'));

const Users = lazy(() => import('@/pages/users'));
const CreateUser = lazy(() => import('@/pages/users/create'));
const EditUser = lazy(() => import('@/pages/users/edit'));

const Courses = lazy(() => import('@/pages/courses'));
const CreateCourse = lazy(() => import('@/pages/courses/create'));
const EditCourse = lazy(() => import('@/pages/courses/edit'));

const Settings = lazy(() => import('@/pages/settings/edit'));

const InstructorChat = lazy(() => import('@/pages/instuctorChat/index'));

export type Route = {
  key: string;
  title: string;
  path: string;
  component: JSX.Element;
  auth: boolean;
  icon?: JSX.Element;
};

const routes: Route[] = [
  {
    key: 'login',
    path: webRoutes.login,
    title: 'Login',
    component: <Login />,
    auth: false,
  },

  {
    key: 'dashboard',
    path: webRoutes.dashboard,
    title: 'Dashboard',
    component: <Dashboard />,
    auth: true,
    icon: <LayoutDashboard />,
  },
  {
    key: 'instructor_chat',
    path: webRoutes.instructorChat(':insId'), // define this in webRoutes.ts
    title: 'Chat',
    component: <InstructorChat />,
    auth: true,
  },
  {
    key: 'instructors',
    path: webRoutes.instructors,
    title: 'Instructors',
    component: <Instructors />,
    auth: true,
    icon: <UserCheck />,
  },
  {
    key: 'instructors_create',
    path: webRoutes.createInstructor,
    title: 'Create Instructor',
    component: <CreateInstructor />,
    auth: true,
  },
  {
    key: 'instructors_edit',
    path: webRoutes.editInstructor(':id'),
    title: 'Edit Instructor',
    component: <EditInstructor />,
    auth: true,
  },

  {
    key: 'categories',
    path: webRoutes.categories,
    title: 'Categories',
    component: <Categories />,
    auth: true,
    icon: <Folder />,
  },
  {
    key: 'categories_create',
    path: webRoutes.createCategory,
    title: 'Create Category',
    component: <CreateCategory />,
    auth: true,
  },
  {
    key: 'categories_edit',
    path: webRoutes.editCategory(':id'),
    title: 'Edit Category',
    component: <EditCategory />,
    auth: true,
  },

  {
    key: 'reviews',
    path: webRoutes.reviews,
    title: 'Reviews',
    component: <Reviews />,
    auth: true,
    icon: <Star />,
  },
  {
    key: 'reviews_create',
    path: webRoutes.createReview,
    title: 'Create Review',
    component: <CreateReview />,
    auth: true,
  },
  {
    key: 'reviews_edit',
    path: webRoutes.editReview(':id'),
    title: 'Edit Review',
    component: <EditReview />,
    auth: true,
  },

  {
    key: 'users',
    path: webRoutes.users,
    title: 'Users',
    component: <Users />,
    auth: true,
    icon: <UsersIcon />,
  },
  {
    key: 'users_create',
    path: webRoutes.createUser,
    title: 'Create User',
    component: <CreateUser />,
    auth: true,
  },
  {
    key: 'users_edit',
    path: webRoutes.editUser(':id'),
    title: 'Edit User',
    component: <EditUser />,
    auth: true,
  },

  {
    key: 'courses',
    path: webRoutes.courses,
    title: 'Courses',
    component: <Courses />,
    auth: true,
    icon: <BookOpen />,
  },
  {
    key: 'courses_create',
    path: webRoutes.createCourse,
    title: 'Create Course',
    component: <CreateCourse />,
    auth: true,
  },
  {
    key: 'courses_edit',
    path: webRoutes.editCourse(':id'),
    title: 'Edit Course',
    component: <EditCourse />,
    auth: true,
  },
  {
    key: 'reports',
    path: webRoutes.reports,
    title: 'Reports',
    component: <Reports />,
    icon: <Flag />,
    auth: true,
  },
  {
    key: 'settings',
    path: webRoutes.settings,
    title: 'Settings',
    component: <Settings />,
    icon: <Settings2 />,
    auth: true,
  },
];

export default routes;
