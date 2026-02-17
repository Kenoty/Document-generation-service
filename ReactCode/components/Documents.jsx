import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Documents() {
    const [documents, setDocuments] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [showGenerateForm, setShowGenerateForm] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);

    const [generationData, setGenerationData] = useState({
        name: '',
        templateId: '',
        data: {}
    });

    const [batchData, setBatchData] = useState({
        name: 'File',
        templateId: '',
        dataRows: [{}, {}, {}],
        formats: ['txt']
    });

    const [csvFile, setCsvFile] = useState(null);
    const [batchLoading, setBatchLoading] = useState(false);
    const [progress, setProgress] = useState(null);
    const [batchResult, setBatchResult] = useState(null);
    const [activeTab, setActiveTab] = useState('manual');

    const [loading, setLoading] = useState(false);
    const [documentsLoading, setDocumentsLoading] = useState(true);

    useEffect(() => {
        axios.defaults.baseURL = 'http://localhost:8080';
        axios.defaults.withCredentials = true;
    }, []);

    useEffect(() => {
        fetchDocuments();
        fetchTemplates();
    }, []);

    const fetchDocuments = async () => {
        try {
            setDocumentsLoading(true);
            const response = await axios.get('/api/documents');
            const documentsData = Array.isArray(response.data) ? response.data : [];
            setDocuments(documentsData);
        } catch (error) {
            console.error('Error fetching documents:', error);
            setDocuments([]);
        } finally {
            setDocumentsLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const response = await axios.get('/api/templates');
            const templatesData = Array.isArray(response.data) ? response.data : [];
            setTemplates(templatesData);
        } catch (error) {
            console.error('Error fetching templates:', error);
            setTemplates([]);
        }
    };

    const handleGenerateDocument = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.post('/api/documents/generate', generationData);
            setGenerationData({ name: '', templateId: '', data: {} });
            setShowGenerateForm(false);
            await fetchDocuments();
        } catch (error) {
            console.error('Error generating document:', error);
            alert('Error generating document: ' + (error.response?.data || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleExportDocument = async (format) => {
        if (!selectedDocument) return;

        try {
            let endpoint, filename, contentType;

            switch (format) {
                case 'docx':
                    endpoint = `/api/documents/${selectedDocument.id}/export-docx`;
                    filename = `document-${selectedDocument.id}.docx`;
                    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    break;
                case 'pdf':
                    endpoint = `/api/documents/${selectedDocument.id}/export-pdf`;
                    filename = `document-${selectedDocument.id}.pdf`;
                    contentType = 'application/pdf';
                    break;
                default:
                    endpoint = `/api/documents/${selectedDocument.id}/export`;
                    filename = `document-${selectedDocument.id}.txt`;
                    contentType = 'text/plain';
            }

            const response = await axios.get(endpoint, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: contentType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setShowExportModal(false);
            setSelectedDocument(null);
        } catch (error) {
            console.error(`Error exporting document as ${format}:`, error);
            alert(`Error exporting document as ${format}: ` + error.message);
        }
    };

    const handleDeleteDocument = async (documentId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            await axios.delete(`/api/documents/${documentId}`);
            await fetchDocuments();
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Error deleting document: ' + (error.response?.data || error.message));
        }
    };

    const openExportModal = (document) => {
        setSelectedDocument(document);
        setShowExportModal(true);
    };

    // Batch generation functions
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
            for (let i = 1; i < rows.length; i++) {
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

    const handleBatchSubmit = async () => {
        if (!batchData.templateId) {
            alert('Please select a template');
            return;
        }

        if (batchData.dataRows.length === 0) {
            alert('Please add at least one data row');
            return;
        }

        setBatchLoading(true);
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
                setBatchLoading(false);
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

            await fetchDocuments();

        } catch (error) {
            console.error('Batch generation error:', error);
            alert('Error: ' + (error.response?.data || error.message));
        } finally {
            setBatchLoading(false);
            setProgress(null);
        }
    };

    const closeBatchModal = () => {
        setShowBatchModal(false);
        setBatchData({
            name: 'File',
            templateId: '',
            dataRows: [{}, {}, {}],
            formats: ['txt']
        });
        setCsvFile(null);
        setBatchResult(null);
        setActiveTab('manual');
    };

    const selectedTemplate = templates.find(t => t.id == generationData.templateId);
    const selectedBatchTemplate = templates.find(t => t.id == batchData.templateId);
    const templateFields = selectedBatchTemplate?.fields ? Object.keys(selectedBatchTemplate.fields) : [];
    const documentsToRender = Array.isArray(documents) ? documents : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Documents</h1>
                    <p className="text-muted">Manage and export your generated documents</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowGenerateForm(true)}
                    >
                        + Generate Document
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={() => setShowBatchModal(true)}
                    >
                        Batch Generation
                    </button>
                </div>
            </div>

            {/* Generate Document Modal */}
            {showGenerateForm && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Generate New Document</h2>
                        <form onSubmit={handleGenerateDocument}>
                            <div className="form-group">
                                <label>Document Name</label>
                                <input
                                    type="text"
                                    value={generationData.name}
                                    onChange={(e) => setGenerationData({
                                        ...generationData,
                                        name: e.target.value
                                    })}
                                    placeholder="Enter document name"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Template</label>
                                <select
                                    value={generationData.templateId}
                                    onChange={(e) => setGenerationData({
                                        ...generationData,
                                        templateId: e.target.value,
                                        data: {}
                                    })}
                                    required
                                >
                                    <option value="">Select a template</option>
                                    {templates.map(template => (
                                        <option key={template.id} value={template.id}>
                                            {template.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedTemplate && selectedTemplate.fields && (
                                <div className="form-group">
                                    <label>Template Data</label>
                                    <div className="space-y-3">
                                        {Object.keys(selectedTemplate.fields).map(field => (
                                            <div key={field} className="field-input">
                                                <label>{field}</label>
                                                <input
                                                    type="text"
                                                    value={generationData.data[field] || ''}
                                                    onChange={(e) => setGenerationData({
                                                        ...generationData,
                                                        data: {
                                                            ...generationData.data,
                                                            [field]: e.target.value
                                                        }
                                                    })}
                                                    placeholder={`Enter ${field}`}
                                                    required
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowGenerateForm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Generating...' : 'Generate Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Batch Generation Modal */}
            {showBatchModal && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '1000px' }}>
                        <h2>Batch Document Generation</h2>

                        <div className="batch-body">
                            <div className="form-group">
                                <label>Batch Name Pattern</label>
                                <input
                                    type="text"
                                    value={batchData.name}
                                    onChange={(e) => setBatchData({...batchData, name: e.target.value})}
                                    placeholder="e.g., Document_${field1}_${field2}"
                                />
                                <small className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                    Primary filename
                                </small>
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
                                <div style={{ display: 'flex', gap: '20px', padding: '10px 0' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={batchData.formats.includes('txt')}
                                            onChange={() => handleFormatToggle('txt')}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <span>TXT</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={batchData.formats.includes('docx')}
                                            onChange={() => handleFormatToggle('docx')}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <span>DOCX</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={batchData.formats.includes('pdf')}
                                            onChange={() => handleFormatToggle('pdf')}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <span>PDF</span>
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                                <button
                                    style={{
                                        padding: '8px 16px',
                                        background: activeTab === 'manual' ? 'var(--primary-color)' : 'var(--surface-color)',
                                        color: activeTab === 'manual' ? 'white' : 'var(--text-secondary)',
                                        border: activeTab === 'manual' ? 'none' : '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                    }}
                                    onClick={() => setActiveTab('manual')}
                                >
                                    Manual Input
                                </button>
                                <button
                                    style={{
                                        padding: '8px 16px',
                                        background: activeTab === 'csv' ? 'var(--primary-color)' : 'var(--surface-color)',
                                        color: activeTab === 'csv' ? 'white' : 'var(--text-secondary)',
                                        border: activeTab === 'csv' ? 'none' : '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                    }}
                                    onClick={() => setActiveTab('csv')}
                                >
                                    CSV Upload
                                </button>
                            </div>

                            {activeTab === 'csv' && (
                                <div style={{
                                    margin: '15px 0',
                                    padding: '20px',
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    textAlign: 'center',
                                    background: 'var(--surface-color)'
                                }}>
                                    {/* Скрываем стандартный input */}
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleCsvUpload}
                                        id="csv-upload"
                                        style={{ display: 'none' }}
                                    />

                                    {/* Кнопка с существующими стилями */}
                                    <label
                                        htmlFor="csv-upload"
                                        className="btn btn-primary"
                                        style={{
                                            display: 'inline-flex',
                                            marginBottom: '10px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span style={{ marginRight: '8px' }}>📁</span>
                                        {csvFile ? csvFile.name : 'Choose CSV File'}
                                    </label>

                                    {/* Текст с существующими стилями text-muted */}
                                    <div>
                                        <small className="text-muted" style={{ display: 'block' }}>
                                            Upload CSV with headers matching template fields
                                        </small>
                                    </div>

                                    {/* Информация о выбранном файле (появляется только если файл выбран) */}
                                    {csvFile && (
                                        <div style={{
                                            marginTop: '12px',
                                            padding: '8px',
                                            background: 'var(--border-light)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.85rem'
                                        }}>
                <span className="text-muted">
                    Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedBatchTemplate && (
                                <div style={{ margin: '20px 0', overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                        <tr>
                                            {templateFields.map(field => (
                                                <th key={field} style={{
                                                    background: 'var(--border-light)',
                                                    padding: '10px',
                                                    textAlign: 'left',
                                                    fontWeight: '600',
                                                    border: '1px solid var(--border-color)'
                                                }}>{field}</th>
                                            ))}
                                            <th style={{
                                                background: 'var(--border-light)',
                                                padding: '10px',
                                                textAlign: 'left',
                                                fontWeight: '600',
                                                border: '1px solid var(--border-color)',
                                                width: '80px'
                                            }}>Actions</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {batchData.dataRows.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {templateFields.map(field => (
                                                    <td key={field} style={{ padding: '8px', border: '1px solid var(--border-color)' }}>
                                                        <input
                                                            type="text"
                                                            value={row[field] || ''}
                                                            onChange={(e) => handleCellChange(rowIndex, field, e.target.value)}
                                                            placeholder={`Enter ${field}`}
                                                            style={{
                                                                width: '100%',
                                                                padding: '6px',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                boxSizing: 'border-box'
                                                            }}
                                                        />
                                                    </td>
                                                ))}
                                                <td style={{ padding: '8px', border: '1px solid var(--border-color)' }}>
                                                    <button
                                                        onClick={() => handleRemoveRow(rowIndex)}
                                                        title="Remove row"
                                                        style={{
                                                            width: '30px',
                                                            height: '30px',
                                                            borderRadius: '50%',
                                                            border: 'none',
                                                            background: '#dc2626',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '18px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>

                                    <button
                                        onClick={handleAddRow}
                                        style={{
                                            marginTop: '10px',
                                            padding: '8px 16px',
                                            background: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        + Add Row
                                    </button>
                                </div>
                            )}

                            {progress && (
                                <div style={{
                                    margin: '20px 0',
                                    height: '30px',
                                    background: 'var(--border-color)',
                                    borderRadius: '15px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--primary-color), var(--primary-hover))',
                                        width: `${(progress.current / progress.total) * 100}%`,
                                        transition: 'width 0.3s ease'
                                    }} />
                                    <span style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        color: 'var(--text-primary)',
                                        fontWeight: 'bold'
                                    }}>
                                        Processing {progress.current}/{progress.total}
                                    </span>
                                </div>
                            )}

                            {batchResult && (
                                <div style={{
                                    margin: '20px 0',
                                    padding: '15px',
                                    background: 'var(--border-light)',
                                    borderRadius: 'var(--radius-md)',
                                    borderLeft: '4px solid var(--primary-color)'
                                }}>
                                    <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>Generation Complete!</h3>
                                    <p style={{ margin: '5px 0', color: 'var(--text-secondary)' }}>Successful: {batchResult.successfulDocuments}</p>
                                    <p style={{ margin: '5px 0', color: 'var(--text-secondary)' }}>Failed: {batchResult.failedDocuments}</p>

                                    {batchResult.errors?.length > 0 && (
                                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
                                            <h4 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>Errors:</h4>
                                            {batchResult.errors.map((error, i) => (
                                                <div key={i} style={{
                                                    padding: '8px',
                                                    background: '#fef2f2',
                                                    borderRadius: 'var(--radius-sm)',
                                                    marginBottom: '5px',
                                                    color: '#b91c1c',
                                                    fontSize: '14px'
                                                }}>
                                                    Row {error.rowIndex + 1}: {error.errorMessage}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={closeBatchModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleBatchSubmit}
                                disabled={batchLoading || !selectedBatchTemplate}
                            >
                                {batchLoading ? 'Generating...' : 'Generate Batch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Format Modal */}
            {showExportModal && selectedDocument && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Export Document</h2>
                        <div className="export-info">
                            <p><strong>Document:</strong> {selectedDocument.name}</p>
                            <p className="text-sm text-muted">
                                Choose the format for exporting this document
                            </p>
                        </div>

                        <div className="export-options">
                            <div className="export-option" onClick={() => handleExportDocument('txt')}>
                                <div className="export-icon">📄</div>
                                <div className="export-details">
                                    <h4>TXT Format</h4>
                                    <p>Plain text file, compatible with any text editor</p>
                                </div>
                            </div>

                            <div className="export-option" onClick={() => handleExportDocument('docx')}>
                                <div className="export-icon">📝</div>
                                <div className="export-details">
                                    <h4>DOCX Format</h4>
                                    <p>Microsoft Word document with formatting</p>
                                </div>
                            </div>

                            <div className="export-option" onClick={() => handleExportDocument('pdf')}>
                                <div className="export-icon">📊</div>
                                <div className="export-details">
                                    <h4>PDF Format</h4>
                                    <p>Portable Document Format, ready for printing</p>
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowExportModal(false);
                                    setSelectedDocument(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {documentsLoading ? (
                <div className="loading">
                    <div className="text-muted">Loading documents...</div>
                </div>
            ) : documentsToRender.length === 0 ? (
                <div className="empty-state">
                    <p className="text-muted">No documents generated yet.</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowGenerateForm(true)}
                    >
                        Generate Your First Document
                    </button>
                </div>
            ) : (
                <div className="templates-grid">
                    {documentsToRender.map(document => (
                        <div key={document.id} className="document-card">
                            <h3>{document.name}</h3>
                            <p className="text-sm text-muted">
                                Template: <span className="font-semibold">{document.templateName || 'No template'}</span>
                            </p>
                            <p className="text-sm text-muted">
                                Created: {document.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Unknown date'}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                                <span className={`status-badge status-${document.status?.toLowerCase() || 'generated'}`}>
                                    {document.status || 'GENERATED'}
                                </span>
                            </div>

                            <div className="document-actions">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => openExportModal(document)}
                                >
                                    Export
                                </button>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteDocument(document.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Documents;