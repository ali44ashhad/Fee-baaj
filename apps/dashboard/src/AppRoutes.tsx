import Loading from "./components/Loading";
import routes from "./lib/routes";
import React, { memo } from "react";
import webRoutes from "./lib/webRoutes";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/use-auth";
import Layout from "./components/Layout";

const PublicRoutes = memo(() => (
  <React.Suspense fallback={<Loading full />}>
    <Routes>
      {routes
        .filter((r) => !r.auth)
        .map(({ path, key, component }) => (
          <Route key={key} path={path} element={component} />
        ))}
      <Route path="*" element={<Navigate to={webRoutes.login} replace />} />
    </Routes>
  </React.Suspense>
));

const AuthenticatedRoutes = memo(() => (
  <Layout>
    <React.Suspense fallback={<Loading full />}>
      <Routes>
        {routes
          .filter((r) => r.auth)
          .map(({ path, key, component }) => (
            <Route key={key} path={path} element={component} />
          ))}
        <Route path="*" element={<Navigate to={webRoutes.dashboard} />} />
      </Routes>
    </React.Suspense>
  </Layout>
));

const AppRoutes = memo(() => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading || isAuthenticated == null) {
    return <Loading full />;
  }

  return <>{isAuthenticated ? <AuthenticatedRoutes /> : <PublicRoutes />}</>;
});

//const AppRoutes = () => <PublicRoutes />;

export default AppRoutes;
