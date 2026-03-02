import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Templates() {
    const [templates, setTemplates] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        content: ''
    });
    const [uploadData, setUploadData] = useState({
        name: '',
        file: null
    });
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);

    useEffect(() => {
        axios.defaults.baseURL = 'http://localhost:8080';
        axios.defaults.withCredentials = true;
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, []);

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
            await axios.post('/api/templates', newTemplate);
            setNewTemplate({ name: '', content: '' });
            setShowCreateForm(false);
            await fetchTemplates();
        } catch (error) {
            console.error('Error creating template:', error);
            alert('Error creating template: ' + (error.response?.data || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleUploadDocx = async (e) => {
        e.preventDefault();
        setUploadLoading(true);

        try {
            const formData = new FormData();
            formData.append('name', uploadData.name);
            formData.append('file', uploadData.file);

            await axios.post('/api/templates/upload-docx', formData, {
                withCredentials: true, // ВАЖНО: передаем cookies
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
            });

            setUploadData({ name: '', file: null });
            setShowUploadForm(false);
            await fetchTemplates();
        } catch (error) {
            console.error('Error uploading DOCX template:', error);
            alert('Error uploading DOCX template: ' + (error.response?.data || error.message));
        } finally {
            setUploadLoading(false);
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
        setUploadData({
            ...uploadData,
            file: file
        });
    };

    // Гарантируем, что templates всегда массив
    const templatesToRender = Array.isArray(templates) ? templates : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Templates</h1>
                    <p className="text-muted">Create and manage your document templates</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowUploadForm(true)}
                    >
                        Upload DOCX
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        + New Template
                    </button>
                </div>
            </div>

            {/* Create Template Modal */}
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
                                    {/* ИСПРАВЛЕНО: правильное экранирование */}
                                    Use {'${variable_name}'} syntax to create dynamic fields
                                </div>
                            </div>
                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowCreateForm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Creating...' : 'Create Template'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload DOCX Modal */}
            {showUploadForm && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Upload DOCX Template</h2>
                        <form onSubmit={handleUploadDocx}>
                            <div className="form-group">
                                <label>Template Name</label>
                                <input
                                    type="text"
                                    value={uploadData.name}
                                    onChange={(e) => setUploadData({
                                        ...uploadData,
                                        name: e.target.value
                                    })}
                                    placeholder="Enter template name"
                                    required
                                />
                            </div>
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
                                        className={`file-input-label ${uploadData.file ? 'has-file' : ''}`}
                                    >
                                        {uploadData.file ? uploadData.file.name : 'Choose DOCX File'}
                                    </label>
                                </div>
                                {uploadData.file && (
                                    <div className="file-name">
                                        Selected: {uploadData.file.name} ({(uploadData.file.size / 1024).toFixed(1)} KB)
                                    </div>
                                )}
                                <div className="text-sm text-muted mt-2">
                                    {/* ИСПРАВЛЕНО: правильное экранирование */}
                                    Upload a DOCX file with variables like {'${fieldName}'}
                                </div>
                            </div>

                            <div className="upload-info">
                                <h4>How to create a DOCX template:</h4>
                                <ul>
                                    <li>Create a Word document with your template content</li>
                                    {/* ИСПРАВЛЕНО: все проблемные места */}
                                    <li>Use <code>{'${variableName}'}</code> syntax for dynamic fields</li>
                                    <li>Example: "Hello {'${name}'}, welcome to {'${company}'}"</li>
                                    <li>Supported: text, paragraphs, basic formatting</li>
                                </ul>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowUploadForm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={uploadLoading || !uploadData.file}
                                >
                                    {uploadLoading ? 'Uploading...' : 'Upload Template'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Template Modal */}
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
                                <div className="text-sm text-muted mt-2">
                                    {/* ИСПРАВЛЕНО: правильное экранирование */}
                                    Use {'${variable_name}'} syntax to create dynamic fields
                                </div>
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

            {templatesToRender.length === 0 ? (
                <div className="empty-state">
                    <p className="text-muted">No templates created yet.</p>
                    <div className="flex gap-2 mt-4">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowUploadForm(true)}
                        >
                            Upload DOCX Template
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateForm(true)}
                        >
                            Create Your First Template
                        </button>
                    </div>
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
                                <strong className="text-sm">Dynamic Fields</strong>
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
                                    className="btn btn-secondary btn-sm"
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