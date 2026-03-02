import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
    const [stats, setStats] = useState({
        templates: 0,
        documents: 0
    });
    const [recentDocuments, setRecentDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.defaults.baseURL = 'http://localhost:8080';
        axios.defaults.withCredentials = true;
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            console.log('Fetching dashboard data...');

            const [templatesRes, documentsRes] = await Promise.all([
                axios.get('/api/templates'),
                axios.get('/api/documents')
            ]);

            console.log('Templates response:', templatesRes.data);
            console.log('Documents response:', documentsRes.data);

            // Гарантируем, что данные всегда массивы
            const templatesData = Array.isArray(templatesRes.data) ? templatesRes.data : [];
            const documentsData = Array.isArray(documentsRes.data) ? documentsRes.data : [];

            console.log('Templates count:', templatesData.length);
            console.log('Documents count:', documentsData.length);

            setStats({
                templates: templatesData.length,
                documents: documentsData.length
            });

            const recentDocs = documentsData.slice(0, 5);
            console.log('🕒 Recent documents:', recentDocs);
            setRecentDocuments(recentDocs);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            console.error('Error details:', error.response?.data);
            // Устанавливаем пустые массивы при ошибке
            setStats({ templates: 0, documents: 0 });
            setRecentDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="loading">
                    <div className="text-muted">Loading your dashboard...</div>
                </div>
            </div>
        );
    }

    // Гарантируем, что recentDocuments всегда массив
    const documentsToDisplay = Array.isArray(recentDocuments) ? recentDocuments : [];

    console.log('Rendering dashboard with:', {
        stats,
        recentDocumentsCount: documentsToDisplay.length,
        recentDocuments: documentsToDisplay
    });

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Welcome to DocuForge</h1>
                    <p className="text-muted">Create, manage, and generate documents with ease</p>
                </div>
            </div>

            <div className="dashboard-stats">
                <div className="stat-card">
                    <h3>Templates</h3>
                    <div className="stat-number">{stats.templates}</div>
                    <Link to="/templates" className="btn-link">
                        Manage Templates
                    </Link>
                </div>

                <div className="stat-card">
                    <h3>Documents</h3>
                    <div className="stat-number">{stats.documents}</div>
                    <Link to="/documents" className="btn-link">
                        View Documents
                    </Link>
                </div>

                <div className="stat-card">
                    <h3>Quick Actions</h3>
                    <div className="quick-actions">
                        <Link to="/templates" className="btn btn-primary">
                            Create Template
                        </Link>
                        <Link to="/documents" className="btn btn-secondary">
                            Generate Document
                        </Link>
                    </div>
                </div>
            </div>

            <div className="dashboard-sections">
                <div className="recent-documents">
                    <div className="flex items-center justify-between mb-6">
                        <h2>Recent Documents</h2>
                        <Link to="/documents" className="btn btn-secondary btn-sm">
                            View All
                        </Link>
                    </div>

                    {documentsToDisplay.length > 0 ? (
                        <div className="documents-list">
                            {documentsToDisplay.map(doc => {
                                console.log('📝 Rendering document:', doc);
                                return (
                                    <div key={doc.id} className="document-item">
                                        <div className="document-info">
                                            <h4>{doc.name || 'Unnamed Document'}</h4>
                                            {/* ИСПРАВЛЕНО: используем templateName вместо template?.name */}
                                            <p className="text-sm text-muted">
                                                Template: {doc.templateName || 'No template'}
                                            </p>
                                            <span className="document-date">
                                                Created {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'Unknown date'}
                                            </span>
                                        </div>
                                        <div className="document-status">
                                            <span className={`status-badge status-${doc.status?.toLowerCase() || 'generated'}`}>
                                                {doc.status || 'GENERATED'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p className="text-muted">No documents generated yet.</p>
                            <Link to="/documents" className="btn btn-primary">
                                Generate Your First Document
                            </Link>
                        </div>
                    )}
                </div>

                <div className="quick-tips">
                    <h2>Getting Started</h2>
                    <div className="tips-list">
                        <div className="tip-item">
                            <h4>1. Create Templates</h4>
                            <p>Design document templates with dynamic variables like ${`{name}`}, ${`{date}`} for easy customization.</p>
                        </div>
                        <div className="tip-item">
                            <h4>2. Generate Documents</h4>
                            <p>Fill in template variables to instantly generate personalized documents.</p>
                        </div>
                        <div className="tip-item">
                            <h4>3. Export & Share</h4>
                            <p>Download your documents in various formats and share with your team.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;