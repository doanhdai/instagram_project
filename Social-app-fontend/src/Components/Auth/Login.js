import { yupResolver } from "@hookform/resolvers/yup";
import React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { FaInstagram } from "react-icons/fa";
import { userLogin } from "../../Service/AuthApi";
import { toast, ToastContainer } from "react-toastify";

import { signInWithPopup, FacebookAuthProvider } from "firebase/auth";
import { auth } from "../firebase/config";
import { useDispatch } from "react-redux";
import { userLoginData } from "../../Redux/Reducer/UserAppDeucer";
import websocket, { useWebSocket } from "../../Utils/configCallVideo/websocket";
const provider = new FacebookAuthProvider();
const Login = () => {
  const dispatch = useDispatch();

  const usenavi = useNavigate();
  const userSchema = yup.object().shape({
    email: yup
      .string()
      .email("Email không đúng định dạng")
      .required("Email không được bỏ trống"),
    password: yup
      .string()
      .min(8, "Tối thiểu 8 ký tự")
      .max(12, "Tối đa 12 ký tự")
      .required("Mật khẩu là bắt buộc"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    resolver: yupResolver(userSchema),
  });

  const handleSaveData = async (data) => {
    console.log(data);
    try {
      let res = await userLogin(data);
      if (res && res.data && res.statusCode === 200) {
        toast.success("Đăng nhập thành công");
        dispatch(
          userLoginData({
            user: res.data.user,
            accessToken: res.data.accessToken,
          })
        );

        setTimeout(() => {
          usenavi("/user/home");
        }, 3000);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(
          error.response.data.error || "Có lỗi xảy ra, vui lòng thử lại!"
        );
      } else {
        toast.error("Lỗi kết nối, vui lòng thử lại sau.");
      }
    }
  };

  const handleLoginFb = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (user) {
        dispatch(
          userLoginData({
            user: {
              name: user.displayName,
              email: user.email,
              avatar: user.photoURL,
            },
            accessToken: user.accessToken,
          })
        );

        toast.success("Đăng nhập thành công");
        setTimeout(() => {
          usenavi("/home");
        }, 3000);
      }
    } catch (error) {
      console.error("Lỗi khi đăng nhập:", error.message);
    }
  };

  return (
    <>
      {" "}
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-96">
          <div className=" flex justify-center flex-row text-center items-center ">
            <h1 className="text-4xl font-logo mb-2 ">Instagram</h1>
            <FaInstagram className="text-2xl" />
          </div>
          <form
            className="space-y-4 mt-3"
            onSubmit={handleSubmit(handleSaveData)}
          >
            <div>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition"
                placeholder="Email"
                {...register("email")}
              />
              {errors.email && (
                <span className="text-red-600 text-sm mt-1 block text-left">
                  {errors.email.message}
                </span>
              )}
            </div>
            <div>
              <input
                type="password"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition"
                placeholder="Mật khẩu"
                {...register("password")}
              />
              {errors.password && (
                <span className="text-red-600 text-sm mt-1 block text-left">
                  {errors.password.message}
                </span>
              )}
            </div>
            <button
              className="w-full bg-blue-500 text-white font-semibold py-3 rounded-lg hover:bg-blue-600 transition"
              type="submit"
            >
              Đăng nhập
            </button>
          </form>
          <div className="relative flex items-center my-4">
            <hr className="w-full border-gray-300" />
            <span className="absolute inset-x-0 text-gray-400 bg-white px-2 text-sm mx-auto text-center">
              ----- HOẶC -----
            </span>
          </div>
          <button
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
            onClick={() => handleLoginFb()}
          >
            Đăng nhập bằng Facebook
          </button>
          <a
            href="#"
            className="text-blue-600 text-sm block mt-3 hover:underline"
          >
            Quên mật khẩu?
          </a>
        </div>

        <div className="bg-white mt-4 p-4 border border-gray-300 rounded-lg text-center w-96">
          Bạn chưa có tài khoản?{" "}
          <Link
            to="/register"
            className="text-blue-600 font-semibold hover:underline"
          >
            Đăng ký
          </Link>
        </div>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </>
  );
};

export default Login;
