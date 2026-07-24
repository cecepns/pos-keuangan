import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CatalogLanding from "./pages/CatalogLanding";
import CatalogProductDetail from "./pages/CatalogProductDetail";
import CatalogAdminLogin from "./pages/CatalogAdminLogin";
import CatalogAdminLayout from "./components/CatalogAdminLayout";
import CatalogAdminProducts from "./pages/CatalogAdminProducts";
import CatalogAdminCategories from "./pages/CatalogAdminCategories";
import CatalogAdminSubcategories from "./pages/CatalogAdminSubcategories";
import CatalogAdminSocialMedia from "./pages/CatalogAdminSocialMedia";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Catalog Landing Page */}
        <Route path="/" element={<CatalogLanding />} />
        <Route path="/product/:id" element={<CatalogProductDetail />} />
        
        {/* Catalog Admin Login Page */}
        <Route path="/catalog-admin/login" element={<CatalogAdminLogin />} />
        
        {/* Catalog Admin Dashboard Layout & Subroutes */}
        <Route path="/catalog-admin" element={<CatalogAdminLayout />}>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<CatalogAdminProducts />} />
          <Route path="categories" element={<CatalogAdminCategories />} />
          <Route path="subcategories" element={<CatalogAdminSubcategories />} />
          <Route path="social" element={<CatalogAdminSocialMedia />} />
        </Route>

        {/* Fallback to Public Catalog Landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
