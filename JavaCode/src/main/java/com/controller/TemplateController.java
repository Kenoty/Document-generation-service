package com.controller;

import com.dto.TemplateDTO;
import com.model.Template;
import com.model.User;
import com.service.FileProcessingService;
import com.service.TemplateService;
import com.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/templates")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class TemplateController {

    private static final Logger logger = LoggerFactory.getLogger(TemplateController.class);
    private static final int GUEST_TEMPLATE_LIMIT = 5;

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

    private boolean isGuest(Authentication authentication) {
        return authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken;
    }

    private User getCurrentUser(Authentication authentication) {
        if (isGuest(authentication)) {
            return null;
        }
        return userService.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @SuppressWarnings("unchecked")
    private List<TemplateDTO> getGuestTemplates(HttpSession session) {
        List<TemplateDTO> templates =
                (List<TemplateDTO>) session.getAttribute("guest_templates");
        if (templates == null) {
            templates = new ArrayList<>();
        }
        return templates;
    }

    // ✅ Список шаблонов — для всех
    @GetMapping
    public ResponseEntity<?> getUserTemplates(Authentication authentication,
                                              HttpSession session) {
        if (isGuest(authentication)) {
            logger.info("Guest requesting templates, session: {}", session.getId());
            return ResponseEntity.ok(getGuestTemplates(session));
        }

        User user = getCurrentUser(authentication);
        logger.info("Fetching templates for user: {}", user.getUsername());
        List<TemplateDTO> templates = templateService.getUserTemplatesDTO(user);
        return ResponseEntity.ok(templates);
    }

    // ✅ Создание шаблона — для всех
    @PostMapping
    public ResponseEntity<?> createTemplate(
            Authentication authentication,
            @RequestBody Map<String, String> requestBody,
            HttpSession session) {

        String name = requestBody.get("name");
        String content = requestBody.get("content");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Template name is required");
        }
        if (content == null || content.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Template content is required");
        }

        Map<String, String> fields = templateService.extractFieldsFromContent(content);
        User user = getCurrentUser(authentication);

        if (user == null) {
            List<TemplateDTO> guestTemplates = getGuestTemplates(session);

            if (guestTemplates.size() >= GUEST_TEMPLATE_LIMIT) {
                return ResponseEntity.badRequest().body(
                    "Guest limit reached (" + GUEST_TEMPLATE_LIMIT
                    + " templates). Register to create more.");
            }

            long tempId = -(guestTemplates.size() + 1);
            TemplateDTO dto = new TemplateDTO(
                    tempId, name, null, content, fields,
                    LocalDateTime.now(), LocalDateTime.now(),
                    null, null
            );
            guestTemplates.add(dto);
            session.setAttribute("guest_templates", guestTemplates);

            return ResponseEntity.ok(dto);
        }

        Template template = templateService.createTemplate(name, content, user, fields);
        return ResponseEntity.ok(convertToDTO(template));
    }

    // ✅ Загрузка DOCX — для всех
    @PostMapping("/upload-docx")
    public ResponseEntity<?> uploadDocxTemplate(
            Authentication authentication,
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            HttpSession session) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a file");
        }
        if (!file.getOriginalFilename().toLowerCase().endsWith(".docx")) {
            return ResponseEntity.badRequest().body("Only DOCX files are allowed");
        }

        User user = getCurrentUser(authentication);

        try {
            String content = fileProcessingService.extractTextFromDocx(file);
            Map<String, String> fields =
                    fileProcessingService.extractFieldsFromDocxContent(content);

            if (user == null) {
                List<TemplateDTO> guestTemplates = getGuestTemplates(session);

                if (guestTemplates.size() >= GUEST_TEMPLATE_LIMIT) {
                    return ResponseEntity.badRequest().body(
                        "Guest limit reached (" + GUEST_TEMPLATE_LIMIT
                        + " templates). Register to create more.");
                }

                long tempId = -(guestTemplates.size() + 1);
                TemplateDTO dto = new TemplateDTO(
                        tempId, name, "Guest template", content, fields,
                        LocalDateTime.now(), LocalDateTime.now(),
                        file.getOriginalFilename(), null
                );
                guestTemplates.add(dto);
                session.setAttribute("guest_templates", guestTemplates);

                return ResponseEntity.ok(dto);
            }

            Template template =
                    templateService.createTemplateFromDocx(name, file, user, fields);
            return ResponseEntity.ok(convertToDTO(template));

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Error extracting content from DOCX file");
        }
    }

    // ✅ Обновление — только авторизованные
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
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

    // ✅ Удаление — только авторизованные
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
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