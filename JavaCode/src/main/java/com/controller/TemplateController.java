package com.controller;

import com.dto.TemplateDTO;
import com.model.Template;
import com.model.User;
import com.service.FileProcessingService;
import com.service.TemplateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/templates")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class TemplateController {

    private static final Logger logger = LoggerFactory.getLogger(TemplateController.class);

    @Autowired
    private TemplateService templateService;

    @Autowired
    private FileProcessingService fileProcessingService;

    @GetMapping
    public ResponseEntity<?> getUserTemplates(HttpServletRequest request) {
        try {
            User user = getCurrentUser(request);
            logger.info("Fetching templates for user: {}", user.getUsername());

            List<TemplateDTO> templates = templateService.getUserTemplatesDTO(user);
            logger.info("Found {} templates for user: {}", templates.size(), user.getUsername());

            return ResponseEntity.ok(templates);
        } catch (RuntimeException e) {
            logger.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(401).body("Not authenticated");
        }
    }

    @PostMapping
    public ResponseEntity<?> createTemplate(
            HttpServletRequest request,
            @RequestBody Map<String, String> requestBody) {

        try {
            User user = getCurrentUser(request);

            String name = requestBody.get("name");
            String content = requestBody.get("content");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Template name is required");
            }
            if (content == null || content.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Template content is required");
            }

            Map<String, String> fields = templateService.extractFieldsFromContent(content);
            Template template = templateService.createTemplate(name, content, user, fields);

            // Конвертируем в DTO перед возвратом
            TemplateDTO templateDTO = convertToDTO(template);
            return ResponseEntity.ok(templateDTO);

        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error creating template: " + e.getMessage());
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadTemplate(
            HttpServletRequest request,
            @RequestBody Map<String, String> requestBody) {

        try {
            User user = getCurrentUser(request);

            String name = requestBody.get("name");
            String content = requestBody.get("content");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Template name is required");
            }

            Map<String, String> fields = templateService.extractFieldsFromContent(content);
            Template template = templateService.createTemplate(name, content, user, fields);

            TemplateDTO templateDTO = convertToDTO(template);
            return ResponseEntity.ok(templateDTO);

        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error uploading template: " + e.getMessage());
        }
    }

    private User getCurrentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            throw new RuntimeException("Not authenticated");
        }

        User user = (User) session.getAttribute("user");
        if (user == null) {
            throw new RuntimeException("Not authenticated");
        }

        return user;
    }

    private TemplateDTO convertToDTO(Template template) {
        return new TemplateDTO(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getContent(),
                template.getFields(),
                template.getCreatedAt(),
                template.getUpdatedAt(),
                template.getOriginalFileName(),
                template.getDocxFileContent()
        );
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTemplate(
            @PathVariable Long id,
            HttpServletRequest request,
            @RequestBody Map<String, String> requestBody) {

        try {
            User user = getCurrentUser(request);

            String name = requestBody.get("name");
            String content = requestBody.get("content");

            Map<String, String> fields = templateService.extractFieldsFromContent(content);
            Template updatedTemplate = templateService.updateTemplate(id, name, content, fields);

            // Проверяем, принадлежит ли шаблон текущему пользователю
            if (!updatedTemplate.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body("Access denied");
            }

            TemplateDTO templateDTO = convertToDTO(updatedTemplate);
            return ResponseEntity.ok(templateDTO);

        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error updating template: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTemplate(@PathVariable Long id, HttpServletRequest request) {
        try {
            User user = getCurrentUser(request);

            // Проверяем, принадлежит ли шаблон текущему пользователю
            Optional<Template> templateOpt = templateService.getTemplateById(id);
            if (templateOpt.isPresent()) {
                Template template = templateOpt.get();
                if (!template.getUser().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body("Access denied");
                }
            }

            templateService.deleteTemplate(id);
            return ResponseEntity.ok("Template deleted successfully");

        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error deleting template: " + e.getMessage());
        }
    }

    @PostMapping("/upload-docx")
    public ResponseEntity<?> uploadDocxTemplate(
            HttpServletRequest request,
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name) {

        try {
            User user = getCurrentUser(request);

            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body("Please select a file");
            }

            if (!file.getOriginalFilename().toLowerCase().endsWith(".docx")) {
                return ResponseEntity.badRequest().body("Only DOCX files are allowed");
            }

            // Извлекаем текст для предпросмотра
            String content = fileProcessingService.extractTextFromDocx(file);
            Map<String, String> fields = fileProcessingService.extractFieldsFromDocxContent(content);

            // Сохраняем шаблон с оригинальным DOCX файлом
            Template template = templateService.createTemplateFromDocx(name, file, user, fields);
            TemplateDTO templateDTO = convertToDTO(template);

            return ResponseEntity.ok(templateDTO);

        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error uploading template: " + e.getMessage());
        }
    }
}