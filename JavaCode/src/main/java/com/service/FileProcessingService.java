package com.service;

import org.apache.poi.xwpf.usermodel.*;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FileProcessingService {

    private static final Logger logger = LoggerFactory.getLogger(FileProcessingService.class);

    public String extractTextFromDocx(MultipartFile file) throws IOException {
        StringBuilder content = new StringBuilder();

        logger.info("Starting DOCX extraction for file: {}", file.getOriginalFilename());

        try (InputStream inputStream = file.getInputStream();
             XWPFDocument document = new XWPFDocument(inputStream)) {

            // Читаем параграфы
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                if (text != null && !text.trim().isEmpty()) {
                    content.append(text).append("\n");
                }
            }

            // Читаем таблицы
            for (XWPFTable table : document.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        String cellText = cell.getText();
                        if (cellText != null && !cellText.trim().isEmpty()) {
                            content.append(cellText).append("\t");
                        }
                    }
                    content.append("\n");
                }
            }

            logger.info("Successfully extracted {} characters from DOCX", content.length());
        } catch (Exception e) {
            logger.error("Error extracting text from DOCX: {}", e.getMessage());
            throw new IOException("Failed to extract text from DOCX file: " + e.getMessage(), e);
        }

        return content.toString();
    }

    public Map<String, String> extractFieldsFromDocxContent(String content) {
        Map<String, String> fields = new HashMap<>();

        if (content == null || content.trim().isEmpty()) {
            logger.warn("Empty content provided for field extraction");
            return fields;
        }

        Pattern pattern = Pattern.compile("\\$\\{([^}]+)\\}");
        Matcher matcher = pattern.matcher(content);

        int fieldCount = 0;
        while (matcher.find()) {
            String fieldName = matcher.group(1);
            fields.put(fieldName, "text");
            fieldCount++;
        }

        logger.info("Extracted {} fields from content", fieldCount);
        return fields;
    }

    /**
     * Генерирует DOCX на основе оригинального шаблона DOCX с заменой переменных
     */
    public byte[] generateDocxFromTemplate(MultipartFile templateFile, Map<String, String> data) throws IOException {
        try (InputStream inputStream = templateFile.getInputStream();
             XWPFDocument document = new XWPFDocument(inputStream);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            logger.info("Processing DOCX template with {} data fields", data.size());

            // Обрабатываем параграфы
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                replaceVariablesInParagraph(paragraph, data);
            }

            // Обрабатываем таблицы
            for (XWPFTable table : document.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        for (XWPFParagraph paragraph : cell.getParagraphs()) {
                            replaceVariablesInParagraph(paragraph, data);
                        }
                    }
                }
            }

            // Обрабатываем headers
            for (XWPFHeader header : document.getHeaderList()) {
                for (XWPFParagraph paragraph : header.getParagraphs()) {
                    replaceVariablesInParagraph(paragraph, data);
                }
            }

            // Обрабатываем footers
            for (XWPFFooter footer : document.getFooterList()) {
                for (XWPFParagraph paragraph : footer.getParagraphs()) {
                    replaceVariablesInParagraph(paragraph, data);
                }
            }

            document.write(outputStream);
            logger.info("DOCX template processed successfully");
            return outputStream.toByteArray();

        } catch (Exception e) {
            logger.error("Error generating DOCX from template: {}", e.getMessage());
            throw new IOException("Failed to generate DOCX from template", e);
        }
    }

    /**
     * Заменяет переменные в параграфе с сохранением форматирования
     */
    private void replaceVariablesInParagraph(XWPFParagraph paragraph, Map<String, String> data) {
        String paragraphText = paragraph.getText();
        if (paragraphText == null || !paragraphText.contains("${")) {
            return; // Нет переменных для замены
        }

        // Получаем все runs в параграфе
        List<XWPFRun> runs = paragraph.getRuns();
        if (runs.isEmpty()) {
            return;
        }

        // Собираем весь текст параграфа
        StringBuilder fullText = new StringBuilder();
        for (XWPFRun run : runs) {
            String text = run.getText(0);
            if (text != null) {
                fullText.append(text);
            }
        }

        String originalText = fullText.toString();
        String processedText = processTemplate(originalText, data);

        // Если текст изменился, заменяем его
        if (!originalText.equals(processedText)) {
            // Очищаем все runs
            for (XWPFRun run : runs) {
                run.setText("", 0);
            }

            // Вставляем обработанный текст в первый run с сохранением форматирования
            XWPFRun firstRun = runs.get(0);
            firstRun.setText(processedText, 0);
        }
    }

    /**
     * Альтернативный метод - создает DOCX из текстового шаблона с базовым форматированием
     */
    public byte[] generateDocxFromTextTemplate(String templateContent, Map<String, String> data) throws IOException {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // Обрабатываем шаблон
            String processedContent = processTemplate(templateContent, data);

            // Разбиваем на строки и сохраняем структуру
            String[] lines = processedContent.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) {
                    // Пустая строка
                    document.createParagraph();
                    continue;
                }

                XWPFParagraph paragraph = document.createParagraph();

                // Определяем тип контента по форматированию
                if (line.trim().startsWith("# ")) {
                    // Заголовок 1 уровня
                    paragraph.setStyle("Heading1");
                    XWPFRun run = paragraph.createRun();
                    run.setText(line.substring(2).trim());
                    run.setBold(true);
                    run.setFontSize(16);
                } else if (line.trim().startsWith("## ")) {
                    // Заголовок 2 уровня
                    paragraph.setStyle("Heading2");
                    XWPFRun run = paragraph.createRun();
                    run.setText(line.substring(3).trim());
                    run.setBold(true);
                    run.setFontSize(14);
                } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                    // Элемент списка
                    XWPFRun run = paragraph.createRun();
                    run.setText("• " + line.substring(2).trim());
                    run.setFontSize(11);
                } else if (line.matches("^\\d+\\.\\s.+")) {
                    // Нумерованный список
                    XWPFRun run = paragraph.createRun();
                    run.setText(line);
                    run.setFontSize(11);
                } else {
                    // Обычный текст
                    XWPFRun run = paragraph.createRun();
                    run.setText(line);
                    run.setFontSize(11);
                }
            }

            document.write(outputStream);
            logger.info("DOCX generated from text template with {} lines", lines.length);
            return outputStream.toByteArray();
        }
    }

    public byte[] generatePdfDocument(String content) throws IOException {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            PDPage page = new PDPage();
            document.addPage(page);

            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.beginText();
                contentStream.setFont(PDType1Font.HELVETICA, 12);
                contentStream.newLineAtOffset(50, 750);

                String[] lines = content.split("\n");
                for (String line : lines) {
                    if (line.length() > 100) {
                        String[] parts = splitLongLine(line, 80);
                        for (String part : parts) {
                            contentStream.showText(part);
                            contentStream.newLineAtOffset(0, -15);
                        }
                    } else {
                        contentStream.showText(line);
                        contentStream.newLineAtOffset(0, -15);
                    }
                }

                contentStream.endText();
            }

            document.save(outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating PDF: {}", e.getMessage());
            throw new IOException("Failed to generate PDF document", e);
        }
    }

    private String[] splitLongLine(String line, int maxLength) {
        return line.split("(?<=\\G.{" + maxLength + "})");
    }

    private String processTemplate(String templateContent, Map<String, String> data) {
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
}