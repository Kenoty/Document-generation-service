import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Documents() {
    const [documents, setDocuments] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [showGenerateForm, setShowGenerateForm] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [generationData, setGenerationData] = useState({
        name: '',
        templateId: '',
        data: {}
    });
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

            // Закрываем модальное окно после выбора
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

    const selectedTemplate = templates.find(t => t.id == generationData.templateId);
    const documentsToRender = Array.isArray(documents) ? documents : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Documents</h1>
                    <p className="text-muted">Manage and export your generated documents</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowGenerateForm(true)}
                >
                    + Generate Document
                </button>
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