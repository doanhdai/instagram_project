package com.example.backend_instagram.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.support.ClassicRequestBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class GeminiChatService {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    public String getGeminiResponse(String prompt) throws Exception {
        CloseableHttpClient client = HttpClients.createDefault();
        HttpPost httpPost = new HttpPost(apiUrl + "?key=" + apiKey);

        // Tạo JSON payload bằng ObjectMapper
        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> payload = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", prompt)
                                )
                        )
                )
        );
        
        String json = mapper.writeValueAsString(payload);
        StringEntity entity = new StringEntity(json, java.nio.charset.StandardCharsets.UTF_8);
        httpPost.setEntity(entity);
        httpPost.setHeader("Content-Type", "application/json; charset=UTF-8");

        // Gửi yêu cầu và nhận phản hồi
        return client.execute(httpPost, response -> {
            int statusCode = response.getCode();
            String responseBody = EntityUtils.toString(response.getEntity(), java.nio.charset.StandardCharsets.UTF_8);

            // Log để debug
            System.out.println("Prompt: " + prompt);
            System.out.println("JSON Payload: " + json);
            System.out.println("HTTP Status Code: " + statusCode);
            System.out.println("Response Body: " + responseBody);

            // Kiểm tra mã trạng thái
            if (statusCode != 200) {
                throw new RuntimeException("API request failed with status: " + statusCode + ", response: " + responseBody);
            }

            // Parse JSON
            try {
                var jsonNode = mapper.readTree(responseBody);
                if (jsonNode.has("candidates") && jsonNode.get("candidates").size() > 0) {
                    return jsonNode.get("candidates").get(0).get("content").get("parts").get(0).get("text").asText();
                } else {
                    throw new RuntimeException("No valid candidates in response: " + responseBody);
                }
            } catch (Exception e) {
                throw new RuntimeException("Failed to parse JSON response: " + responseBody, e);
            }
        });
    }
}