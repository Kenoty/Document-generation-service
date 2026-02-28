package com.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "templates")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Template {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String fileName;

    @ElementCollection
    @CollectionTable(name = "template_fields", joinColumns = @JoinColumn(name = "template_id"))
    @MapKeyColumn(name = "field_name")
    @Column(name = "field_type")
    private Map<String, String> fields;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore // ВАЖНО: убрать циклическую ссылку
    private User user;

    @Column(name = "docx_file_content", columnDefinition = "BYTEA")
    private byte[] docxFileContent; // Храним оригинальный DOCX файл

    @Column(name = "original_file_name")
    private String originalFileName;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Конструкторы
    public Template() {}

    public Template(String name, String content, User user) {
        this.name = name;
        this.content = content;
        this.user = user;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getContent() { return content; }
    public void setContent(String content) {
        this.content = content;
        this.updatedAt = LocalDateTime.now();
    }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Map<String, String> getFields() { return fields; }
    public void setFields(Map<String, String> fields) { this.fields = fields; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public void setOriginalFileName(String originalFilename) { this.originalFileName = originalFilename; }

    public byte[] getDocxFileContent() {
        return docxFileContent;
    }

    public void setDocxFileContent(byte[] docxFileContent) {
        this.docxFileContent = docxFileContent;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }
}