import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Language from "./Language/Language";
import { useTranslation } from "react-i18next";
import { UserLogOut } from "../../../Service/AuthApi";
import { userLogoutALL } from "../../../Redux/Reducer/UserAppDeucer";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import instance from "../../../Utils/AxiosApi/Axios";

const MoreMenu = (props) => {
  const { showMenu, setShowMenu } = props;
  let navi = useNavigate();
  let dispatch = useDispatch();
  const [t] = useTranslation();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  let lang = useSelector((state) => state.app.language);
  useEffect(() => {
    setShowMenu(false);
  }, [lang]);
  const handleLogOut = async () => {
    try {
      let res = await UserLogOut();
      if (res && res.statusCode === 200) {
        toast.success("Đăng xuất thành công!");
        await dispatch(userLogoutALL());
        instance.defaults.headers.common = {};
      } else {
        toast.error("Đăng xuất thất bại, vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
      toast.error("Có lỗi xảy ra khi đăng xuất.");
    }
  };

  return (
    <div className="relative w-full top-60">
      {showMenu && (
        <div className="absolute bottom-12 left-0 bg-white rounded-lg shadow-lg w-56 p-2">
          <ul className="text-black">
            <li className="p-2 hover:bg-gray-200 cursor-pointer">
              {" "}
              {t("menu.setting")}
            </li>
            <Language />
            <li className="p-2 hover:bg-gray-200 cursor-pointer">
              {t("moreMenu.activity")}
            </li>
            <hr className="my-2" />
          </ul>
          <button
            onClick={handleLogOut}
            className="w-full text-left p-2 hover:bg-gray-200 cursor-pointer text-red-500"
          >
            {t("moreMenu.logout")}
          </button>
        </div>
      )}
    </div>
  );
};

export default MoreMenu;
