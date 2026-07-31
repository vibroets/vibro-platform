import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native'
import React, { useState } from 'react'
import Icon from 'react-native-vector-icons/MaterialIcons';
import ReactIcon from "@/assets/images/react-logo.png";

import { AnnouncementItem, AttachmentItem } from '@/types/announcement';
import { downloadAnnouncementAttachment } from '@/utility/downloadService';
import { FileViewer } from '@/utility/fileViewer';

interface CardProps {
    item: AnnouncementItem;
    onLike: (id: number, currentStatus: boolean) => void;
    onAcknowledge: (id: number) => void;
    onView: (id: number) => void;
}

const Cards: React.FC<CardProps> = ({ item, onLike, onAcknowledge, onView }) => {
    const [isLiking, setIsLiking] = useState(false);
    const [isAcking, setIsAcking] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewingFile, setViewingFile] = useState<string | null>(null);

    // Format Date Helper
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    // Parse attachments
    const getAttachments = (): AttachmentItem[] => {
        if (!item.announcement_attachments) return [];
        try {
            return JSON.parse(item.announcement_attachments);
        } catch {
            return [];
        }
    };

    const attachments = getAttachments();

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Handle file download
    const handleDownload = async (filename: string) => {
        setDownloadingFile(filename);
        setDownloadProgress(0);
        try {
            await downloadAnnouncementAttachment(item.id, filename, (progress) => {
                const calculatedProgress = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                setDownloadProgress(calculatedProgress);
            });
        } catch (error) {
            // Error is handled in the download service via Alert
        } finally {
            setDownloadingFile(null);
            setDownloadProgress(null);
        }
    };

    // Handle file view (for protected files)
    const handleView = (filename: string) => {
        setViewingFile(filename);
        setViewerVisible(true);
    };

    // Handler to simulate local loading for button presses
    const handleLikePress = () => {
        setIsLiking(true);
        // Simulate network delay for "PATCH"
        setTimeout(() => {
            onLike(item.id, !!item.liked);
            setIsLiking(false);
        }, 500);
    };

    const handleAcknowledgePress = () => {
        setIsAcking(true);
        setTimeout(() => {
            onAcknowledge(item.id);
            setIsAcking(false);
        }, 500);
    };

    return (
        <TouchableOpacity activeOpacity={0.7} onPress={() => onView(item.id)}>
            <View style={[styles.cardContainer, item.viewed && styles.viewedCard]}>
                {/* Compact Header */}
                <View style={styles.headerRow}>
                    <View style={styles.avatarContainer}>
                        <Image style={styles.avatarImage} source={ReactIcon} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.titleText}>{item.created_by_name}</Text>
                        <View style={styles.metaRow}>
                            <Text style={styles.dateText}>{formatDate(item.created_on)}</Text>
                            <Text style={styles.categoryText}>• {item.announcement_category}</Text>
                        </View>
                    </View>

                    <View style={styles.statusContainer}>
                        {item.pin_as_important && (
                            <Icon name="push-pin" size={16} color="#F59E0B" />
                        )}
                        {attachments.length > 0 && (
                            <View style={styles.attachmentBadge}>
                                <Icon name="attach-file" size={12} color="#1F2937" />
                                <Text style={styles.attachmentCount}>{attachments.length}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Compact Content */}
                <View style={styles.contentContainer}>
                    <Text style={styles.statusText} numberOfLines={2}>
                        {item.title}
                    </Text>
                    <Text style={styles.descriptionText} numberOfLines={2} ellipsizeMode="tail">
                        {item.announcement_content}
                    </Text>
                </View>

                {/* Compact Action Footer */}
                <View style={styles.actionRow}>
                    <View style={styles.leftActions}>
                        {/* LIKE BUTTON */}
                        <TouchableOpacity
                            style={styles.compactActionButton}
                            onPress={handleLikePress}
                        >
                            {isLiking ? (
                                <ActivityIndicator size="small" color="#E11D48" />
                            ) : (
                                <Icon
                                    name={item.liked ? "favorite" : "favorite-border"}
                                    size={18}
                                    color={item.liked ? "#E11D48" : "#9CA3AF"}
                                />
                            )}
                            <Text style={[styles.compactActionText, item.liked && { color: '#E11D48' }]}>
                                {item.liked ? "Liked" : "Like"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.rightActions}>
                        {/* ACKNOWLEDGE BUTTON (Conditional) */}
                        {item.request_acknowledge && (
                            <TouchableOpacity
                                style={[
                                    styles.compactAckButton,
                                    item.acknowledged ? styles.ackActive : styles.ackInactive
                                ]}
                                onPress={handleAcknowledgePress}
                                disabled={item.acknowledged}
                            >
                                {isAcking ? (
                                    <ActivityIndicator size="small" color={item.acknowledged ? "white" : "#059669"} />
                                ) : (
                                    <>
                                        <Icon
                                            name={item.acknowledged ? "check" : "thumb-up"}
                                            size={14}
                                            color={item.acknowledged ? "white" : "#059669"}
                                        />
                                        <Text style={[
                                            styles.compactAckText,
                                            item.acknowledged ? { color: 'white' } : { color: '#059669' }
                                        ]}>
                                            {item.acknowledged ? "Ack" : "Ack"}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* VIEW BUTTON */}
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() => onView(item.id)}
                        >
                            <Icon name="arrow-forward" size={18} color="#2563EB" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* File Viewer Modal for protected files */}
            {viewerVisible && viewingFile && (
                <FileViewer
                    visible={viewerVisible}
                    onClose={() => {
                        setViewerVisible(false);
                        setViewingFile(null);
                    }}
                    announcementId={item.id}
                    filename={viewingFile}
                    allowDownload={!item.prevent_download}
                />
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    viewedCard: {
        backgroundColor: '#f9fafb',
        opacity: 0.8,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    avatarContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
    avatarImage: { width: 28, height: 28, borderRadius: 14 },
    headerTextContainer: { marginLeft: 8, flex: 1 },
    titleText: { color: '#111827', fontSize: 14, fontWeight: '700' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    dateText: { color: '#6B7280', fontSize: 11 },
    categoryText: { color: '#6B7280', fontSize: 11, marginLeft: 4, fontWeight: '500' },
    statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    attachmentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    attachmentCount: { fontSize: 10, color: '#1F2937', marginLeft: 2, fontWeight: '600' },

    contentContainer: { marginTop: 4 },
    statusText: { color: '#1F2937', fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
    descriptionText: { color: '#6B7280', fontSize: 13, lineHeight: 18 },

    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    leftActions: { flexDirection: 'row', alignItems: 'center' },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    
    compactActionButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    compactActionText: { color: '#6B7280', fontSize: 12, marginLeft: 4, fontWeight: '500' },
    
    viewButton: { padding: 6, backgroundColor: '#EFF6FF', borderRadius: 20 },
    
    compactAckButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1 },
    ackInactive: { backgroundColor: '#ECFDF5', borderColor: '#059669' },
    ackActive: { backgroundColor: '#059669', borderColor: '#059669' },
    compactAckText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },

    // Legacy styles kept for compatibility
    attachmentContainer: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    greetingText: { color: '#4B5563', fontSize: 14, marginBottom: 6, fontWeight: '600' },
    seeMoreText: {
        color: '#2563EB',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 16
    },
    launchButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, justifyContent: 'space-between' },
    launchButtonText: { color: '#6B46C1', fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 10 },
    primaryCard: { backgroundColor: '#2563EB', borderRadius: 12, height: 140, marginTop: 20, justifyContent: 'center', alignItems: 'center' },
    iconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
    actionItem: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    actionText: { color: '#6B7280', fontSize: 13, marginLeft: 6, fontWeight: '500' },
    downloadSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    downloadTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    downloadItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 8, marginBottom: 4 },
    downloadInfo: { flex: 1, marginHorizontal: 8 },
    downloadFilename: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
    downloadSize: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    downloadButton: { padding: 4, justifyContent: 'center', alignItems: 'center', minWidth: 24 },
    progressContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressText: {
        fontSize: 12,
        color: '#2563EB',
        fontWeight: '500',
    },
    disabledDownload: { padding: 4, justifyContent: 'center', alignItems: 'center' },
    acknowledgeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    ackText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },
});

export default Cards;
