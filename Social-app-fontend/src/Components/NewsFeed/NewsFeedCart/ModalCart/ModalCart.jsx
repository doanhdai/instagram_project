// import không đổi
import React, { useState, useEffect } from "react";
import { GrFormPrevious, GrFormNext } from "react-icons/gr";
import {
  getCommentsByPostId,
  addComment,
} from "../../../../Service/commentApi";
import { useDispatch, useSelector } from "react-redux";
import notificationSocket from "../../../../Service/NotificationSocket";
import { useTranslation } from "react-i18next";
import { handleUpdateStatus } from "../../../../Service/postApi";
import { toast } from "react-toastify";

const ModalCart = ({
  isOpen,
  setIsOpen,
  post,
  onCommentAdded,
  fetchPostData,
}) => {
  const { userInfo } = useSelector((state) => state.login);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [likes, setLikes] = useState(post?.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(post?.commentsCount || 0);
  const userredux = useSelector((state) => state.login.userInfo);
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => {
    if (!isOpen || !post?.id || !userInfo?.id) return;
    const fetchComments = async () => {
      try {
        const response = await getCommentsByPostId(post.id);
        setComments(response.data || []);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();
  }, [isOpen, post?.id, userInfo?.id]);

  useEffect(() => {
    // notificationSocket.init(dispatch, userInfo.id);
    notificationSocket.subscribeToCommentUpdates((comment) => {
      if (comment.postId === post.id) {
        setComments((prev) => {
          if (prev.some((c) => c.id === comment.id)) return prev;
          return [comment, ...prev];
        });
        if (comment.commentsCount != null) {
          setCommentsCount(comment.commentsCount);
          onCommentAdded(post.id, comment.commentsCount);
        }
      }
    });
    return () => {
      notificationSocket.disconnect();
    };
  }, [userInfo?.id, dispatch, post?.id]);

  const handleLike = () => setLikes((prev) => prev + 1);
  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    try {
      await addComment(post.id, userInfo.id, newComment);
      const response = await getCommentsByPostId(post.id);
      setComments(response.data || []);
      onCommentAdded(post.id, response.data[0].commentsCount);
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % post.media.length);
  };
  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? post.media.length - 1 : prev - 1
    );
  };
  const formatTimeAgo = (date) => {
    const now = new Date();
    const commentDate = new Date(date);
    const diffInSeconds = Math.floor((now - commentDate) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} giây`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} ngày`;
    return `${Math.floor(diffInSeconds / 604800)} tuần`;
  };
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDeletePost = async (post) => {
    const data = {
      id: post.id,
      status: "False",
    };
    const response = await handleUpdateStatus(data);
    if (response && response.statusCode === 200) {
      fetchPostData();
      setIsOpen(false);
      toast.success("Xóa bài viết thành công");
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-80">
      <div className="relative flex w-[90%] max-w-5xl h-[85vh] bg-black rounded-xl overflow-hidden border border-gray-700 shadow-lg">
        {/* Image/Video Section */}
        <div className="w-1/2 bg-black relative">
          {post?.media?.[currentImageIndex]?.type === "VIDEO" ? (
            <video
              src={post?.media?.[currentImageIndex]?.url}
              className="w-full h-full object-contain"
              controls
              autoPlay
              loop
            />
          ) : (
            <img
              src={
                post?.media?.[currentImageIndex]?.url ||
                "https://via.placeholder.com/150"
              }
              className="w-full h-full object-contain"
              alt="Post"
            />
          )}
          {post?.media?.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black/60 p-2 rounded-full text-white hover:bg-black/80"
              >
                <GrFormPrevious size={24} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black/60 p-2 rounded-full text-white hover:bg-black/80"
              >
                <GrFormNext size={24} />
              </button>
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                {currentImageIndex + 1}/{post.media.length}
              </div>
            </>
          )}
        </div>

        {/* Comment Section */}
        <div className="w-1/2 flex flex-col justify-between p-4 bg-black text-white overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-2">
            {/* Avatar + Nickname + Time + Access */}
            <div className="flex items-center gap-3">
              <img
                src={post?.user?.userImage || "https://via.placeholder.com/150"}
                className="w-10 h-10 rounded-full border-2 border-pink-500 object-cover"
                alt="User"
              />
              <div className="flex flex-col">
                <p className="text-sm font-medium text-white">
                  {post?.user?.userNickname || "Unknown"}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <span>
                    {new Date(post?.createdAt).toLocaleString("vi-VN")}
                  </span>

                  {post?.access === "PUBLIC" && (
                    <div className="relative group">
                      <span title={t("newFed.public")} className="text-sm">
                        🌍
                      </span>
                    </div>
                  )}
                  {post?.access === "FRIENDS" && (
                    <div className="relative group">
                      <span title="Chỉ bạn bè" className="text-sm">
                        👥
                      </span>
                    </div>
                  )}
                  {post?.access === "PRIVATE" && (
                    <div className="relative group">
                      <span title={t("newFed.private")} className="text-sm">
                        🔒
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: ... and ✖ */}
            <div className="flex items-center gap-2">
              {userredux?.id === post.user?.id ? (
                <div
                  className="text-xl cursor-pointer text-gray-400 hover:text-white"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  ...
                </div>
              ) : (
                ""
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition text-xl"
              >
                ✖
              </button>
              {showMenu && (
                <ul className="absolute top-14 right-0 w-40 bg-neutral-800 border border-neutral-700 rounded-md shadow-md overflow-hidden text-sm z-50">
                  <li
                    className="px-4 py-2 hover:bg-neutral-700 cursor-pointer"
                    onClick={() => handleDeletePost(post)}
                  >
                    Xóa bài viết
                  </li>
                  <li className="px-4 py-2 hover:bg-neutral-700 cursor-pointer">
                    Chỉnh sửa đối tượng
                  </li>
                </ul>
              )}
            </div>
          </div>

          {/* Caption */}

          {/* Comment List */}
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có bình luận nào</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2 mb-4">
                  <img
                    src={comment.userImage || "https://via.placeholder.com/150"}
                    className="w-8 h-8 rounded-full object-cover border border-gray-600"
                    alt="User"
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-medium text-white text-sm">
                        {comment.userNickname}
                      </p>
                      <p className="text-gray-300 text-sm">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-500">
                        {formatTimeAgo(comment.createdAt)}
                      </p>
                      <button className="text-xs text-gray-500 hover:text-gray-300">
                        Trả lời
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment */}
          <div className="mt-3 flex items-center border-t border-gray-600 pt-3">
            <input
              type="text"
              placeholder="Viết bình luận..."
              className="flex-1 bg-transparent text-sm px-3 py-2 outline-none"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              className="ml-3 px-4 py-1.5 bg-pink-600 rounded text-white text-sm hover:bg-pink-700 transition"
              onClick={handleCommentSubmit}
            >
              Đăng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalCart;
