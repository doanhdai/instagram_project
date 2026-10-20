import React, { useEffect, useState } from "react";
import ModalCart from "./ModalCart/ModalCart";
import { useSelector, useDispatch } from "react-redux";
import {
  handleGetAllPostByUserId,
  getAllPost,
  handleLike,
  getPostByFollowing,
  getLikedPostIdsByUser,
} from "../../../Service/postApi";
import { formatTime } from "../../../Utils";
import { GrFormPrevious, GrFormNext } from "react-icons/gr";
import notificationSocket from "../../../Service/NotificationSocket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getCommentsByPostId } from "../../../Service/commentApi";
import { CiHeart } from "react-icons/ci";
import { FaRegComment } from "react-icons/fa";
import { BsBookmark } from "react-icons/bs";
import { FaHeart } from "react-icons/fa";
import { useTranslation } from "react-i18next";

const NewsFeedCart = () => {
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [newComments, setNewComments] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [postData, setPostData] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [check, setCheck] = useState(false);
  const { userInfo } = useSelector((state) => state.login);
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Hàm lấy danh sách ID bài viết đã thích của người dùng
  const fetchLikedPosts = async (userId) => {
    try {
      const response = await getLikedPostIdsByUser(userId);
      console.log("Liked post IDs:", response.data); // Debug
      return response.data; // Trả về mảng ID bài viết đã thích
    } catch (error) {
      console.error("Error fetching liked posts:", error);
      toast.error("Không thể tải danh sách bài viết đã thích!");
      return []; // Trả về mảng rỗng nếu có lỗi
    }
  };

  const fetchPostData = async () => {
    try {
      const postsResponse = await getPostByFollowing(userInfo.id);
      const filteredPosts = postsResponse.data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setPostData(filteredPosts);

      const initialIndexes = {};
      filteredPosts.forEach((post) => {
        initialIndexes[post.id] = 0;
      });
      setCurrentImageIndex(initialIndexes);

      // Lấy danh sách ID bài viết đã thích và khởi tạo state likes
      const likedPostIds = await fetchLikedPosts(userInfo.id);
      const initialLikes = {};
      filteredPosts.forEach((post) => {
        initialLikes[post.id] = likedPostIds.includes(post.id);
      });
      console.log("Initial likes:", likedPostIds); // Debug
      setLikes(initialLikes);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Không thể tải danh sách bài viết!");
    }
  };

  useEffect(() => {
    if (userInfo?.id) {
      fetchPostData();
    }
  }, [userInfo?.id, check]);

  useEffect(() => {
    if (userInfo?.id) {
      notificationSocket.subscribeToLikeUpdates((data) => {
        setPostData((prev) =>
          prev.map((post) =>
            post.id === data.postId
              ? { ...post, likesCount: data.likesCount }
              : post
          )
        );
      });
    }

    return () => {
      console.log("Disconnecting notification");
      notificationSocket.disconnect();
    };
  }, [userInfo?.id, dispatch]);

  useEffect(() => {
    notificationSocket.subscribeToCommentUpdates((comment) => {
      console.log("Received comment:", comment);
      if (comment.commentsCount != null) {
        setPostData((prev) =>
          prev.map((post) =>
            post.id === comment.postId
              ? { ...post, commentsCount: comment.commentsCount }
              : post
          )
        );
      }
    });
    return () => {
      notificationSocket.disconnect();
    };
  }, [userInfo?.id, dispatch]);

  const handleLikePost = async (id, likesCount) => {
    try {
      if (likes[id]) {
        toast.info("Bạn đã thích bài viết này!");
        return;
      }
      await handleLike(id, userInfo.id);
      const newLikesCount = likesCount + 1;
      setLikes((prevLikes) => ({
        ...prevLikes,
        [id]: true,
      }));
      setPostData((prev) =>
        prev.map((post) =>
          post.id === id ? { ...post, likesCount: newLikesCount } : post
        )
      );
      toast.success("Đã thích bài viết!");
    } catch (error) {
      console.error("Error liking post:", error);
      if (error.response?.data?.message?.includes("đã thích")) {
        toast.info("Bạn đã thích bài viết này!");
      } else {
        toast.error("Không thể thích bài viết!");
      }
    }
  };

  const handleCommentSubmit = async (id) => {
    console.warn("handleCommentSubmit chưa được triển khai hoàn chỉnh");
  };

  const handleModelComment = (post) => {
    setSelectedPost(post);
    setIsOpen(true);
  };

  const handleCommentChange = (id, value) => {
    setNewComments((prev) => ({ ...prev, [id]: value }));
  };

  const nextImage = (postId, totalImages) => {
    setCurrentImageIndex((prev) => ({
      ...prev,
      [postId]: (prev[postId] + 1) % totalImages,
    }));
  };

  const prevImage = (postId, totalImages) => {
    setCurrentImageIndex((prev) => ({
      ...prev,
      [postId]: (prev[postId] - 1 + totalImages) % totalImages,
    }));
  };

  const handleCommentAdded = (postId, commentsCount) => {
    setPostData((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentsCount } : post
      )
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 py-6 bg-black text-white min-h-screen">
      {postData.map((item) => (
        <div
          key={item.id}
          className="w-[35vw] bg-black text-white rounded-lg overflow-hidden border border-neutral-800"
        >
          <div className="flex items-center px-4 py-3">
            <img
              src={item.user?.userImage}
              alt={item.username}
              className="w-10 h-10 rounded-full object-cover mr-3 border border-gray-300"
              style={{ imageRendering: "crisp-edges" }}
            />
            <div className="flex flex-col w-full">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-white">
                  {item.user?.userNickname}
                </h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>{formatTime(item.createdAt, t)}</span>
                {item?.access === "PUBLIC" && (
                  <div className="relative group">
                    <span
                      title={t("newFed.public")}
                      className="text-sm cursor-pointer"
                    >
                      🌍
                    </span>
                  </div>
                )}
                {item?.access === "FRIENDS" && (
                  <div className="relative group">
                    <span title="Chỉ bạn bè" className="text-sm cursor-pointer">
                      👥
                    </span>
                  </div>
                )}
                {item?.access === "PRIVATE" && (
                  <div className="relative group">
                    <span
                      title={t("newFed.private")}
                      className="text-sm cursor-pointer"
                    >
                      🔒
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full max-h-[100vh] overflow-hidden rounded-lg shadow-lg bg-black">
            {item.media && item.media.length > 0 && (
              <>
                {item.media[currentImageIndex[item.id]]?.url.endsWith(
                  ".mp4"
                ) ? (
                  <video
                    className="w-full max-h-[85vh] object-contain transition duration-300 ease-in-out"
                    style={{ imageRendering: "auto" }}
                    src={item.media[currentImageIndex[item.id]]?.url}
                    controls
                    autoPlay={false}
                    muted
                    loading="lazy"
                  >
                    <source
                      src={item.media[currentImageIndex[item.id]]?.url}
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    className="w-full max-h-[85vh] object-contain transition duration-300 ease-in-out"
                    style={{ imageRendering: "auto" }}
                    src={item.media[currentImageIndex[item.id]]?.url}
                    alt={item.caption}
                    loading="lazy"
                  />
                )}

                {item.media.length > 1 && (
                  <>
                    <button
                      onClick={() => prevImage(item.id, item.media.length)}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-70 transition duration-200"
                    >
                      <GrFormPrevious size={24} />
                    </button>
                    <button
                      onClick={() => nextImage(item.id, item.media.length)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-70 transition duration-200"
                    >
                      <GrFormNext size={24} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs font-medium tracking-wide shadow">
                      {currentImageIndex[item.id] + 1} / {item.media.length}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="mt-4 px-4 text-white text-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-4 text-xl">
                <button
                  onClick={() => handleLikePost(item.id, item.likesCount)}
                  className="hover:scale-110 transition"
                >
                  {likes[item.id] ? (
                    <FaHeart className="text-3xl text-red-500" />
                  ) : (
                    <CiHeart className="text-3xl" />
                  )}
                </button>
                <button
                  onClick={() => handleModelComment(item)}
                  className="hover:scale-110 transition"
                >
                  <FaRegComment className="text-2xl" />
                </button>
              </div>
              <button className="hover:scale-110 transition text-2xl">
                <BsBookmark />
              </button>
            </div>

            <p className="font-semibold mb-1">
              {item.likesCount} {t("newFed.like")}
            </p>

            <p className="mb-1 leading-snug">
              <span className="font-semibold">{item.username}</span>{" "}
              {item.title.length > 100 ? (
                <>
                  {item.title.slice(0, 100)}...
                  <button className="text-gray-400 hover:underline ml-1">
                    xem thêm
                  </button>
                </>
              ) : (
                item.title
              )}
            </p>

            <button
              onClick={() => handleModelComment(item)}
              className="text-gray-400 text-sm hover:underline mb-2 block"
            >
              {t("newFed.view")} {item.commentsCount} {t("newFed.comment")}
            </button>

            <ul className="text-sm space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent mb-2">
              {(comments[item.id] || []).map((comment, index) => (
                <li key={index} className="border-b border-gray-700 pb-2">
                  <span className="font-semibold">{item.username}</span>{" "}
                  {comment}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      <ModalCart
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        post={selectedPost}
        comments={comments[selectedPost?.id] || []}
        onCommentAdded={handleCommentAdded}
        onCommentSubmit={(comment) => {
          if (selectedPost) {
            handleCommentSubmit(selectedPost.id);
          }
        }}
        fetchPostData={fetchPostData}
      />
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        style={{ zIndex: 9999 }}
      />
    </div>
  );
};

export default NewsFeedCart;
