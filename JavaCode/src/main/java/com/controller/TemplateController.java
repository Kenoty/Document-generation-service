package com.controller;

import com.dto.TemplateDTO;
import com.model.Template;
import com.model.User;
import com.service.FileProcessingService;
import com.service.TemplateService;
import com.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

    private final TemplateService templateService;
    private final FileProcessingService fileProcessingService;
    private final UserService userService;

    public TemplateController(TemplateService templateService,
                              FileProcessingService fileProcessingService,
                              UserService userService) {
        this.templateService = templateService;
        this.fileProcessingService = fileProcessingService;
        this.userService = userService;
    }

    private User getCurrentUser(Authentication authentication) {
        return userService.findByUsername(authentication.getName())
                .orElseThrow();
    }

    // ✅ Получить шаблоны пользователя
    @GetMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getUserTemplates(Authentication authentication) {

        User user = getCurrentUser(authentication);
        logger.info("Fetching templates for user: {}", user.getUsername());

        List<TemplateDTO> templates = templateService.getUserTemplatesDTO(user);

        return ResponseEntity.ok(templates);
    }

    // ✅ Создать шаблон
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> createTemplate(
            Authentication authentication,
            @RequestBody Map<String, String> requestBody) {

        User user = getCurrentUser(authentication);

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

        return ResponseEntity.ok(convertToDTO(template));
    }

    // ✅ Альтернативный upload
    @PostMapping("/upload")
    public ResponseEntity<?> uploadTemplate(
            Authentication authentication,
            @RequestBody Map<String, String> requestBody) {

        User user = getCurrentUser(authentication);

        String name = requestBody.get("name");
        String content = requestBody.get("content");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Template name is required");
        }

        Map<String, String> fields = templateService.extractFieldsFromContent(content);
        Template template = templateService.createTemplate(name, content, user, fields);

        return ResponseEntity.ok(convertToDTO(template));
    }

    // ✅ Обновить шаблон
    @PutMapping("/{id}")
    public ResponseEntity<?> updateTemplate(
            @PathVariable Long id,
            Authentication authentication,
            @RequestBody Map<String, String> requestBody) {

        User user = getCurrentUser(authentication);

        String name = requestBody.get("name");
        String content = requestBody.get("content");

        Map<String, String> fields = templateService.extractFieldsFromContent(content);
        Template updatedTemplate = templateService.updateTemplate(id, name, content, fields);

        if (!updatedTemplate.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }

        return ResponseEntity.ok(convertToDTO(updatedTemplate));
    }

    // ✅ Удалить шаблон
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTemplate(
            @PathVariable Long id,
            Authentication authentication) {

        User user = getCurrentUser(authentication);

        Optional<Template> templateOpt = templateService.getTemplateById(id);

        if (templateOpt.isPresent()) {
            Template template = templateOpt.get();

            if (!template.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body("Access denied");
            }
        }

        templateService.deleteTemplate(id);
        return ResponseEntity.ok("Template deleted successfully");
    }

    // ✅ Загрузка DOCX
    @PostMapping("/upload-docx")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> uploadDocxTemplate(
            Authentication authentication,
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name) {

        User user = getCurrentUser(authentication);

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a file");
        }

        if (!file.getOriginalFilename().toLowerCase().endsWith(".docx")) {
            return ResponseEntity.badRequest().body("Only DOCX files are allowed");
        }

        try {
        String content = fileProcessingService.extractTextFromDocx(file);
        Map<String, String> fields =
                fileProcessingService.extractFieldsFromDocxContent(content);

        Template template =
                templateService.createTemplateFromDocx(name, file, user, fields);

        return ResponseEntity.ok(convertToDTO(template));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error extracting content from DOCX file");
        }
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
}