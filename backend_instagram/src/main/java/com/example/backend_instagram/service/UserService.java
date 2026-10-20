package com.example.backend_instagram.service;

import com.example.backend_instagram.dto.user.ResCreateUserDTO;
import com.example.backend_instagram.dto.user.RestUpdateUser;
import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.repository.UserRepository;
import com.example.backend_instagram.repository.PostRepository;
import com.example.backend_instagram.dto.user.UserStatsDTO;
import com.example.backend_instagram.service.FollowService;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserService {

  private final UserRepository userRepository;
  private final PostRepository postRepository;
  private final FollowService followService;

  @Autowired
  public UserService(UserRepository userRepository, PostRepository postRepository, FollowService followService) {
    this.userRepository = userRepository;
    this.postRepository = postRepository;
    this.followService = followService;
  }

  public User createUser(User user) {
    return this.userRepository.save(user);
  }

  public User handleGetUserByUserNawm(String username) {
    return this.userRepository.findByUserEmail(username);
  }

  public List<User> getAllUser() {
    return this.userRepository.findAll();
  }

  public boolean isEmailExist(String email) {
    return this.userRepository.existsByUserEmail(email);
  }

  public boolean isNikNameExsit(String nikname) {
    return this.userRepository.existsByUserNickname(nikname);
  }

  public void updateUserToken(String refreshToken, String username) {
    User user = handleGetUserByUserNawm(username);
    if (user != null) {
      user.setRefreshToken(refreshToken);
      userRepository.save(user);
    }
  }

  public void updateUser(User user) {
    userRepository.save(user);
  }

  public User fetchUserById(Long id) {
    Optional<User> userOptional = this.userRepository.findById(id);
    if (userOptional.isPresent()) {
      return userOptional.get();
    }
    return null;
  }

  public User handleUpdateUser(User user) {
    User userUPdate = this.fetchUserById(user.getId());

    if (userUPdate != null) {
      userUPdate.setUserNickname(user.getUserNickname());
      userUPdate.setUserBio(user.getUserBio());
      userUPdate.setUserPhone(user.getUserPhone());
      userUPdate.setUserImage(user.getUserImage());
    }
    return this.userRepository.save(userUPdate);
  }

  public ResCreateUserDTO convertToResCreateUserDTO(User user) {
    ResCreateUserDTO resCreateUserDTO = new ResCreateUserDTO();
    resCreateUserDTO.setId(user.getId());
    resCreateUserDTO.setName(user.getUserFullname());
    resCreateUserDTO.setUserNikName(user.getUserNickname());
    resCreateUserDTO.setEmail(user.getUserEmail());
    resCreateUserDTO.setUserBio(user.getUserBio());
    resCreateUserDTO.setUserBday(user.getUserBday());
    resCreateUserDTO.setCreatedAt(user.getCreatedAt().toInstant(java.time.ZoneOffset.UTC));
    resCreateUserDTO.setGender(user.getUserGender());
    return resCreateUserDTO;
  }

  public RestUpdateUser convertToResUpdateUpdateUserDTO(User user) {
    RestUpdateUser restUpdateUser = new RestUpdateUser();
    restUpdateUser.setId(user.getId());
    restUpdateUser.setName(user.getUserFullname());
    restUpdateUser.setEmail(user.getUserEmail());
    restUpdateUser.setUserBday(user.getUserBday());
    restUpdateUser.setUserGender(user.getUserGender());
    restUpdateUser.setUserImage(user.getUserImage());
    restUpdateUser.setUserNikName(user.getUserNickname());
    restUpdateUser.setUserPhone(user.getUserPhone());

    return restUpdateUser;
  }

  public User getUserByRefreshTokenAndUserEmail(String token, String email) {
    return this.userRepository.findByRefreshTokenAndUserEmail(token, email);
  }

  public boolean deleteUser(String userId) {
    try {
      this.userRepository.deleteById(Long.parseLong(userId));
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  public UserStatsDTO getUserStats(Long userId) {
    User user = fetchUserById(userId);
    Long followersCount = followService.countFollowersOfUser(userId);
    Long followingCount = followService.countFollowingOfUser(userId);
    Long postsCount = postRepository.countByUserId(userId);
    
    return new UserStatsDTO(user, followersCount, followingCount, postsCount);
  }

  public User getUserById (Long userId) {
    return this.userRepository.findById(userId).orElse(null);
  }

}
