import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ReactIcon from '@/assets/images/react-logo.png';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/Redux/reducer/rootReducer';
import { patchAnnouncement } from '@/Redux/reducer/announcements/announcementsSlice';
import { AnnouncementItem, AttachmentItem } from '@/types/announcement';
import { downloadAnnouncementAttachment } from '@/utility/downloadService';
import { FileViewer } from '@/utility/fileViewer';

const AnnouncementDetailScreen = () => {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const announcements = useSelector((state: RootState) => state.announcements.announcements);
    const announcement = announcements.find((item: AnnouncementItem) => item.id.toString() === id);
    const dispatch = useDispatch();

    const [isLiking, setIsLiking] = useState(false);
    const [isAcking, setIsAcking] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewingFile, setViewingFile] = useState<string | null>(null);

    if (!announcement) {
        return (
            <View style={styles.container}>
                <Text>Announcement not found.</Text>
            </View>
        );
    }
    // Handle file download/view
    const handleFileAction = async (filename: string) => {
        if (announcement.prevent_download) {
            // Show in-app viewer
            setViewingFile(filename);
            setViewerVisible(true);
        } else {
            // Download and share
            setDownloadingFile(filename);
            setDownloadProgress(0);
            try {
                await downloadAnnouncementAttachment(announcement.id, filename, (progress) => {
                    const calculatedProgress = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                    setDownloadProgress(calculatedProgress);
                });
            } catch (error) {
                // Error handled in service
            } finally {
                setDownloadingFile(null);
                setDownloadProgress(null);
            }
        }
    };
const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Parse attachments
    const getAttachments = (): AttachmentItem[] => {
        if (!announcement.announcement_attachments) return [];
        try {
            return JSON.parse(announcement.announcement_attachments);
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

    // Handler to simulate local loading for button presses
    const handleLikePress = () => {
        setIsLiking(true);
        // Simulate network delay for "PATCH"
        setTimeout(() => {
            dispatch(patchAnnouncement({ id: announcement.id, type: "liked", value: !announcement.liked }));
            setIsLiking(false);
        }, 500);
    };

    const handleAcknowledgePress = () => {
        setIsAcking(true);
        setTimeout(() => {
            dispatch(patchAnnouncement({ id: announcement.id, type: "acknowledged", value: true }));
            setIsAcking(false);
        }, 500);
    };

    return (
        <View style={styles.container}>
            {/* Back Button Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Icon name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Announcement</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollView}>
            <View style={styles.cardContainer}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={styles.avatarContainer}>
                        <Image style={styles.avatarImage} source={ReactIcon} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.titleText}>{announcement.created_by_name}</Text>
                        <Text style={styles.dateText}>{formatDate(announcement.created_on)}</Text>
                    </View>
                </View>

                {/* Content Body */}
                <View style={styles.contentContainer}>
                    <Text style={styles.statusText}>{announcement.title}</Text>
                    <Text style={styles.greetingText}>{announcement.announcement_category} Update,</Text>
                    <Text style={styles.descriptionText}>{announcement.announcement_content}</Text>
                </View>

                {/* Downloads Section */}
                {attachments.length > 0 && (
                    <View style={styles.downloadSection}>
                        <Text style={styles.downloadTitle}>Attachments ({attachments.length})</Text>
                        {attachments.map((attachment, index) => (
                            announcement.prevent_download ? (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.downloadItem}
                                    onPress={() => handleFileAction(attachment.name)}
                                    disabled={downloadingFile === attachment.name}
                                >
                                    <Icon name="attach-file" size={18} color="#94A3B8" />
                                    <View style={styles.downloadInfo}>
                                        <Text style={styles.downloadFilename} numberOfLines={1}>
                                            {attachment.name}
                                        </Text>
                                        <Text style={styles.downloadSize}>
                                            {formatFileSize(attachment.size)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleFileAction(attachment.name)}
                                        disabled={downloadingFile === attachment.name}
                                        style={styles.downloadButton}
                                    >
                                        {downloadingFile === attachment.name ? (
                                            <ActivityIndicator size="small" color="#2563EB" />
                                        ) : (
                                            <Icon name="visibility" size={18} color="#2563EB" />
                                        )}
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ) : (
                                <View key={index} style={styles.downloadItem}>
                                    <Icon name="attach-file" size={18} color="#2563EB" />
                                    <View style={styles.downloadInfo}>
                                        <Text style={styles.downloadFilename} numberOfLines={1}>
                                            {attachment.name}
                                        </Text>
                                        <Text style={styles.downloadSize}>
                                            {formatFileSize(attachment.size)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleFileAction(attachment.name)}
                                        disabled={downloadingFile === attachment.name || (viewerVisible && viewingFile === attachment.name)}
                                        style={styles.downloadButton}
                                    >
                                        {downloadingFile === attachment.name ? (
                                            <View style={styles.progressContainer}>
                                                <Text style={styles.progressText}>
                                                    {downloadProgress !== null ? `${Math.round(downloadProgress * 100)}%` : '...'}
                                                </Text>
                                            </View>
                                        ) : (
                                            <Icon name="download" size={18} color="#2563EB" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )
                        ))}
                    </View>
                )}

                {/* Action Footer: Likes, Acknowledge */}
                <View style={styles.actionRow}>
                    {/* LIKE BUTTON */}
                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={handleLikePress}
                    >
                        {isLiking ? (
                            <ActivityIndicator size="small" color="#E11D48" />
                        ) : (
                            <Icon
                                name={announcement.liked ? "favorite" : "favorite-border"}
                                size={22}
                                color={announcement.liked ? "#E11D48" : "#9CA3AF"}
                            />
                        )}
                        <Text style={[styles.actionText, announcement.liked && { color: '#E11D48', fontWeight: 'bold' }]}>
                            {announcement.liked ? "Liked" : "Like"}
                        </Text>
                    </TouchableOpacity>

                    {/* ACKNOWLEDGE BUTTON (Conditional) */}
                    {announcement.request_acknowledge && (
                        <TouchableOpacity
                            style={[
                                styles.acknowledgeButton,
                                announcement.acknowledged ? styles.ackActive : styles.ackInactive
                            ]}
                            onPress={handleAcknowledgePress}
                            disabled={announcement.acknowledged}
                        >
                            {isAcking ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Icon
                                        name={announcement.acknowledged ? "check" : "thumb-up"}
                                        size={16}
                                        color={announcement.acknowledged ? "white" : "#059669"}
                                    />
                                    <Text style={[
                                        styles.ackText,
                                        announcement.acknowledged ? { color: 'white' } : { color: '#059669' }
                                    ]}>
                                        {announcement.acknowledged ? "Acknowledged" : "Acknowledge"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
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
                    announcementId={announcement.id}
                    filename={viewingFile}
                    allowDownload={false} // Protected files can't be downloaded
                />
            )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 8,
        flex: 1,
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        margin: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarContainer: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
    avatarImage: { width: 38, height: 38, borderRadius: 19 },
    headerTextContainer: { marginLeft: 12 },
    titleText: { color: '#111827', fontSize: 15, fontWeight: '700' },
    dateText: { color: '#6B7280', fontSize: 12, marginTop: 2 },
    contentContainer: { marginTop: 4 },
    statusText: { color: '#1F2937', fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
    greetingText: { color: '#4B5563', fontSize: 14, marginBottom: 6, fontWeight: '600' },
    descriptionText: { color: '#6B7280', fontSize: 14, lineHeight: 22, marginBottom: 16 },
    actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', justifyContent: 'space-between' },
    actionItem: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    actionText: { color: '#6B7280', fontSize: 13, marginLeft: 6, fontWeight: '500' },
    downloadSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    downloadTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    downloadItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 8, marginBottom: 4 },
    downloadInfo: { flex: 1, marginHorizontal: 8 },
    downloadFilename: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
    downloadSize: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    downloadButton: { padding: 4 },
    disabledDownload: { padding: 4, justifyContent: 'center', alignItems: 'center' },
    progressContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressText: {
        fontSize: 12,
        color: '#2563EB',
        fontWeight: '500',
    },

    acknowledgeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    ackInactive: { backgroundColor: '#ECFDF5', borderColor: '#059669' },
    ackActive: { backgroundColor: '#059669', borderColor: '#059669' },
    ackText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },
});

export default AnnouncementDetailScreen;
