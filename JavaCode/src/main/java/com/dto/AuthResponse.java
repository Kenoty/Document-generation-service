package com.dto;

public class AuthResponse {
    private String username;
    private String email;

    // Конструкторы
    public AuthResponse() {}

    public AuthResponse(String username, String email) {
        this.username = username;
        this.email = email;
    }

    // Геттеры и сеттеры
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}