package com.dto;

import java.time.LocalDateTime;
import java.util.Map;

public class TemplateDTO {
    private Long id;
    private String name;
    private String description;
    private String content;
    private Map<String, String> fields;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String originalFileName;
    private byte[] docxFileContent; // или String docxFileContentBase64 если нужна кодировка base64

    // Конструкторы
    public TemplateDTO() {}

    public TemplateDTO(Long id, String name, String description, String content,
                       Map<String, String> fields, LocalDateTime createdAt, LocalDateTime updatedAt,
                       String originalFileName, byte[] docxFileContent) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.content = content;
        this.fields = fields;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.originalFileName = originalFileName;
        this.docxFileContent = docxFileContent;
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Map<String, String> getFields() { return fields; }
    public void setFields(Map<String, String> fields) { this.fields = fields; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getOriginalFileName() { return originalFileName; }
    public void setOriginalFileName(String originalFileName) { this.originalFileName = originalFileName; }

    public byte[] getDocxFileContent() { return docxFileContent; }
    public void setDocxFileContent(byte[] docxFileContent) { this.docxFileContent = docxFileContent; }
}