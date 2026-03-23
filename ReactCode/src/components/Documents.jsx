import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { renderAsync } from 'docx-preview';

function Documents() {
    const [documents, setDocuments] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [showGenerateForm, setShowGenerateForm] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [viewDocument, setViewDocument] = useState(null);
    const [viewDocxBlob, setViewDocxBlob] = useState(null);
    const [generationData, setGenerationData] = useState({
        name: '',
        templateId: '',
        data: {}
    });
    const [livePreviewBlob, setLivePreviewBlob] = useState(null);
    const [templateBlob, setTemplateBlob] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [documentsLoading, setDocumentsLoading] = useState(true);

    const livePreviewRef = useRef(null);
    const viewDocxRef = useRef(null);
    const renderTimeoutRef = useRef(null);
    const highlightTimeoutRef = useRef(null);
    const currentHighlightRef = useRef(null);

    useEffect(() => {
        axios.defaults.baseURL = 'http://localhost:8080';
        axios.defaults.withCredentials = true;
    }, []);

    useEffect(() => {
        fetchDocuments();
        fetchTemplates();
    }, []);

    useEffect(() => {
        if (generationData.templateId && showGenerateForm) {
            fetchTemplateForPreview(generationData.templateId);
        }
    }, [generationData.templateId, showGenerateForm]);

    useEffect(() => {
        if (generationData.templateId && showGenerateForm && templateBlob) {
            if (renderTimeoutRef.current) {
                clearTimeout(renderTimeoutRef.current);
            }
            renderTimeoutRef.current = setTimeout(() => {
                updateLivePreview();
            }, 500);
        }
    }, [generationData.data, generationData.templateId, showGenerateForm, templateBlob]);

    useEffect(() => {
        const pendingGeneration = localStorage.getItem('pendingGeneration');
        if (pendingGeneration) {
            const generationData = JSON.parse(pendingGeneration);
            setGenerationData(generationData);
            setShowGenerateForm(true);
            localStorage.removeItem('pendingGeneration');
        }
    }, []);

    const renderDocxWithImages = async (blob, container) => {
        if (!container) return;

        try {
            container.innerHTML = '';

            await renderAsync(blob, container, null, {
                className: 'docx-viewer',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                debug: false,
                useBase64URL: true,
                renderHeaders: true,
                renderFooters: true,
                renderChanges: true,
                experimental: true
            });

            setTimeout(() => {
                const images = container.querySelectorAll('img');
                images.forEach(img => {
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'inline-block';

                    if (img.complete && img.naturalWidth === 0) {
                        console.warn('Image may not have loaded correctly:', img.src);
                    }
                });
            }, 100);

        } catch (err) {
            console.error('Render error:', err);
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc2626;">Error rendering document: ' + err.message + '</div>';
        }
    };

    useEffect(() => {
        if (livePreviewBlob && livePreviewRef.current && showGenerateForm) {
            renderDocxWithImages(livePreviewBlob, livePreviewRef.current);
        }
    }, [livePreviewBlob, showGenerateForm]);

    useEffect(() => {
        if (showViewModal && viewDocxBlob && viewDocxRef.current) {
            renderDocxWithImages(viewDocxBlob, viewDocxRef.current);
        }
    }, [showViewModal, viewDocxBlob]);

    const clearHighlight = () => {
        if (currentHighlightRef.current) {
            try {
                const highlightSpan = currentHighlightRef.current;
                const parent = highlightSpan.parentNode;
                if (parent) {
                    const textNode = document.createTextNode(highlightSpan.textContent);
                    parent.replaceChild(textNode, highlightSpan);
                }
                currentHighlightRef.current = null;
            } catch(e) {
                console.error('Error clearing highlight:', e);
            }
        }
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = null;
        }
    };

    const findTextNodeWithText = (root, text) => {
        const textNodes = [];
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.textContent && node.textContent.includes(text)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }
        return textNodes;
    };

    const findVariableAcrossNodes = (root, fieldName) => {
        const variableText = `\${${fieldName}}`;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

        let accumulatedText = '';
        let startNode = null;
        let startOffset = 0;
        let nodes = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.textContent;

            if (accumulatedText === '') {
                const index = text.indexOf(variableText);
                if (index !== -1) {
                    return {
                        node: node,
                        startIndex: index,
                        endIndex: index + variableText.length,
                        text: variableText,
                        isSingleNode: true
                    };
                }
            }

            if (variableText.startsWith(accumulatedText + text) ||
                (accumulatedText && variableText.includes(accumulatedText + text))) {
                if (startNode === null) {
                    startNode = node;
                    startOffset = 0;
                }
                nodes.push(node);
                accumulatedText += text;

                if (accumulatedText === variableText) {
                    return {
                        nodes: nodes,
                        startNode: startNode,
                        startOffset: startOffset,
                        endNode: node,
                        endOffset: node.textContent.length,
                        text: variableText,
                        isSingleNode: false
                    };
                }
            } else {
                accumulatedText = '';
                startNode = null;
                nodes = [];
            }
        }

        return null;
    };

    const getComputedStyles = (element) => {
        const styles = window.getComputedStyle(element);
        return {
            fontFamily: styles.fontFamily,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            fontStyle: styles.fontStyle,
            color: styles.color,
            lineHeight: styles.lineHeight,
            letterSpacing: styles.letterSpacing
        };
    };

    const createHighlightSpan = (text, styles) => {
        const span = document.createElement('span');
        span.style.backgroundColor = '#3b82f6';
        span.style.display = 'inline';
        span.style.fontFamily = styles.fontFamily;
        span.style.fontSize = styles.fontSize;
        span.style.fontWeight = styles.fontWeight;
        span.style.fontStyle = styles.fontStyle;
        span.style.color = styles.color;
        span.style.lineHeight = 'normal';
        span.style.letterSpacing = styles.letterSpacing;
        span.style.padding = '0';
        span.style.margin = '0';
        span.style.border = 'none';
        span.style.verticalAlign = 'baseline';
        span.textContent = text;
        return span;
    };

    const highlightVariableInDoc = (fieldName) => {
        if (!livePreviewRef.current) return;

        clearHighlight();

        const viewer = livePreviewRef.current;
        const variableText = `\${${fieldName}}`;
        const filledValue = generationData.data[fieldName];

        if (filledValue && filledValue.trim() !== '') {
            const textNodes = findTextNodeWithText(viewer, filledValue);
            if (textNodes.length > 0) {
                const textNode = textNodes[0];
                const fullText = textNode.textContent;
                const startIndex = fullText.indexOf(filledValue);
                const endIndex = startIndex + filledValue.length;

                const parentElement = textNode.parentElement;
                const styles = getComputedStyles(parentElement);

                const range = document.createRange();
                range.setStart(textNode, startIndex);
                range.setEnd(textNode, endIndex);

                const highlightSpan = createHighlightSpan(filledValue, styles);

                range.deleteContents();
                range.insertNode(highlightSpan);

                currentHighlightRef.current = highlightSpan;
                highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });

                highlightTimeoutRef.current = setTimeout(() => {
                    clearHighlight();
                }, 2000);
                return;
            }
        }

        const variableInfo = findVariableAcrossNodes(viewer, fieldName);

        if (variableInfo) {
            let parentElement;
            let styles;

            if (variableInfo.isSingleNode) {
                parentElement = variableInfo.node.parentElement;
                styles = getComputedStyles(parentElement);

                const range = document.createRange();
                range.setStart(variableInfo.node, variableInfo.startIndex);
                range.setEnd(variableInfo.node, variableInfo.endIndex);

                const highlightSpan = createHighlightSpan(variableText, styles);

                range.deleteContents();
                range.insertNode(highlightSpan);

                currentHighlightRef.current = highlightSpan;
                highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                const firstNode = variableInfo.startNode;
                parentElement = firstNode.parentElement;
                styles = getComputedStyles(parentElement);

                const range = document.createRange();
                range.setStart(variableInfo.startNode, variableInfo.startOffset);
                range.setEnd(variableInfo.endNode, variableInfo.endOffset);

                const highlightSpan = createHighlightSpan(variableText, styles);

                range.deleteContents();

                const parent = variableInfo.startNode.parentNode;
                if (variableInfo.nodes.length === 1) {
                    parent.insertBefore(highlightSpan, variableInfo.startNode.nextSibling);
                } else {
                    parent.insertBefore(highlightSpan, variableInfo.startNode);
                }

                for (let i = 0; i < variableInfo.nodes.length; i++) {
                    const node = variableInfo.nodes[i];
                    if (node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }

                currentHighlightRef.current = highlightSpan;
                highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            highlightTimeoutRef.current = setTimeout(() => {
                clearHighlight();
            }, 2000);
        }
    };

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

    const fetchTemplateForPreview = async (templateId) => {
        try {
            const response = await axios.get(`/api/templates/${templateId}/preview-docx`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            setTemplateBlob(blob);
            setLivePreviewBlob(blob);
        } catch (error) {
            console.error('Error fetching template for preview:', error);
        }
    };

    const updateLivePreview = async () => {
        if (!generationData.templateId || !templateBlob) return;

        setPreviewLoading(true);
        try {
            const allData = { ...generationData.data };

            const response = await axios.post('/api/documents/preview-docx', {
                templateId: generationData.templateId,
                data: allData
            }, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            setLivePreviewBlob(blob);

        } catch (error) {
            console.error('Preview error:', error);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleGenerateDocument = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.post('/api/documents/generate', generationData);
            setGenerationData({ name: '', templateId: '', data: {} });
            setShowGenerateForm(false);
            setLivePreviewBlob(null);
            setTemplateBlob(null);
            clearHighlight();
            await fetchDocuments();
        } catch (error) {
            console.error('Error generating document:', error);
            alert('Error generating document: ' + (error.response?.data || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field, value) => {
        setGenerationData(prev => ({
            ...prev,
            data: {
                ...prev.data,
                [field]: value
            }
        }));
    };

    const handleFieldClick = (fieldName) => {
        clearHighlight();
        setTimeout(() => {
            highlightVariableInDoc(fieldName);
        }, 150);
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

    const fetchDocumentDocx = async (documentId) => {
        try {
            const response = await axios.get(`/api/documents/${documentId}/export-docx`, {
                responseType: 'blob'
            });
            setViewDocxBlob(response.data);
        } catch (error) {
            console.error('Error fetching document DOCX:', error);
            setViewDocxBlob(null);
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

    const openViewModal = async (document) => {
        setViewDocument(document);
        await fetchDocumentDocx(document.id);
        setShowViewModal(true);
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

            {showGenerateForm && (
                <div className="modal" onClick={(e) => {
                    if (e.target.className === 'modal') {
                        setShowGenerateForm(false);
                        setLivePreviewBlob(null);
                        setTemplateBlob(null);
                        setGenerationData({ name: '', templateId: '', data: {} });
                        clearHighlight();
                        if (renderTimeoutRef.current) {
                            clearTimeout(renderTimeoutRef.current);
                        }
                    }
                }}>
                    <div className="modal-content" style={{ maxWidth: '1400px', width: '95%', maxHeight: '90vh', overflow: 'hidden' }}>
                        <h2>Generate New Document</h2>

                        <div style={{ display: 'flex', gap: '2rem', height: 'calc(90vh - 120px)', overflow: 'hidden' }}>
                            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                                <h3 style={{ marginBottom: '1rem' }}>Document Preview</h3>
                                <div style={{
                                    flex: 1,
                                    overflow: 'auto',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    background: '#fff'
                                }}>
                                    {!generationData.templateId ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                            Select a template to see preview
                                        </div>
                                    ) : previewLoading ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                            Updating preview...
                                        </div>
                                    ) : livePreviewBlob ? (
                                        <div ref={livePreviewRef} className="docx-viewer" style={{ padding: '1rem' }} />
                                    ) : (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                            Loading template...
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ flex: 0.8, overflow: 'auto', paddingRight: '1rem' }}>
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
                                        <label>Select Template</label>
                                        <select
                                            value={generationData.templateId}
                                            onChange={(e) => {
                                                const newTemplateId = e.target.value;
                                                const newTemplate = templates.find(t => t.id == newTemplateId);
                                                setGenerationData({
                                                    name: generationData.name,
                                                    templateId: newTemplateId,
                                                    data: newTemplate?.fields ?
                                                        Object.keys(newTemplate.fields).reduce((acc, field) => {
                                                            acc[field] = '';
                                                            return acc;
                                                        }, {}) : {}
                                                });
                                                setLivePreviewBlob(null);
                                                setTemplateBlob(null);
                                                clearHighlight();
                                            }}
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
                                            <label style={{ marginBottom: '1rem', display: 'block' }}>
                                                Template Fields
                                            </label>
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '1rem',
                                                marginTop: '0.5rem'
                                            }}>
                                                {Object.keys(selectedTemplate.fields).map(field => (
                                                    <div
                                                        key={field}
                                                        id={`field-${field}`}
                                                        style={{
                                                            padding: '0.75rem',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            transition: 'background-color 0.3s',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleFieldClick(field)}
                                                    >
                                                        <label style={{
                                                            display: 'block',
                                                            marginBottom: '0.5rem',
                                                            fontWeight: '600',
                                                            color: '#1e293b',
                                                            cursor: 'pointer'
                                                        }}>
                                                            {field}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={generationData.data[field] || ''}
                                                            onChange={(e) => handleFieldChange(field, e.target.value)}
                                                            placeholder={`Enter ${field}`}
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '6px',
                                                                fontSize: '0.875rem'
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-actions" style={{ marginTop: '2rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setShowGenerateForm(false);
                                                setLivePreviewBlob(null);
                                                setTemplateBlob(null);
                                                setGenerationData({ name: '', templateId: '', data: {} });
                                                clearHighlight();
                                                if (renderTimeoutRef.current) {
                                                    clearTimeout(renderTimeoutRef.current);
                                                }
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={loading || !generationData.templateId}
                                        >
                                            {loading ? 'Generating...' : 'Generate Document'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && selectedDocument && (
                <div className="modal" onClick={(e) => {
                    if (e.target.className === 'modal') {
                        setShowExportModal(false);
                        setSelectedDocument(null);
                    }
                }}>
                    <div className="modal-content">
                        <h2>Export Document</h2>
                        <div className="export-info">
                            <p><strong>Document:</strong> {selectedDocument.name}</p>
                        </div>

                        <div className="export-options">
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

            {showViewModal && viewDocument && (
                <div className="modal" onClick={(e) => {
                    if (e.target.className === 'modal') {
                        setShowViewModal(false);
                        setViewDocument(null);
                        setViewDocxBlob(null);
                    }
                }}>
                    <div className="modal-content" style={{ maxWidth: '1000px', maxHeight: '90vh' }}>
                        <h2>{viewDocument.name}</h2>
                        <div
                            ref={viewDocxRef}
                            style={{
                                background: '#fff',
                                padding: '1rem',
                                borderRadius: '8px',
                                maxHeight: '70vh',
                                overflow: 'auto',
                                border: '1px solid #e2e8f0'
                            }}
                        />
                        <div className="form-actions" style={{ marginTop: '1rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowViewModal(false);
                                    setViewDocument(null);
                                    setViewDocxBlob(null);
                                }}
                            >
                                Close
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

                            <div className="document-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openViewModal(document)}
                                >
                                    View
                                </button>
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