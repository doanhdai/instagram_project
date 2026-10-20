import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import RouterApp from "./Routes/RouterApp";
import { ToastContainer } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";
import Login from './Pages/Login/index'
import notificationSocket from "./Service/NotificationSocket";

function App() {
  const { userInfo } = useSelector((state) => state.login);

    const dispatch = useDispatch();

  useEffect(() => {
    if (userInfo?.id) {
      notificationSocket.init(dispatch, userInfo.id);
    }
  }, [userInfo?.id, dispatch]);
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
