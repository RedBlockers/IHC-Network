import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Login from "./pages/login.jsx";
import Register from "./pages/register/register.jsx";
import ForgotPassword from "./pages/forgotPassword.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/authContext";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/*"
        element={
          <AuthProvider>
            <App />
          </AuthProvider>
        }
      />
    </Routes>
  </BrowserRouter>,
);
