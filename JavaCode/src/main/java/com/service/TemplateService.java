package com.service;

import com.dto.TemplateDTO;
import com.model.Template;
import com.model.User;
import com.repository.TemplateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.HashMap;

@Service
public class TemplateService {

    @Autowired
    private TemplateRepository templateRepository;

    @Autowired
    private  FileProcessingService fileProcessingService;

    public List<Template> getUserTemplates(User user) {
        return templateRepository.findByUser(user);
    }

    public List<TemplateDTO> getUserTemplatesDTO(User user) {
        List<Template> templates = templateRepository.findByUser(user);
        return templates.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public Optional<Template> getTemplateById(Long id) {
        return templateRepository.findById(id);
    }

    public Template createTemplate(String name, String content, User user, Map<String, String> fields) {
        try {
            Template template = new Template(name, content, user);
            template.setFields(fields);
            return templateRepository.save(template);
        } catch (Exception e) {
            throw new RuntimeException("Error creating template: " + e.getMessage(), e);
        }
    }

    public Template updateTemplate(Long id, String name, String content, Map<String, String> fields) {
        Optional<Template> templateOpt = templateRepository.findById(id);
        if (templateOpt.isPresent()) {
            Template template = templateOpt.get();
            if (name != null) template.setName(name);
            if (content != null) template.setContent(content);
            if (fields != null) template.setFields(fields);
            return templateRepository.save(template);
        }
        throw new RuntimeException("Template not found");
    }

    public void deleteTemplate(Long id) {
        templateRepository.deleteById(id);
    }

    public Map<String, String> extractFieldsFromContent(String content) {
        if (content == null) {
            return Map.of();
        }

        Pattern pattern = Pattern.compile("\\$\\{([^}]+)\\}");
        Matcher matcher = pattern.matcher(content);

        Map<String, String> fields = new HashMap<>();
        while (matcher.find()) {
            String fieldName = matcher.group(1);
            fields.put(fieldName, "text");
        }

        return fields;
    }

    private TemplateDTO convertToDTO(Template template) {
        return new TemplateDTO(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getContent(),
                template.getFields() != null ? new HashMap<>(template.getFields()) : new HashMap<>(),
                template.getCreatedAt(),
                template.getUpdatedAt(),
                template.getOriginalFileName(),
                template.getDocxFileContent()
        );
    }

    public Template createTemplateFromDocx(String name, MultipartFile file, User user, Map<String, String> fields) {
        try {
            Template template = new Template(name, "", user);
            template.setFields(fields);
            template.setFileName(file.getOriginalFilename());
            template.setOriginalFileName(file.getOriginalFilename());

            // Сохраняем оригинальный DOCX файл
            template.setDocxFileContent(file.getBytes());

            // Также извлекаем текст для предпросмотра
            String content = fileProcessingService.extractTextFromDocx(file);
            template.setContent(content);

            return templateRepository.save(template);
        } catch (Exception e) {
            throw new RuntimeException("Error creating template from DOCX: " + e.getMessage(), e);
        }
    }
}