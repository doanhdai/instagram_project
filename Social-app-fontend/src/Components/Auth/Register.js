import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { signInWithPopup, FacebookAuthProvider } from "firebase/auth";
import { auth } from "../firebase/config";
import { toast, ToastContainer } from "react-toastify";
import { userRegister } from "../../Service/AuthApi";

const provider = new FacebookAuthProvider();

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
  fullname: yup
    .string()
    .matches(/^[A-Za-zÀ-ỹ\s]+$/, "Tên đầy đủ chỉ được chứa chữ cái")
    .required("Tên đầy đủ không được bỏ trống"),

  username: yup
    .string()
    .matches(
      /^[a-zA-Z][a-zA-Z0-9_]{3,15}$/,
      "Tên người dùng từ 4-16 ký tự, bắt đầu bằng chữ cái, chỉ chứa chữ, số hoặc dấu gạch dưới"
    )
    .required("Tên người dùng không được bỏ trống"),
});

const Register = () => {
  let navi = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    resolver: yupResolver(userSchema),
  });

  const handleRegister = async (data) => {
    try {
      let res = await userRegister(data);
      console.log("Response:", res);

      if (res && res.statusCode === 201) {
        toast.success("Đăng kí tài khoản thành công!");
        setTimeout(() => {
          navi("/login");
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
      console.log("Đăng nhập thành công với Facebook!", user);
    } catch (error) {
      console.error("Lỗi khi đăng nhập:", error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96 text-center">
        <h1 className="text-4xl font-logo mb-2">Instagram</h1>
        <p className="text-gray-600 text-sm mb-4">
          Đăng ký để xem ảnh và video từ bạn bè.
        </p>

        <button
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
          onClick={handleLoginFb}
        >
          Đăng nhập bằng Facebook
        </button>

        <div className="relative flex items-center my-4">
          <hr className="w-full border-gray-300" />
          <span className="absolute inset-x-0 text-gray-400 bg-white px-2 text-sm mx-auto">
            HOẶC
          </span>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit(handleRegister)}>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition"
            placeholder="Số di động hoặc email"
            {...register("email")}
          />
          {errors.email && (
            <span className="text-red-600 text-sm mt-1 block text-left">
              {errors.email.message}
            </span>
          )}

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

          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition"
            placeholder="Tên đầy đủ"
            {...register("fullname")}
          />
          {errors.fullname && (
            <span className="text-red-600 text-sm mt-1 block text-left">
              {errors.fullname.message}
            </span>
          )}

          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition"
            placeholder="Tên người dùng"
            {...register("username")}
          />
          {errors.username && (
            <span className="text-red-600 text-sm mt-1 block text-left">
              {errors.username.message}
            </span>
          )}

          <button className="w-full bg-blue-500 text-white font-semibold py-3 rounded-lg hover:bg-blue-600 transition">
            Đăng ký
          </button>
        </form>
      </div>

      <div className="bg-white mt-4 p-4 border border-gray-300 rounded-lg text-center w-96">
        Bạn có tài khoản?{" "}
        <Link
          to="/login"
          className="text-blue-600 font-semibold hover:underline"
        >
          Đăng nhập
        </Link>
      </div>
      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default Register;
