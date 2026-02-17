package com.documentgenerationservice.service;

import com.documentgenerationservice.dto.BatchError;
import com.documentgenerationservice.dto.BatchGenerationRequest;
import com.documentgenerationservice.dto.BatchGenerationResult;
import com.documentgenerationservice.dto.BatchItemResult;
import com.documentgenerationservice.model.Document;
import com.documentgenerationservice.model.InMemoryMultipartFile;
import com.documentgenerationservice.model.Template;
import com.documentgenerationservice.model.User;
import com.documentgenerationservice.repository.DocumentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class BatchDocumentService {

    @Autowired
    private TemplateService templateService;

    @Autowired
    private DocumentService documentService;

    @Autowired
    private FileProcessingService fileProcessingService;

    @Autowired
    private DocumentRepository documentRepository;

    private Map<String, BatchGenerationResult> progressStore = new HashMap<>();

    public BatchGenerationResult generateBatch(BatchGenerationRequest request, User user) {
        String batchId = UUID.randomUUID().toString();
        BatchGenerationResult result = new BatchGenerationResult();
        result.setBatchId(batchId);
        result.setTotalDocuments(request.getDataRows().size());

        List<BatchItemResult> results = new ArrayList<>();
        List<BatchError> errors = new ArrayList<>();

        Template template = templateService.getTemplateById(request.getTemplateId())
          .orElseThrow(() -> new RuntimeException("Template not found"));

        String tempDir = "temp/" + batchId;
        new File(tempDir).mkdirs();

        int successCount = 0;
        int index = 0;

        for (Map<String, String> rowData : request.getDataRows()) {
            BatchItemResult itemResult = new BatchItemResult();
            itemResult.setRowIndex(index);

            try {
                String documentName = generateDocumentName(request.getName(), rowData, index);
                itemResult.setDocumentName(documentName);

                if (!request.isGuestMode() && user != null) {
                    Document document = documentService.generateDocument(documentName, template, user, rowData);
                    itemResult.setDocumentId(document.getId().toString());
                }

                List<String> formats = request.getFormats();
                if (formats == null || formats.isEmpty()) {
                    formats = Arrays.asList("txt");
                }

                for (String format : formats) {
                    generateAndSaveFile(documentName, template, rowData, format, tempDir);
                }

                itemResult.setStatus("SUCCESS");
                successCount++;

            } catch (Exception e) {
                itemResult.setStatus("FAILED");

                BatchError error = new BatchError();
                error.setRowIndex(index);
                error.setErrorMessage(e.getMessage());
                error.setData(rowData);
                errors.add(error);
            }

            results.add(itemResult);
            index++;
        }

        String zipFileName = batchId + ".zip";
        String zipPath = "temp/" + zipFileName;

        try {
            createZipArchive(tempDir, zipPath);
            deleteDirectory(new File(tempDir));
        } catch (IOException e) {
            BatchError error = new BatchError();
            error.setRowIndex(-1);
            error.setErrorMessage("Failed to create ZIP archive: " + e.getMessage());
            errors.add(error);
        }

        result.setSuccessfulDocuments(successCount);
        result.setFailedDocuments(request.getDataRows().size() - successCount);
        result.setResults(results);
        result.setErrors(errors);
        result.setZipFileName(zipFileName);

        progressStore.put(batchId, result);

        return result;
    }

    private String generateDocumentName(String baseName, Map<String, String> data, int index) {
        if (baseName == null || baseName.isEmpty()) {
            return "document_" + (index + 1);
        }

        String name = baseName;
        for (Map.Entry<String, String> entry : data.entrySet()) {
            name = name.replace("${" + entry.getKey() + "}", entry.getValue());
        }

        return name + "_" + (index + 1);
    }

    private void generateAndSaveFile(String documentName, Template template,
                                     Map<String, String> data, String format,
                                     String outputDir) throws Exception {

        byte[] fileContent;
        String fileName = documentName + "." + format;

        switch (format.toLowerCase()) {
            case "docx":
                if (template.getDocxFileContent() != null) {
                    MultipartFile templateFile = new InMemoryMultipartFile(
                      template.getOriginalFileName(),
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      template.getDocxFileContent()
                    );
                    fileContent = fileProcessingService.generateDocxFromTemplate(templateFile, data);
                } else {
                    fileContent = fileProcessingService.generateDocxFromTextTemplate(template.getContent(), data);
                }
                break;

            case "pdf":
                String textContent = documentService.generateContent(template.getContent(), data);
                fileContent = fileProcessingService.generatePdfDocument(textContent);
                break;

            case "txt":
            default:
                fileContent = documentService.generateContent(template.getContent(), data).getBytes();
                break;
        }

        Files.write(Paths.get(outputDir, fileName), fileContent);
    }

    private void createZipArchive(String sourceDir, String zipPath) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipPath))) {
            java.nio.file.Path sourcePath = Paths.get(sourceDir);

            Files.walk(sourcePath)
              .filter(path -> !Files.isDirectory(path))
              .forEach(path -> {
                  ZipEntry zipEntry = new ZipEntry(sourcePath.relativize(path).toString());
                  try {
                      zos.putNextEntry(zipEntry);
                      Files.copy(path, zos);
                      zos.closeEntry();
                  } catch (IOException e) {
                      throw new RuntimeException(e);
                  }
              });
        }
    }

    private void deleteDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    deleteDirectory(file);
                } else {
                    file.delete();
                }
            }
        }
        dir.delete();
    }

    public BatchGenerationResult getProgress(String batchId) {
        return progressStore.get(batchId);
    }
}