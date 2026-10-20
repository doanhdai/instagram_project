package com.example.backend_instagram.service;

import com.example.backend_instagram.dto.post.CreatePostRequest;
import com.example.backend_instagram.entity.Follow;
import com.example.backend_instagram.entity.Media;
import com.example.backend_instagram.entity.Post;
import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.repository.FollowRepository;
import com.example.backend_instagram.repository.MediaRepository;
import com.example.backend_instagram.repository.PostRepository;
import com.example.backend_instagram.repository.UserRepository;
import com.example.backend_instagram.utils.AwsS3Service;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PostService {
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final MediaRepository mediaRepository;
    private final AwsS3Service awsS3Service;
    private final FollowRepository followRepository;

    public PostService(PostRepository postRepository,
            UserRepository userRepository,
            MediaRepository mediaRepository,
            FollowRepository followRepository,
            AwsS3Service awsS3Service) {
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.mediaRepository = mediaRepository;
        this.followRepository = followRepository;
        this.awsS3Service = awsS3Service;
    }

    @Transactional
    public Post createPost(Long userId, CreatePostRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Post post = new Post();
        post.setTitle(request.getTitle());
        post.setUser(user);
        post.setStatus(request.getStatus());
        post.setAccess(request.getAccess());
        post.setLikesCount(0);
        post.setCommentsCount(0L);
        post = postRepository.save(post);

        List<Media> mediaList = new ArrayList<>();

        for (MultipartFile file : request.getMedia()) {
            try {
                String originalFilename = file.getOriginalFilename();
                String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
                String mediaType = file.getContentType().startsWith("image/") ? "IMAGE" : "VIDEO";
                String fileName = System.currentTimeMillis() + "_" + mediaType.toLowerCase() + extension;
                String url = awsS3Service.uploadFile(fileName, file.getBytes());

                Media media = new Media();
                media.setUrl(url);
                media.setType(mediaType);
                media.setPost(post);
                media = mediaRepository.save(media);

                mediaList.add(media);
            } catch (IOException e) {
                throw new RuntimeException("Failed to process file: " + e.getMessage());
            }
        }

        post.setMedia(mediaList);
        return postRepository.save(post);
    }

    public List<Post> getAllPostsByUserId(Long userId) {
        return postRepository.findByUserIdAndStatus(userId, "True");
    }

    public List<Post> getAllPosts() {
        return postRepository.findByStatus("True");
    }

    public Post savePost(Post post) {
        return postRepository.save(post);
    }

    public List<Post> getAllAdmin() {
        return postRepository.findAll();
    }

    @Transactional
    public Post updatePost(Long postId, CreatePostRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        post.setTitle(request.getTitle());
        post.setStatus(request.getStatus());
        post.setAccess(request.getAccess());

        if (request.getMedia() != null && !request.getMedia().isEmpty()) {
            for (Media oldMedia : post.getMedia()) {
                // awsS3Service.deleteFile(oldMedia.getUrl());
            }
            post.getMedia().clear();

            List<Media> mediaList = new ArrayList<>();
            for (MultipartFile file : request.getMedia()) {
                try {
                    String originalFilename = file.getOriginalFilename();
                    String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
                    String mediaType = file.getContentType().startsWith("image/") ? "IMAGE" : "VIDEO";
                    String fileName = System.currentTimeMillis() + "_" + mediaType.toLowerCase() + extension;
                    String url = awsS3Service.uploadFile(fileName, file.getBytes());

                    Media media = new Media();
                    media.setUrl(url);
                    media.setType(mediaType);
                    media.setPost(post);
                    media = mediaRepository.save(media);
                    mediaList.add(media);
                } catch (IOException e) {
                    throw new RuntimeException("Failed to process file: " + e.getMessage());
                }
            }
            post.setMedia(mediaList);
        }

        return postRepository.save(post);
    }

    @Transactional
    public void deletePost(Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        post.setStatus("false");
        postRepository.save(post);
    }

    public Post getPostById(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
    }

    @Transactional
    public Post updatePostStatus(Long postId, String status) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        if (status == null) {
            throw new IllegalArgumentException("Status parameter is required");
        }

        // Clean up the status value
        String normalizedStatus = status.trim().toLowerCase();
        // Remove any commas and whitespace
        normalizedStatus = normalizedStatus.replaceAll("[, ]", "");

        if (!normalizedStatus.equals("true") && !normalizedStatus.equals("false") && !normalizedStatus.equals("1")) {
            throw new IllegalArgumentException("Status must be either 'true', 'false' or '1'");
        }

        // Convert status to proper format
        String finalStatus = normalizedStatus.equals("true") || normalizedStatus.equals("1") ? "True" : "false";
        post.setStatus(finalStatus);
        return postRepository.save(post);
    }

    public List<Post> getPostsFromFollowing(Long userId) {
        // Lấy danh sách người dùng mà userId đang theo dõi
        List<Follow> following = followRepository.findByFollowerId(userId);
        List<Long> followingIds = following.stream()
                .map(follow -> follow.getFollowing().getId())
                .collect(Collectors.toList());
        return postRepository.findByUserIdInAndStatusAndAccess(followingIds, "True", "PUBLIC");
    }
}