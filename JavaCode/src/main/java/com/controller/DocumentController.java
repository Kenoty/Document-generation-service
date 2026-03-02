package com.controller;

import com.dto.*;
import com.model.Document;
import com.model.InMemoryMultipartFile;
import com.model.Template;
import com.model.User;
import com.service.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@PreAuthorize("hasRole('USER')")
public class DocumentController {

    private final DocumentService documentService;
    private final TemplateService templateService;
    private final UserService userService;
    private final FileProcessingService fileProcessingService;
    private final BatchDocumentService batchDocumentService;

    public DocumentController(DocumentService documentService,
                              TemplateService templateService,
                              UserService userService,
                              FileProcessingService fileProcessingService,
                              BatchDocumentService batchDocumentService) {
        this.documentService = documentService;
        this.templateService = templateService;
        this.userService = userService;
        this.fileProcessingService = fileProcessingService;
        this.batchDocumentService = batchDocumentService;
    }

    private User getCurrentUser(Authentication authentication) {
        return userService.findByUsername(authentication.getName())
                .orElseThrow();
    }

    // ✅ Получить документы пользователя
    @GetMapping
    public ResponseEntity<?> getUserDocuments(Authentication authentication) {

        User user = getCurrentUser(authentication);
        List<DocumentDTO> documents = documentService.getUserDocumentsDTO(user);

        return ResponseEntity.ok(documents);
    }

    // ✅ Генерация документа
    @PostMapping("/generate")
    public ResponseEntity<Document> generateDocument(
            Authentication authentication,
            @RequestBody Map<String, Object> requestBody) {

        User user = getCurrentUser(authentication);

        String name = (String) requestBody.get("name");
        Long templateId = Long.valueOf(requestBody.get("templateId").toString());
        Map<String, String> data = (Map<String, String>) requestBody.get("data");

        Template template = templateService.getTemplateById(templateId)
                .orElseThrow(() -> new RuntimeException("Template not found"));

        Document document = documentService.generateDocument(name, template, user, data);

        return ResponseEntity.ok(document);
    }

    // ✅ Пакетная генерация
    @PostMapping("/batch/generate")
    public ResponseEntity<?> generateBatch(
            Authentication authentication,
            @RequestBody BatchGenerationRequest batchRequest) {

        User user = getCurrentUser(authentication);
        BatchGenerationResult result =
                batchDocumentService.generateBatch(batchRequest, user);

        return ResponseEntity.ok(result);
    }

    // ✅ Скачать ZIP
    @GetMapping("/batch/download/{batchId}")
    public ResponseEntity<byte[]> downloadBatch(@PathVariable String batchId) throws Exception {

        Path zipPath = Paths.get("temp", batchId + ".zip");

        if (!Files.exists(zipPath)) {
            return ResponseEntity.notFound().build();
        }

        byte[] zipContent = Files.readAllBytes(zipPath);
        Files.deleteIfExists(zipPath);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + batchId + ".zip\"")
                .body(zipContent);
    }

    // ✅ Получить прогресс batch
    @GetMapping("/batch/progress/{batchId}")
    public ResponseEntity<?> getProgress(@PathVariable String batchId) {
        BatchGenerationResult result = batchDocumentService.getProgress(batchId);
        return ResponseEntity.ok(result);
    }

    // ✅ Экспорт текста
    @GetMapping("/{id}/export")
    public ResponseEntity<String> exportDocument(
            Authentication authentication,
            @PathVariable Long id) {

        User user = getCurrentUser(authentication);

        Document document = documentService.getDocumentById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        if (!document.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(document.getGeneratedContent());
    }

    // ✅ Удалить документ
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(
            Authentication authentication,
            @PathVariable Long id) {

        User user = getCurrentUser(authentication);

        Optional<Document> documentOpt = documentService.getDocumentById(id);

        if (documentOpt.isPresent()) {
            Document document = documentOpt.get();

            if (!document.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body("Access denied");
            }
        }

        documentService.deleteDocument(id);
        return ResponseEntity.ok("Document deleted successfully");
    }

    // ✅ Экспорт DOCX
    @GetMapping("/{id}/export-docx")
    public ResponseEntity<byte[]> exportDocumentToDocx(
            Authentication authentication,
            @PathVariable Long id) {

        User user = getCurrentUser(authentication);

        Document document = documentService.getDocumentById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        if (!document.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        Template template = document.getTemplate();
        Map<String, String> data = document.getData();

        byte[] docxContent;

        try {
        if (template.getDocxFileContent() != null) {

            MultipartFile templateFile = new InMemoryMultipartFile(
                    template.getOriginalFileName(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    template.getDocxFileContent()
            );

            docxContent = fileProcessingService.generateDocxFromTemplate(templateFile, data);
        } else {
            docxContent = fileProcessingService.generateDocxFromTextTemplate(
                    template.getContent(), data);
        }

        return ResponseEntity.ok()
                .header("Content-Type",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                .header("Content-Disposition",
                        "attachment; filename=\"" + document.getName() + ".docx\"")
                .body(docxContent); } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ✅ Экспорт PDF
    @GetMapping("/{id}/export-pdf")
    public ResponseEntity<byte[]> exportDocumentToPdf(
            Authentication authentication,
            @PathVariable Long id) {

        User user = getCurrentUser(authentication);

        Document document = documentService.getDocumentById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        if (!document.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        try {
        byte[] pdfContent =
                fileProcessingService.generatePdfDocument(document.getGeneratedContent());

        return ResponseEntity.ok()
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition",
                        "attachment; filename=\"" + document.getName() + ".pdf\"")
                .body(pdfContent);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}