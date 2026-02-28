package com.service;

import com.dto.DocumentDTO;
import com.model.Document;
import com.model.Template;
import com.model.User;
import com.repository.DocumentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    public List<Document> getUserDocuments(User user) {
        try {
            return documentRepository.findByUser(user);
        } catch (Exception e) {
            return new ArrayList<>(); // Всегда возвращаем пустой список при ошибке
        }
    }

    public Optional<Document> getDocumentById(Long id) {
        return documentRepository.findById(id);
    }

    public Document generateDocument(String name, Template template, User user, Map<String, String> data) {
        try {
            String generatedContent = generateContent(template.getContent(), data);

            Document document = new Document(name, template, user);
            document.setData(data);
            document.setGeneratedContent(generatedContent);
            document.setStatus("GENERATED");

            return documentRepository.save(document);
        } catch (Exception e) {
            throw new RuntimeException("Error generating document: " + e.getMessage());
        }
    }

    // NEW: Публичный метод для генерации контента (используется в BatchDocumentService)
    public String generateContent(String templateContent, Map<String, String> data) {
        if (templateContent == null) return "";

        String result = templateContent;
        Pattern pattern = Pattern.compile("\\$\\{([^}]+)\\}");
        Matcher matcher = pattern.matcher(templateContent);

        while (matcher.find()) {
            String variableName = matcher.group(1);
            String value = data.getOrDefault(variableName, "");
            result = result.replace("${" + variableName + "}", value);
        }

        return result;
    }

    public void deleteDocument(Long id) {
        documentRepository.deleteById(id);
    }

    public List<DocumentDTO> getUserDocumentsDTO(User user) {
        List<Document> documents = documentRepository.findByUser(user);
        return documents.stream()
          .map(this::convertToDTO)
          .collect(Collectors.toList());
    }

    private DocumentDTO convertToDTO(Document document) {
        return new DocumentDTO(
          document.getId(),
          document.getName(),
          document.getTemplate() != null ? document.getTemplate().getName() : "No template",
          document.getStatus(),
          document.getCreatedAt()
        );
    }
}