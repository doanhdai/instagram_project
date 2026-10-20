package com.example.backend_instagram.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.PrePersist;

@Entity
@Table(name = "users")
@Getter
@Setter
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class User {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false, unique = true)
  private String userNickname;
  @Column(nullable = false)
  private String userFullname;
  private String userBday;
  private String userEmail;
  private String userPassword;
  private String userPhone;
  private String userImage;
  private String userGender;
  private String userBio;
  @Column(nullable = false)
  private boolean isOnline;
  private String socketId;
  @Column(columnDefinition = "MEDIUMTEXT")
  private String refreshToken;
  @Column(name = "created_at")
  private LocalDateTime createdAt;
  private Instant updatedAt;
  private String createdBy;
  private String updatedBy;

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
  }

  public void setIsOnline(boolean isOnline) {
    this.isOnline = isOnline;
  }

  public boolean getIsOnline() {
    return this.isOnline;
  }
}
