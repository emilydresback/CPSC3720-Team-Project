// frontend/src/components/ProtectedRoute.js

/**
 * Route wrapper that renders children only when the user is logged in.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    // Redirect anonymous users to login.
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
