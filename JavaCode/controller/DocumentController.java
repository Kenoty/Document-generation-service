package com.documentgenerationservice.controller;

import com.documentgenerationservice.dto.DocumentDTO;
import com.documentgenerationservice.dto.BatchGenerationRequest;  // NEW
import com.documentgenerationservice.dto.BatchGenerationResult;   // NEW
import com.documentgenerationservice.model.Document;
import com.documentgenerationservice.model.InMemoryMultipartFile;
import com.documentgenerationservice.model.Template;
import com.documentgenerationservice.model.User;
import com.documentgenerationservice.service.DocumentService;
import com.documentgenerationservice.service.FileProcessingService;
import com.documentgenerationservice.service.TemplateService;
import com.documentgenerationservice.service.UserService;
import com.documentgenerationservice.service.BatchDocumentService; // NEW
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession; // NEW
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders; // NEW
import org.springframework.http.MediaType; // NEW
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException; // NEW
import java.nio.file.Files; // NEW
import java.nio.file.Path; // NEW
import java.nio.file.Paths; // NEW
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.HashMap; // NEW

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class DocumentController {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private UserService userService;

    @Autowired
    private FileProcessingService fileProcessingService;

    @Autowired
    private BatchDocumentService batchDocumentService; // NEW

    // NEW: Хранилище для отслеживания запросов гостей
    private Map<String, Integer> guestRequests = new HashMap<>();

    @GetMapping
    public ResponseEntity<?> getUserDocuments(HttpServletRequest request) {
        try {
            User user = getCurrentUser(request);
            List<DocumentDTO> documents = documentService.getUserDocumentsDTO(user);
            return ResponseEntity.ok(documents);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        }
    }

    @PostMapping("/generate")
    public ResponseEntity<Document> generateDocument(
      HttpServletRequest request,
      @RequestBody Map<String, Object> requestBody) {

        User user = getCurrentUser(request);

        String name = (String) requestBody.get("name");
        Long templateId = Long.valueOf(requestBody.get("templateId").toString());
        @SuppressWarnings("unchecked")
        Map<String, String> data = (Map<String, String>) requestBody.get("data");

        Template template = templateService.getTemplateById(templateId)
          .orElseThrow(() -> new RuntimeException("Template not found"));

        Document document = documentService.generateDocument(name, template, user, data);
        return ResponseEntity.ok(document);
    }

    // NEW: Пакетная генерация документов
    @PostMapping("/batch/generate")
    public ResponseEntity<?> generateBatch(
      HttpServletRequest request,
      @RequestBody BatchGenerationRequest batchRequest) {

        try {
            // Проверка на гостя
            User user = getCurrentUser(request);
            boolean isGuest = user == null;

            if (isGuest) {
                // Проверка лимитов для гостей
                String sessionId = request.getSession().getId();
                if (!checkGuestLimits(sessionId)) {
                    return ResponseEntity.status(429)
                      .body("Too many requests. Guests are limited to 3 batch jobs per hour.");
                }
            }

            // Установка режима гостя
           // batchRequest.setGuestMode(isGuest);

            // Генерация документов
            BatchGenerationResult result = batchDocumentService.generateBatch(batchRequest, user);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(500)
              .body("Error processing batch: " + e.getMessage());
        }
    }

    // NEW: Скачивание ZIP архива
    @GetMapping("/batch/download/{batchId}")
    public ResponseEntity<byte[]> downloadBatch(@PathVariable String batchId) {
        try {
            Path zipPath = Paths.get("temp", batchId + ".zip");

            if (!Files.exists(zipPath)) {
                return ResponseEntity.notFound().build();
            }

            byte[] zipContent = Files.readAllBytes(zipPath);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", batchId + ".zip");

            // Удаляем файл после отправки
            Files.deleteIfExists(zipPath);

            return ResponseEntity.ok()
              .headers(headers)
              .body(zipContent);

        } catch (IOException e) {
            return ResponseEntity.status(500).build();
        }
    }

    // NEW: Получение прогресса
    @GetMapping("/batch/progress/{batchId}")
    public ResponseEntity<?> getProgress(@PathVariable String batchId) {
        BatchGenerationResult result = batchDocumentService.getProgress(batchId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<String> exportDocument(
      HttpServletRequest request,
      @PathVariable Long id) {

        User user = getCurrentUser(request);

        Document document = documentService.getDocumentById(id)
          .orElseThrow(() -> new RuntimeException("Document not found"));

        // Проверяем, принадлежит ли документ текущему пользователю
        if (!document.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(document.getGeneratedContent());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(@PathVariable Long id, HttpServletRequest request) {
        try {
            User user = getCurrentUser(request);

            // Проверяем, принадлежит ли документ текущему пользователю
            Optional<Document> documentOpt = documentService.getDocumentById(id);
            if (documentOpt.isPresent()) {
                Document document = documentOpt.get();
                if (!document.getUser().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body("Access denied");
                }
            }

            documentService.deleteDocument(id);
            return ResponseEntity.ok("Document deleted successfully");

        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body("Not authenticated");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error deleting document: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/export-docx")
    public ResponseEntity<byte[]> exportDocumentToDocx(@PathVariable Long id, HttpServletRequest request) {
        try {
            User user = getCurrentUser(request);
            Document document = documentService.getDocumentById(id)
              .orElseThrow(() -> new RuntimeException("Document not found"));

            if (!document.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).build();
            }

            Template template = document.getTemplate();
            Map<String, String> data = document.getData();

            byte[] docxContent;

            // Если есть сохраненный DOCX файл, используем его как основу
            if (template.getDocxFileContent() != null) {
                // Создаем временный файл из BLOB
                MultipartFile templateFile = new InMemoryMultipartFile(
                  template.getOriginalFileName(),
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  template.getDocxFileContent()
                );

                docxContent = fileProcessingService.generateDocxFromTemplate(templateFile, data);
            } else {
                // Используем текстовый шаблон
                docxContent = fileProcessingService.generateDocxFromTextTemplate(template.getContent(), data);
            }

            return ResponseEntity.ok()
              .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
              .header("Content-Disposition", "attachment; filename=\"" + document.getName() + ".docx\"")
              .body(docxContent);

        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/{id}/export-pdf")
    public ResponseEntity<byte[]> exportDocumentToPdf(@PathVariable Long id, HttpServletRequest request) {
        try {
            User user = getCurrentUser(request);
            Document document = documentService.getDocumentById(id)
              .orElseThrow(() -> new RuntimeException("Document not found"));

            // Проверяем принадлежность документа
            if (!document.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).build();
            }

            // Генерируем PDF из сгенерированного контента
            byte[] pdfContent = fileProcessingService.generatePdfDocument(document.getGeneratedContent());

            return ResponseEntity.ok()
              .header("Content-Type", "application/pdf")
              .header("Content-Disposition", "attachment; filename=\"" + document.getName() + ".pdf\"")
              .body(pdfContent);

        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    // NEW: Вспомогательный метод для проверки лимитов гостей
    private synchronized boolean checkGuestLimits(String sessionId) {
        String key = "guest_" + sessionId;
        int count = guestRequests.getOrDefault(key, 0);

        if (count >= 3) {
            return false;
        }

        guestRequests.put(key, count + 1);
        return true;
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
}