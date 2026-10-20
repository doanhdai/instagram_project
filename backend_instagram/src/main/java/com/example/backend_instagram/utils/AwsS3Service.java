package com.example.backend_instagram.utils;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import java.net.URI;

@Service
public class AwsS3Service {
    private final S3Client s3Client;
    private final String bucketName;
    private final String region; 
    
    private final String publicEndpoint;

    public AwsS3Service(
            @Value("${aws.access-key-id}") String accessKey,
            @Value("${aws.secret-access-key}") String secretKey,
            @Value("${aws.region}") String region,
            @Value("${aws.s3.bucket}") String bucketName,
            @Value("${aws.s3.endpoint:}") String endpoint,
            @Value("${aws.s3.public-endpoint:}") String publicEndpoint) {
        this.region = region;
        this.bucketName = bucketName;
        this.publicEndpoint = publicEndpoint;

        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)
                ));
        if (!endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint)).forcePathStyle(true);
        }
        this.s3Client = builder.build();
    }
    public String uploadFile(String fileName, byte[] fileData) {
        try {
            String contentType = determineContentType(fileName);
            
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileName)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(fileData));

            return publicEndpoint.isBlank()
                    ? "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + fileName
                    : publicEndpoint.replaceAll("/$", "") + "/" + bucketName + "/" + fileName;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi upload file lên S3: " + e.getMessage());
        }
    }

    private String determineContentType(String fileName) {
        String extension = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
        switch (extension) {
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "gif":
                return "image/gif";
            case "mp4":
                return "video/mp4";
            case "mov":
                return "video/quicktime";
            case "avi":
                return "video/x-msvideo";
            case "webm":
                return "video/webm";
            default:
                return "application/octet-stream";
        }
    }

    public void deleteFile(String fileUrl) {
        try {
            // Extract the key from the URL
            String key = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);
            
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi xóa file từ S3: " + e.getMessage());
        }
    }
}
