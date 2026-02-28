package com.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class BatchGenerationRequest {
    private String name;
    private Long templateId;
    private List<Map<String, String>> dataRows;
    private List<String> formats;
    private boolean guestMode = false;
}