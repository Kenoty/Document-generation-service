package com.dto;

import lombok.Data;

@Data
public class BatchItemResult {
    private int rowIndex;
    private String documentName;
    private String status;
    private String documentId;
}