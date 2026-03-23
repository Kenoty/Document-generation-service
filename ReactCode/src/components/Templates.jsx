import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import { useNavigate } from 'react-router-dom';

function Templates() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState(null);
    const [previewDocxBlob, setPreviewDocxBlob] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        content: '',
        file: null,
        isDocx: false
    });
    const [loading, setLoading] = useState(false);

    const docxViewerRef = useRef(null);
    const highlightTimeoutRef = useRef(null);
    const currentHighlightRef = useRef(null);

    useEffect(() => {
        axios.defaults.baseURL = 'http://localhost:8080';
        axios.defaults.withCredentials = true;
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, []);

    useEffect(() => {
        if (showPreviewModal && previewDocxBlob && docxViewerRef.current) {
            renderAsync(previewDocxBlob, docxViewerRef.current, null, {
                className: 'docx-viewer',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                debug: false
            }).catch(err => console.error('Render error:', err));
        }
    }, [showPreviewModal, previewDocxBlob]);

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
        if (!docxViewerRef.current) return;

        clearHighlight();

        const viewer = docxViewerRef.current;
        const variableText = `\${${fieldName}}`;

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

    const handleFieldClick = (fieldName) => {
        clearHighlight();
        setTimeout(() => {
            highlightVariableInDoc(fieldName);
        }, 150);
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

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (newTemplate.isDocx && newTemplate.file) {
                const formData = new FormData();
                formData.append('name', newTemplate.name);
                formData.append('file', newTemplate.file);

                await axios.post('/api/templates/upload-docx', formData, {
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                });
            } else {
                await axios.post('/api/templates', {
                    name: newTemplate.name,
                    content: newTemplate.content
                });
            }

            setNewTemplate({ name: '', content: '', file: null, isDocx: false });
            setShowCreateForm(false);
            await fetchTemplates();
        } catch (error) {
            console.error('Error creating template:', error);
            alert('Error creating template: ' + (error.response?.data || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleEditTemplate = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.put(`/api/templates/${editingTemplate.id}`, {
                name: editingTemplate.name,
                content: editingTemplate.content
            });
            setShowEditForm(false);
            setEditingTemplate(null);
            await fetchTemplates();
        } catch (error) {
            console.error('Error updating template:', error);
            alert('Error updating template: ' + (error.response?.data || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (templateId) => {
        if (!window.confirm('Are you sure you want to delete this template?')) {
            return;
        }

        try {
            await axios.delete(`/api/templates/${templateId}`);
            await fetchTemplates();
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('Error deleting template: ' + (error.response?.data || error.message));
        }
    };

    const startEditTemplate = (template) => {
        setEditingTemplate({ ...template });
        setShowEditForm(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setNewTemplate({
            ...newTemplate,
            file: file,
            isDocx: true
        });
    };

    const openPreview = async (template) => {
        setPreviewTemplate(template);
        setShowPreviewModal(true);

        try {
            const response = await axios.get(`/api/templates/${template.id}/preview-docx`, {
                responseType: 'blob'
            });
            setPreviewDocxBlob(response.data);
        } catch (error) {
            console.error('Error loading template preview:', error);
        }
    };

    const closePreview = () => {
        setShowPreviewModal(false);
        setPreviewTemplate(null);
        setPreviewDocxBlob(null);
        clearHighlight();
    };

    const generateDocumentFromTemplate = (template) => {
        const generationData = {
            name: `Document from ${template.name}`,
            templateId: template.id,
            data: {}
        };

        if (template.fields) {
            Object.keys(template.fields).forEach(field => {
                generationData.data[field] = '';
            });
        }

        localStorage.setItem('pendingGeneration', JSON.stringify(generationData));
        navigate('/documents');
    };

    const templatesToRender = Array.isArray(templates) ? templates : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Templates</h1>
                    <p className="text-muted">Create and manage your document templates</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateForm(true)}
                >
                    + New Template
                </button>
            </div>

            {showCreateForm && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Create New Template</h2>
                        <form onSubmit={handleCreateTemplate}>
                            <div className="form-group">
                                <label>Template Name</label>
                                <input
                                    type="text"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({
                                        ...newTemplate,
                                        name: e.target.value
                                    })}
                                    placeholder="Enter template name"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Template Type</label>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            checked={!newTemplate.isDocx}
                                            onChange={() => setNewTemplate({ ...newTemplate, isDocx: false, file: null })}
                                        />
                                        Text Template
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            checked={newTemplate.isDocx}
                                            onChange={() => setNewTemplate({ ...newTemplate, isDocx: true, content: '' })}
                                        />
                                        DOCX File
                                    </label>
                                </div>
                            </div>

                            {!newTemplate.isDocx ? (
                                <div className="form-group">
                                    <label>Template Content</label>
                                    <textarea
                                        value={newTemplate.content}
                                        onChange={(e) => setNewTemplate({
                                            ...newTemplate,
                                            content: e.target.value
                                        })}
                                        rows="10"
                                        placeholder="Use ${fieldName} for variables, e.g., Hello ${name}!"
                                        required
                                    />
                                    <div className="text-sm text-muted mt-2">
                                        Use {'${variable_name}'} syntax to create dynamic fields
                                    </div>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label>DOCX File</label>
                                    <div className="file-input-wrapper">
                                        <input
                                            type="file"
                                            id="docx-file"
                                            className="file-input"
                                            accept=".docx"
                                            onChange={handleFileChange}
                                            required
                                        />
                                        <label
                                            htmlFor="docx-file"
                                            className={`file-input-label ${newTemplate.file ? 'has-file' : ''}`}
                                        >
                                            {newTemplate.file ? newTemplate.file.name : 'Choose DOCX File'}
                                        </label>
                                    </div>
                                    {newTemplate.file && (
                                        <div className="file-name">
                                            Selected: {newTemplate.file.name} ({(newTemplate.file.size / 1024).toFixed(1)} KB)
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setNewTemplate({ name: '', content: '', file: null, isDocx: false });
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading || (!newTemplate.isDocx && !newTemplate.content) || (newTemplate.isDocx && !newTemplate.file)}
                                >
                                    {loading ? 'Creating...' : 'Create Template'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditForm && editingTemplate && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Edit Template</h2>
                        <form onSubmit={handleEditTemplate}>
                            <div className="form-group">
                                <label>Template Name</label>
                                <input
                                    type="text"
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({
                                        ...editingTemplate,
                                        name: e.target.value
                                    })}
                                    placeholder="Enter template name"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Template Content</label>
                                <textarea
                                    value={editingTemplate.content}
                                    onChange={(e) => setEditingTemplate({
                                        ...editingTemplate,
                                        content: e.target.value
                                    })}
                                    rows="10"
                                    placeholder="Use ${fieldName} for variables, e.g., Hello ${name}!"
                                    required
                                />
                            </div>
                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowEditForm(false);
                                        setEditingTemplate(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Updating...' : 'Update Template'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPreviewModal && previewTemplate && (
                <div className="modal" onClick={(e) => {
                    if (e.target.className === 'modal') {
                        closePreview();
                    }
                }}>
                    <div className="modal-content" style={{ maxWidth: '1400px', width: '95%', maxHeight: '90vh', overflow: 'hidden' }}>
                        <h2>{previewTemplate.name}</h2>

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
                                    <div ref={docxViewerRef} className="docx-viewer" style={{ padding: '1rem' }} />
                                </div>
                            </div>

                            <div style={{ flex: 0.8, overflow: 'auto', paddingRight: '1rem' }}>
                                <h3 style={{ marginBottom: '1rem' }}>Fields</h3>

                                {previewTemplate.fields && Object.keys(previewTemplate.fields).length > 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem'
                                    }}>
                                        {Object.keys(previewTemplate.fields).map(field => (
                                            <div
                                                key={field}
                                                style={{
                                                    padding: '0.75rem',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    transition: 'all 0.2s',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#fff'
                                                }}
                                                onClick={() => handleFieldClick(field)}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                                                    e.currentTarget.style.borderColor = '#3b82f6';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#fff';
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                }}
                                            >
                                                <div style={{
                                                    fontWeight: '600',
                                                    color: '#1e293b'
                                                }}>
                                                    {field}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                        No fields
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-actions" style={{ marginTop: '1rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={closePreview}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {templatesToRender.length === 0 ? (
                <div className="empty-state">
                    <p className="text-muted">No templates created yet.</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        Create Your First Template
                    </button>
                </div>
            ) : (
                <div className="templates-grid">
                    {templatesToRender.map(template => (
                        <div key={template.id} className="template-card">
                            <h3>{template.name}</h3>
                            <p className="text-sm text-muted">
                                {template.description || 'No description provided'}
                            </p>

                            <div className="template-fields">
                                <strong className="text-sm">Fields</strong>
                                {template.fields && Object.keys(template.fields).length > 0 ? (
                                    <ul>
                                        {Object.keys(template.fields).map(field => (
                                            <li key={field}>{field}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-sm text-muted">No fields defined</div>
                                )}
                            </div>

                            <div className="template-actions">
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => generateDocumentFromTemplate(template)}
                                    style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                >
                                    Generate
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openPreview(template)}
                                >
                                    Preview
                                </button>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => startEditTemplate(template)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteTemplate(template.id)}
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

export default Templates;