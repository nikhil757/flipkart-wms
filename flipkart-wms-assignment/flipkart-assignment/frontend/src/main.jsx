import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import "./index.css";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import VerifyPage from "./pages/VerifyPage";
import ReportPage from "./pages/ReportPage";
import PODPage from "./pages/PODPage";
import PODHistoryPage from "./pages/PODHistoryPage";

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: "'DM Sans', sans-serif", fontSize: "14px" },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="upload"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="verify"
              element={
                <ProtectedRoute roles={["admin", "operator"]}>
                  <VerifyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="report"
              element={
                <ProtectedRoute roles={["admin", "qa"]}>
                  <ReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="pod"
              element={
                <ProtectedRoute roles={["admin", "operator"]}>
                  <PODPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="pod/history"
              element={
                <ProtectedRoute roles={["admin", "qa"]}>
                  <PODHistoryPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
