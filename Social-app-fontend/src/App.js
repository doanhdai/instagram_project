import React from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import RouterApp from "./Routes/RouterApp";
import { ToastContainer } from "react-toastify";
import Login from './Pages/Login/index'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Khi mở trình duyệt vào '/', tự động chuyển hướng sang '/login' */}
        <Route path="/" element={<Navigate to="/login" />} />
      
        {/* Route vào trang login */}
        <Route path="/login" element={<Login />} />
      
        <Route 
          path="/*"
          element={
            <div className="w-full min-h-screen bg-white">
              <RouterApp />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
