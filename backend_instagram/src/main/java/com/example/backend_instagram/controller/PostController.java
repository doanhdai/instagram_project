package com.example.backend_instagram.controller;

import com.example.backend_instagram.dto.post.CreatePostRequest;
import com.example.backend_instagram.entity.Post;
import com.example.backend_instagram.service.CommentService;
import com.example.backend_instagram.service.LikeService;
import com.example.backend_instagram.service.PostService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/v1/posts")
public class PostController {
    private final PostService postService;
    private final LikeService likeService;
    private final CommentService commentService;

    public PostController(PostService postService, LikeService likeService, CommentService commentService) {
        this.postService = postService;
        this.likeService = likeService;
        this.commentService = commentService;
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<Post> createPost(
            @RequestParam("userId") Long userId,
            @RequestParam("title") String title,
            @RequestParam("media") List<MultipartFile> media,
            @RequestParam("status") String status,
            @RequestParam("access") String access) {
        CreatePostRequest request = new CreatePostRequest();
        request.setTitle(title);
        request.setMedia(media);
        request.setStatus(status);
        request.setAccess(access);
        Post post = postService.createPost(userId, request);
        return ResponseEntity.ok(post);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Post>> getAllPostsByUserId(@PathVariable Long userId) {
        List<Post> posts = postService.getAllPostsByUserId(userId);
        return ResponseEntity.ok(posts);
    }

    @GetMapping
    public ResponseEntity<List<Post>> getAllPosts() {
        List<Post> posts = postService.getAllPosts();
        return ResponseEntity.ok(posts);
    }

    @PutMapping("/{postId}")
    public ResponseEntity<Post> updatePost(
            @PathVariable Long postId,
            @RequestParam("title") String title,
            @RequestParam(value = "media", required = false) List<MultipartFile> media,
            @RequestParam("status") String status,
            @RequestParam("access") String access) {
        CreatePostRequest request = new CreatePostRequest();
        request.setTitle(title);
        request.setMedia(media);
        request.setStatus(status);
        request.setAccess(access);
        Post updatedPost = postService.updatePost(postId, request);
        return ResponseEntity.ok(updatedPost);
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long postId) {
        postService.deletePost(postId);
        return ResponseEntity.ok().build();
    }

 

    @GetMapping("/admin") 
    public ResponseEntity<List<Post>> getAllPostsAdmin() {
        List<Post> posts = postService.getAllAdmin();
        return ResponseEntity.ok(posts);
    }
     

    @PostMapping("/{postId}/like")
    public ResponseEntity<Map<String, String>> likePost(
            @PathVariable Long postId,
            @RequestParam Long userId) {
        likeService.likePost(postId, userId);
        return ResponseEntity.ok(Map.of("message", "Thích bài viết thành công"));
    }

    @DeleteMapping("/{postId}/like")
    public ResponseEntity<Map<String, String>> unlikePost(
            @PathVariable Long postId,
            @RequestParam Long userId) {
        likeService.unlikePost(postId, userId);
        return ResponseEntity.ok(Map.of("message", "Bỏ thích bài viết thành công"));
    }


    @PostMapping("/{postId}/comment")
    public ResponseEntity<Map<String, String>> addComment(
            @PathVariable Long postId,
            @RequestParam Long userId,
            @RequestBody Map<String, String> request) {
        String content = request.get("content");
        commentService.addComment(postId, userId, content);
        return ResponseEntity.ok(Map.of("message", "Bình luận thành công"));
    }

    @PutMapping("/updateStatus")
    public ResponseEntity<Post> UpdateStatusAdmin(  @RequestBody Post post) {
    Post post1 = postService.updatePostStatus(post.getId(),post.getStatus());
    return ResponseEntity.ok(post1);
    }

    @GetMapping("/following/{userId}")
    public ResponseEntity<List<Post>> getPostsFromFollowing(@PathVariable Long userId) {
        List<Post> posts = postService.getPostsFromFollowing(userId);
        return ResponseEntity.ok(posts);
    }

    @GetMapping("/liked/user/{userId}")
    public ResponseEntity<List<Long>> getLikedPostIdsByUser(@PathVariable Long userId) {
        List<Long> likedPostIds = likeService.getLikedPostIdsByUser(userId);
        return ResponseEntity.ok(likedPostIds);
    }
}