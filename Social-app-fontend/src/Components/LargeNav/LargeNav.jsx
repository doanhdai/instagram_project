import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";

import InstagramLogo from "../../assets/logo/instagram.png";
import InstagramIcon from "../../assets/logo/icon.png";
import HomeLogo from "../../assets/navlogo/home.png";
import SearchLogo from "../../assets/navlogo/search.png";
import MessagesLogo from "../../assets/navlogo/message.png";
import NotificationsLogo from "../../assets/navlogo/like.png";
import CreateLogo from "../../assets/navlogo/create.png";
import MoreLogo from "../../assets/navlogo/more.png";
import MoreMenu from "./MoreMenu/MoreMenu";
import MenuFormGenerate from "./FormGenerate/FormGenerate";
import Route from "../../Components/Routes/index";
import SearchPanel from "../../Components/SearchBar/SearchBar";
import notificationSocket from "../../Service/NotificationSocket";
import {
  fetchAllNotificationsUnread,
  setHasUnread,
} from "../../Service/notificationApi";
import { da } from "date-fns/locale";

const LargeNav = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const { userInfo } = useSelector((state) => state.login);
  const dispatch = useDispatch();
  const [t] = useTranslation();

  // Khởi tạo WebSocket và lắng nghe sự kiện like_update và comment_update
  useEffect(() => {
    if (!userInfo?.id) return;

    // Khởi tạo WebSocket
    notificationSocket.init(dispatch, userInfo.id);

    notificationSocket.subscribeToNotifications((notificationData) => {
      console.log("New notification received:", notificationData);
      // Hiển thị dấu chấm đỏ nếu người dùng hiện tại là receiver
      if (notificationData.userId === userInfo.id) {
        setHasUnreadNotifications(true);
      } else {
        console.log("Ignoring notification:", notificationData);
      }
    });

    notificationSocket.subscribeToLikeUpdates((notification) => {
      console.log("New like received:", notification);
      // if (Number(notification.receiverId) === Number(userInfo.id)) {
      setHasUnreadNotifications(true);
      // }
    });

    // Lắng nghe sự kiện bình luận mới
    notificationSocket.subscribeToCommentUpdates((commentData) => {
      console.log("New comment received:", commentData);
      if (commentData.userId != userInfo.id) {
        setHasUnreadNotifications(true);
      }
    });

    notificationSocket.subscribeToFollow((data) => {
      console.log("New follow received:", data);
      // if (data.userId != userInfo.id) {
      setHasUnreadNotifications(true);
      // }
    });

    return () => {
      notificationSocket.disconnect();
    };
  }, [userInfo?.id, dispatch]);

  const sidebarItems = useMemo(
    () => [
      { name: t("LargeNav.home"), link: Route.default_session, icon: HomeLogo },
      { name: t("LargeNav.search"), link: Route.search, icon: SearchLogo },
      { name: t("LargeNav.messages"), link: Route.chat, icon: MessagesLogo },
      {
        name: t("LargeNav.notifications"),
        link: Route.notification,
        icon: NotificationsLogo,
        hasBadge: hasUnreadNotifications,
      },
    ],
    [t, hasUnreadNotifications]
  );

  const handleShowMenu = () => {
    setShowMenu((prev) => !prev);
  };

  // Xử lý khi nhấp vào Notifications để tắt dấu chấm đỏ
  const handleNotificationsClick = async () => {
    setHasUnreadNotifications(false);
    try {
      console.log("Marked all notifications as read for user:", userInfo.id);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  return (
    <>
      <div className="w-[270px] h-screen flex flex-col px-3 py-10 bg-black fixed border-r border-gray-800">
        {/* Logo */}
        <Link to={Route.newsfeed} className="mb-5 flex px-3">
          <img
            src={InstagramLogo}
            alt="instagram logo"
            className="w-32 h-auto hidden lg:block"
          />
          <img
            src={InstagramIcon}
            alt="instagram icon"
            className="w-10 h-auto lg:hidden"
          />
        </Link>

        {/* Sidebar Menu */}
        <div className="flex flex-col space-y-2">
          {sidebarItems.map((item) => {
            if (item.name === t("LargeNav.search")) {
              return (
                <button
                  key={item.name}
                  onClick={() => setOpenSearch((prev) => !prev)}
                  className="flex items-center gap-x-4 p-3 hover:bg-gray-800/60 rounded-md text-left relative"
                >
                  <img
                    src={item.icon}
                    alt={`${item.name} icon`}
                    className="w-7 h-7"
                  />
                  <p className="text-lg text-white hidden lg:block">
                    {item.name}
                  </p>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.link}
                onClick={
                  item.name === t("LargeNav.notifications")
                    ? handleNotificationsClick
                    : undefined
                }
                className="flex items-center gap-x-4 p-3 hover:bg-gray-800/60 rounded-md relative"
              >
                <div className="relative">
                  <img
                    src={item.icon}
                    alt={`${item.name} icon`}
                    className="w-7 h-7"
                  />
                  {/* Dấu chấm đỏ cho thông báo chưa đọc */}
                  {item.hasBadge && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </div>
                <p className="text-lg text-white hidden lg:block">
                  {item.name}
                </p>
              </Link>
            );
          })}

          {/* Search panel */}
          {openSearch && (
            <SearchPanel isOpen={true} onClose={() => setOpenSearch(false)} />
          )}

          {/* Nút mở Modal Tạo Post và Story */}
          <button
            onClick={() => setShowCreateModal((prev) => !prev)}
            className="flex items-center gap-x-4 p-3 hover:bg-gray-800/60 rounded-md text-left"
          >
            <img src={CreateLogo} alt="create icon" className="w-7 h-7" />
            <p className="text-lg text-white hidden lg:block">
              {t("LargeNav.create")}
            </p>
          </button>
        </div>

        {/* More Menu */}
        <div>
          <button
            className="flex items-center w-full gap-x-4 p-3 hover:bg-gray-800/60 rounded-md"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <img src={MoreLogo} alt="more icon" className="w-7 h-7" />
            <p className="text-lg text-white hidden lg:block">
              {t("LargeNav.more")}
            </p>
          </button>
        </div>

        {/* Hiển thị các modal */}
        <MoreMenu showMenu={showMenu} setShowMenu={setShowMenu} />
        <MenuFormGenerate
          showCreateModal={showCreateModal}
          setShowCreateModal={setShowCreateModal}
        />
      </div>
    </>
  );
};

export default LargeNav;
