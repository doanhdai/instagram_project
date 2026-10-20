package com.example.backend_instagram.controller;

import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.dto.user.LoginDTO;
import com.example.backend_instagram.dto.user.ResCreateUserDTO;
import com.example.backend_instagram.dto.user.RestLogin;
import com.example.backend_instagram.service.UserService;
import com.example.backend_instagram.utils.SecurityUntil;
import com.example.backend_instagram.utils.constant.ApiMessage;
import com.example.backend_instagram.utils.error.IdInvalidException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class AuthController {

  private final AuthenticationManagerBuilder authenticationManagerBuilder;
  private final SecurityUntil securityUntil;
  private final UserService userService;
  private final PasswordEncoder passwordEncoder;

  public AuthController(
    AuthenticationManagerBuilder authenticationManagerBuilder,
    SecurityUntil securityUntil,
    UserService userService,
    PasswordEncoder passwordEncoder
  ) {
    this.authenticationManagerBuilder = authenticationManagerBuilder;
    this.securityUntil = securityUntil;
    this.userService = userService;
    this.passwordEncoder = passwordEncoder;
  }

  @PostMapping("/auth/login")
  public ResponseEntity<RestLogin> login(@Valid @RequestBody LoginDTO loginDTO)
    throws IdInvalidException {
    User currentuserDb =
      this.userService.handleGetUserByUserNawm(loginDTO.getUsername());

    if (currentuserDb == null) {
      throw new IdInvalidException("Người dùng không tồn tại trong hệ thống");
    }

    if (
      !passwordEncoder.matches(
        loginDTO.getPassword(),
        currentuserDb.getUserPassword()
      )
    ) {
      throw new IdInvalidException("Mật khẩu người dùng không đúng");
    }
    UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
      loginDTO.getUsername(),
      loginDTO.getPassword()
    );

    Authentication authentication = authenticationManagerBuilder
      .getObject()
      .authenticate(authenticationToken);

    SecurityContextHolder.getContext().setAuthentication(authentication);
    RestLogin restLogin = new RestLogin();

    // Cập nhật trạng thái online
    currentuserDb.setIsOnline(true);
    userService.updateUser(currentuserDb);

    RestLogin.UserLogin userLogin = new RestLogin.UserLogin(
      currentuserDb.getId(),
      currentuserDb.getUserEmail(),
      currentuserDb.getUserFullname(),
      currentuserDb.getUserImage(),
      currentuserDb.getUserNickname()
    );
    restLogin.setUser(userLogin);

    String access_token =
      this.securityUntil.createToken(
          authentication.getName(),
          restLogin.getUser()
        );
    restLogin.setAccessToken(access_token);

    // Create refresh token
    String refresh_token =
      this.securityUntil.refreshToken(loginDTO.getUsername(), restLogin);

    // Update user token
    this.userService.updateUserToken(refresh_token, loginDTO.getUsername());

    // Set cookie
    ResponseCookie responseCookie = ResponseCookie
      .from("refresh_token", refresh_token)
      .httpOnly(true)
      .secure(true)
      .sameSite("None")
      .path("/")
      .maxAge(60)
      .build();
    return ResponseEntity
      .ok()
      .header(
        org.springframework.http.HttpHeaders.SET_COOKIE,
        responseCookie.toString()
      )
      .body(restLogin);
  }

  @GetMapping("/auth/account")
  @ApiMessage("fetch account")
  public ResponseEntity<RestLogin.UserGetAccout> getAccount() {
    String email = this.securityUntil.getCurrentUserLogin().isPresent()
      ? SecurityUntil.getCurrentUserLogin().get()
      : "";
    User currentuserDb = this.userService.handleGetUserByUserNawm(email);
    RestLogin.UserLogin userlogin = new RestLogin.UserLogin();
    RestLogin.UserGetAccout userGetAccout = new RestLogin.UserGetAccout();
    if (currentuserDb != null) {
      userlogin.setId(currentuserDb.getId());
      userlogin.setEmail(currentuserDb.getUserEmail());
      userlogin.setName(currentuserDb.getUserFullname());
      userGetAccout.setUser(userlogin);
    }
    return ResponseEntity.ok().body(userGetAccout);
  }

  @GetMapping("/auth/refresh")
  @ApiMessage("Get user by refesh token")
  public ResponseEntity<RestLogin> getRefreshLogin(
    @CookieValue(name = "refresh_token") String refresh_token
  ) throws IdInvalidException {
    //check valid
    org.springframework.security.oauth2.jwt.Jwt decodetoke =
      this.securityUntil.checkValidRefreshToken(refresh_token);
    String email = decodetoke.getSubject();

    //issue new token/set refresh token as cookies

    RestLogin restLogin = new RestLogin();
    User currentuserDb = this.userService.handleGetUserByUserNawm(email);
    if (currentuserDb != null) {
      RestLogin.UserLogin userLogin = new RestLogin.UserLogin(
        currentuserDb.getId(),
        currentuserDb.getUserEmail(),
        currentuserDb.getUserFullname(),
        currentuserDb.getUserImage(),
        currentuserDb.getUserNickname()
      );
      restLogin.setUser(userLogin);
    }

    User currentUser =
      this.userService.getUserByRefreshTokenAndUserEmail(refresh_token, email);
    if (currentUser == null) {
      throw new IdInvalidException("refresh token ko hợp lệ");
    }
    String accsess_token =
      this.securityUntil.createToken(email, restLogin.getUser());

    restLogin.setAccessToken(accsess_token);

    //create refesh- token
    String new_refresh_token =
      this.securityUntil.refreshToken(email, restLogin);

    //updateUserupdateUser
    this.userService.updateUserToken(new_refresh_token, email);

    //set cooke

    ResponseCookie responseCookie = ResponseCookie
      .from("refresh_token", refresh_token)
      .httpOnly(true)
      .secure(true)
      .path("/")
      .maxAge(60)
      .build();
    return ResponseEntity
      .ok()
      .header(
        org.springframework.http.HttpHeaders.SET_COOKIE,
        responseCookie.toString()
      )
      .body(restLogin);
  }

  @PostMapping("/auth/logout")
  @ApiMessage("loout User")
  public ResponseEntity<Void> logout() throws IdInvalidException {
    String email = SecurityUntil.getCurrentUserLogin().isPresent()
      ? SecurityUntil.getCurrentUserLogin().get()
      : "";

    if (email.equals("")) {
      throw new IdInvalidException("Access Token khong hop le");
    }

    this.userService.updateUserToken((null), email);
    ResponseCookie deleteSpringCookie = ResponseCookie
      .from("refresh_token", "")
      .httpOnly(true)
      .secure(true)
      .path("/")
      .maxAge(0)
      .build();
    return ResponseEntity
      .ok()
      .header(
        org.springframework.http.HttpHeaders.SET_COOKIE,
        deleteSpringCookie.toString()
      )
      .body(null);
  }

  // register
  @PostMapping("/auth/register")
  @ApiMessage("User Register")
  public ResponseEntity<ResCreateUserDTO> userRegister(
    @Valid @RequestBody User bodyUser
  ) throws IdInvalidException {
    User currentDb =
      this.userService.handleGetUserByUserNawm(bodyUser.getUserEmail());
    if (currentDb != null) {
      throw new IdInvalidException("Người dùng đã tồn tại trong hệ thống");
    }

    if (this.userService.isNikNameExsit(bodyUser.getUserNickname())) {
      throw new IdInvalidException(
        "Nickname đã tồn tại. Vui lòng chọn nickname khác!"
      );
    }

    String hassPassWord =
      this.passwordEncoder.encode(bodyUser.getUserPassword());
    bodyUser.setUserPassword(hassPassWord);
    User listUser = this.userService.createUser(bodyUser);
    return ResponseEntity
      .status(HttpStatus.CREATED)
      .body(this.userService.convertToResCreateUserDTO(listUser));
  }
}