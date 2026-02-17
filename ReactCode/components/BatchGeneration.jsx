import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';


function BatchGeneration({ templates, onClose, onSuccess }) {
    const [batchData, setBatchData] = useState({
        name: 'Batch_${date}',
        templateId: '',
        dataRows: [{}, {}, {}],
        formats: ['txt']
    });

    const [csvFile, setCsvFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(null);
    const [batchResult, setBatchResult] = useState(null);
    const [activeTab, setActiveTab] = useState('manual');

    const selectedTemplate = templates.find(t => t.id == batchData.templateId);
    const templateFields = selectedTemplate?.fields ? Object.keys(selectedTemplate.fields) : [];

    const handleAddRow = () => {
        setBatchData({
            ...batchData,
            dataRows: [...batchData.dataRows, {}]
        });
    };

    const handleRemoveRow = (index) => {
        const newRows = batchData.dataRows.filter((_, i) => i !== index);
        setBatchData({
            ...batchData,
            dataRows: newRows
        });
    };

    const handleCellChange = (rowIndex, field, value) => {
        const newRows = [...batchData.dataRows];
        newRows[rowIndex] = {
            ...newRows[rowIndex],
            [field]: value
        };
        setBatchData({
            ...batchData,
            dataRows: newRows
        });
    };

    const handleCsvUpload = (e) => {
        const file = e.target.files[0];
        setCsvFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const rows = text.split('\n');
            const headers = rows[0].split(',').map(h => h.trim());

            const dataRows = [];
            for (let i = 1; i < Math.min(rows.length, 6); i++) {
                if (rows[i].trim()) {
                    const values = rows[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });
                    dataRows.push(row);
                }
            }

            setBatchData({
                ...batchData,
                dataRows: dataRows
            });
        };
        reader.readAsText(file);
    };

    const handleFormatToggle = (format) => {
        let newFormats;
        if (batchData.formats.includes(format)) {
            newFormats = batchData.formats.filter(f => f !== format);
        } else {
            newFormats = [...batchData.formats, format];
        }
        setBatchData({
            ...batchData,
            formats: newFormats
        });
    };

    const handleSubmit = async () => {
        if (!batchData.templateId) {
            alert('Please select a template');
            return;
        }

        if (batchData.dataRows.length === 0) {
            alert('Please add at least one data row');
            return;
        }

        setLoading(true);
        setProgress({ current: 0, total: batchData.dataRows.length });

        try {
            const requestData = {
                name: batchData.name,
                templateId: batchData.templateId,
                dataRows: batchData.dataRows.filter(row =>
                    Object.values(row).some(val => val && val.trim())
                ),
                formats: batchData.formats
            };

            if (requestData.dataRows.length === 0) {
                alert('No valid data rows');
                setLoading(false);
                return;
            }

            const response = await axios.post('/api/documents/batch/generate', requestData);
            const result = response.data;

            setBatchResult(result);

            if (result.zipFileName) {
                const downloadResponse = await axios.get(`/api/documents/batch/download/${result.batchId}`, {
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([downloadResponse.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', result.zipFileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }

            if (onSuccess) onSuccess(result);

        } catch (error) {
            console.error('Batch generation error:', error);
            alert('Error: ' + (error.response?.data || error.message));
        } finally {
            setLoading(false);
            setProgress(null);
        }
    };

    return (
        <div className="batch-modal">
            <div className="batch-modal-content">
                <div className="batch-header">
                    <h2>Batch Document Generation</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="batch-body">
                    <div className="form-group">
                        <label>Batch Name</label>
                        <input
                            type="text"
                            value={batchData.name}
                            onChange={(e) => setBatchData({...batchData, name: e.target.value})}
                            placeholder="e.g., Invoices_${date}"
                        />
                        <small>Use ${'{field}'} to include data in filename</small>
                    </div>

                    <div className="form-group">
                        <label>Template</label>
                        <select
                            value={batchData.templateId}
                            onChange={(e) => setBatchData({...batchData, templateId: e.target.value})}
                        >
                            <option value="">Select template</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Output Formats</label>
                        <div className="format-options">
                            <label className="format-checkbox">
                                <input
                                    type="checkbox"
                                    checked={batchData.formats.includes('txt')}
                                    onChange={() => handleFormatToggle('txt')}
                                />
                                <span>TXT</span>
                            </label>
                            <label className="format-checkbox">
                                <input
                                    type="checkbox"
                                    checked={batchData.formats.includes('docx')}
                                    onChange={() => handleFormatToggle('docx')}
                                />
                                <span>DOCX</span>
                            </label>
                            <label className="format-checkbox">
                                <input
                                    type="checkbox"
                                    checked={batchData.formats.includes('pdf')}
                                    onChange={() => handleFormatToggle('pdf')}
                                />
                                <span>PDF</span>
                            </label>
                        </div>
                    </div>

                    <div className="data-input-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                            onClick={() => setActiveTab('manual')}
                        >
                            Manual Input
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
                            onClick={() => setActiveTab('csv')}
                        >
                            CSV Upload
                        </button>
                    </div>

                    {activeTab === 'csv' && (
                        <div className="csv-upload">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleCsvUpload}
                                className="csv-input"
                            />
                            <small>Upload CSV with headers matching template fields</small>
                        </div>
                    )}

                    {selectedTemplate && (
                        <div className="data-table">
                            <table>
                                <thead>
                                <tr>
                                    {templateFields.map(field => (
                                        <th key={field}>{field}</th>
                                    ))}
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {batchData.dataRows.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {templateFields.map(field => (
                                            <td key={field}>
                                                <input
                                                    type="text"
                                                    value={row[field] || ''}
                                                    onChange={(e) => handleCellChange(rowIndex, field, e.target.value)}
                                                    placeholder={`Enter ${field}`}
                                                />
                                            </td>
                                        ))}
                                        <td>
                                            <button
                                                className="remove-btn"
                                                onClick={() => handleRemoveRow(rowIndex)}
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            <button className="add-row-btn" onClick={handleAddRow}>
                                + Add Row
                            </button>
                        </div>
                    )}

                    {progress && (
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{width: `${(progress.current / progress.total) * 100}%`}}
                            />
                            <span>Processing {progress.current}/{progress.total}</span>
                        </div>
                    )}

                    {batchResult && (
                        <div className="batch-result">
                            <h3>Generation Complete!</h3>
                            <p>Successful: {batchResult.successfulDocuments}</p>
                            <p>Failed: {batchResult.failedDocuments}</p>

                            {batchResult.errors?.length > 0 && (
                                <div className="errors-list">
                                    <h4>Errors:</h4>
                                    {batchResult.errors.map((error, i) => (
                                        <div key={i} className="error-item">
                                            Row {error.rowIndex + 1}: {error.errorMessage}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="batch-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={loading || !selectedTemplate}
                    >
                        {loading ? 'Generating...' : 'Generate Batch'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BatchGeneration;