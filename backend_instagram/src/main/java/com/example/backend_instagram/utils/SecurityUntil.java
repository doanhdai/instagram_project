package com.example.backend_instagram.utils;

import com.example.backend_instagram.dto.user.RestLogin;
import com.nimbusds.jose.util.Base64;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

@Service
public class SecurityUntil {

  private static JwtEncoder jwtEncoder;

  public SecurityUntil(JwtEncoder jwtEncoder) {
    this.jwtEncoder = jwtEncoder;
  }

  public static final MacAlgorithm JWT_ALGORITHM = MacAlgorithm.HS512;

  @Value("${tenit.jwt.base64-secret}")
  private String jwtKey;

  @Value("${tenit.jwt.token-validity-in-seconds}")
  private long jwtKeyExpiration;

  @Value("${tenit.jwt.refresh-token-validity-in-seconds}")
  private long refreshToken;

  public String createToken(
    String email,
    RestLogin.UserLogin restLogin
    
  ) {
    Instant now = Instant.now();
    Instant validity = now.plus(jwtKeyExpiration, ChronoUnit.SECONDS);

    List<String> listAuthority = new ArrayList<String>();

    listAuthority.add("ROLE_USER-CREATE");
    listAuthority.add("ROLE_USER-UPDATE");

    JwtClaimsSet claims = JwtClaimsSet
      .builder()
      .issuedAt(now)
      .expiresAt(validity)
      .subject(email)
      .claim("user", restLogin)
      .claim("permission", listAuthority)
      .build();

    return this.jwtEncoder.encode(
        JwtEncoderParameters.from(JwsHeader.with(() -> "HS512").build(), claims)
      )
      .getTokenValue();
  }

  public String refreshToken(
    String email,
    com.example.backend_instagram.dto.user.RestLogin restLogin
  ) {
    Instant now = Instant.now();
    Instant validity = now.plus(refreshToken, ChronoUnit.SECONDS);
    JwtClaimsSet claims = JwtClaimsSet
      .builder()
      .issuedAt(now)
      .expiresAt(validity)
      .subject(email)
      .claim("user", restLogin.getUser())
      .build();
    return this.jwtEncoder.encode(
        JwtEncoderParameters.from(JwsHeader.with(() -> "HS512").build(), claims)
      )
      .getTokenValue();
  }

  public static Optional<String> getCurrentUserLogin() {
    SecurityContext securityContext = SecurityContextHolder.getContext();
    return Optional.ofNullable(
      extractPrincipal(securityContext.getAuthentication())
    );
  }

  private static String extractPrincipal(Authentication authentication) {
    if (authentication == null) {
      return null;
    } else if (
      authentication.getPrincipal() instanceof UserDetails springSecurityUser
    ) {
      return springSecurityUser.getUsername();
    } else if (
      authentication.getPrincipal() instanceof org.springframework.security.oauth2.jwt.Jwt jwt
    ) {
      return jwt.getSubject();
    } else if (authentication.getPrincipal() instanceof String s) {
      return s;
    }
    return null;
  }

  public static Optional<String> getCurrentUserJWT() {
    SecurityContext securityContext = SecurityContextHolder.getContext();
    return Optional
      .ofNullable(securityContext.getAuthentication())
      .filter(authentication ->
        authentication.getCredentials() instanceof String
      )
      .map(authentication -> (String) authentication.getCredentials());
  }

  private SecretKey getSecretKey() {
    byte[] keyBytes = Base64.from(jwtKey).decode();
    return new SecretKeySpec(
      keyBytes,
      0,
      keyBytes.length,
      SecurityUntil.JWT_ALGORITHM.getName()
    );
  }

  public org.springframework.security.oauth2.jwt.Jwt checkValidRefreshToken(
    String token
  ) {
    NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder
      .withSecretKey(getSecretKey())
      .macAlgorithm(SecurityUntil.JWT_ALGORITHM)
      .build();

    try {
      return jwtDecoder.decode(token);
    } catch (Exception e) {
      System.out.println(">>> refreshToken error: " + e.getMessage());
      throw e;
    }
  }
}
