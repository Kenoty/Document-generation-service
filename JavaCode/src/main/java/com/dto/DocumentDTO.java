package com.dto;

import java.time.LocalDateTime;

public class DocumentDTO {
    private Long id;
    private String name;
    private String templateName;
    private String status;
    private LocalDateTime createdAt;

    public DocumentDTO() {}

    public DocumentDTO(Long id, String name, String templateName, String status, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.templateName = templateName;
        this.status = status;
        this.createdAt = createdAt;
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}