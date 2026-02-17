package com.documentgenerationservice.dto;

import lombok.Data;
import java.util.Map;

@Data
public class BatchError {
    private int rowIndex;
    private String errorMessage;
    private Map<String, String> data;
}