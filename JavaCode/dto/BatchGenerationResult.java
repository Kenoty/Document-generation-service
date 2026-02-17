package com.documentgenerationservice.dto;

import lombok.Data;
import java.util.List;

@Data
public class BatchGenerationResult {
    private String batchId;
    private int totalDocuments;
    private int successfulDocuments;
    private int failedDocuments;
    private String zipFileName;
    private List<BatchItemResult> results;
    private List<BatchError> errors;
}