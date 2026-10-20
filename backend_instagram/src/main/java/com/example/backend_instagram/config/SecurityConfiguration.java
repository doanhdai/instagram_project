package com.example.backend_instagram.config;

import com.example.backend_instagram.*;
import com.example.backend_instagram.utils.SecurityUntil;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec; 
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfiguration {

  @Value("${tenit.jwt.base64-secret}")
  private String jwtKey;

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

   @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }
  @Bean
  public SecurityFilterChain filterChain(
    HttpSecurity http,
    CustomAuthenticationEntryPoint caep
  ) throws Exception {
    http
      .csrf(c -> c.disable())
      .cors(Customizer.withDefaults())
      .authorizeHttpRequests(authz ->
        authz
          .requestMatchers("/test", "/api/v1/auth/login" ,"/api/v1/user","/api/v1/auth/register")
          .permitAll() // 🔹 Cho phép truy cập không cần xác thực
          // .anyRequest().authenticated()
          .requestMatchers("/api/v1/messages/**").authenticated()
          .requestMatchers("/ws/**").permitAll() // Thêm dòng này
          .anyRequest()
          .authenticated() // 🔹 Các request khác phải đăng nhập
      )
      .sessionManagement(session ->
        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS) // 🔹 Không sử dụng session
      )
      .exceptionHandling(exceptions ->
        exceptions
          .authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint()) //401
          .accessDeniedHandler(new BearerTokenAccessDeniedHandler())
      ) // 403
      .oauth2ResourceServer(aouth2 ->
        aouth2.jwt(Customizer.withDefaults()).authenticationEntryPoint(caep)
      )
      .formLogin(f -> f.disable()); //Tắt chức năng form login

    return http.build();
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

  @Bean
  public JwtEncoder jwtEncoder() {
    return new NimbusJwtEncoder(new ImmutableSecret<>(getSecretKey()));
  }

  @Bean
  public JwtDecoder jwtDecoder() {
    NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder
      .withSecretKey(getSecretKey())
      .macAlgorithm(SecurityUntil.JWT_ALGORITHM)
      .build();
    return token -> {
      try {
        return jwtDecoder.decode(token);
      } catch (Exception e) {
        System.out.println(">>> JWT error: " + e.getMessage());
        throw e;
      }
    };
  }

  @Bean
  public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
    grantedAuthoritiesConverter.setAuthorityPrefix("");
    grantedAuthoritiesConverter.setAuthoritiesClaimName("permission");
    JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
    jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(
      grantedAuthoritiesConverter
    );

    return jwtAuthenticationConverter;
  }
}