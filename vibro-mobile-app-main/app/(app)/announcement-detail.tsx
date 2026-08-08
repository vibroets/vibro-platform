import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ReactIcon from '@/assets/images/react-logo.png';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/Redux/reducer/rootReducer';
import { fetchAnnouncements, patchAnnouncement } from '@/Redux/reducer/announcements/announcementsSlice';
import { AnnouncementItem, AttachmentItem } from '@/types/announcement';
import { downloadAnnouncementAttachment } from '@/utility/downloadService';
import { FileViewer } from '@/utility/fileViewer';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await dispatch(fetchAnnouncements() as any); } catch {}
        setRefreshing(false);
    }, [dispatch]);

    if (!announcement) {
        return (
            <SafeAreaView style={styles.container} edges={["bottom"]}>
                <View style={styles.emptyContainer}>
                    <Icon name="article" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Announcement not found.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
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
        setTimeout(() => {
            dispatch(patchAnnouncement({ id: announcement.id, type: "liked", value: !announcement.liked }));
            setIsLiking(false);
        }, 300);
    };

    const handleAcknowledgePress = () => {
        setIsAcking(true);
        setTimeout(() => {
            dispatch(patchAnnouncement({ id: announcement.id, type: "acknowledged", value: true }));
            setIsAcking(false);
        }, 300);
    };

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563EB"]} tintColor="#2563EB" />
                }
                contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
            >
                <View style={styles.card}>
                    {/* Back + Header in one row */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Icon name="arrow-back" size={18} color="#2563EB" />
                        </TouchableOpacity>
                        <View style={styles.headerInfo}>
                            <View style={styles.avatarContainer}>
                                <Image style={styles.avatarImage} source={ReactIcon} />
                            </View>
                            <View style={styles.headerText}>
                                <Text style={styles.authorName}>{announcement.created_by_name}</Text>
                                <View style={styles.metaRow}>
                                    <Text style={styles.dateText}>{formatDate(announcement.created_on)}</Text>
                                    <Text style={styles.categoryBadge}>{announcement.announcement_category}</Text>
                                </View>
                            </View>
                        </View>
                        {announcement.pin_as_important && (
                            <Icon name="push-pin" size={14} color="#F59E0B" />
                        )}
                    </View>

                    {/* Title + Content */}
                    <Text style={styles.title}>{announcement.title}</Text>
                    <Text style={styles.content}>{announcement.announcement_content}</Text>

                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <View style={styles.attachSection}>
                            {attachments.map((attachment, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.attachItem}
                                    onPress={() => handleFileAction(attachment.name)}
                                    disabled={downloadingFile === attachment.name}
                                >
                                    <Icon name="attach-file" size={14} color="#94A3B8" />
                                    <View style={styles.attachInfo}>
                                        <Text style={styles.attachName} numberOfLines={1}>{attachment.name}</Text>
                                        <Text style={styles.attachSize}>{formatFileSize(attachment.size)}</Text>
                                    </View>
                                    {downloadingFile === attachment.name ? (
                                        <Text style={styles.progressText}>
                                            {downloadProgress !== null ? `${Math.round(downloadProgress * 100)}%` : '...'}
                                        </Text>
                                    ) : (
                                        <Icon
                                            name={announcement.prevent_download ? "visibility" : "download"}
                                            size={16}
                                            color="#2563EB"
                                            style={styles.attachAction}
                                        />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Actions: right-aligned, no divider */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.likeBtn} onPress={handleLikePress}>
                            {isLiking ? (
                                <ActivityIndicator size="small" color="#E11D48" />
                            ) : (
                                <Icon
                                    name={announcement.liked ? "favorite" : "favorite-border"}
                                    size={18}
                                    color={announcement.liked ? "#E11D48" : "#9CA3AF"}
                                />
                            )}
                            <Text style={[styles.likeText, announcement.liked && { color: '#E11D48' }]}>
                                {announcement.liked ? "Liked" : "Like"}
                            </Text>
                        </TouchableOpacity>

                        {announcement.request_acknowledge && (
                            <TouchableOpacity
                                style={[styles.ackBtn, announcement.acknowledged ? styles.ackActive : styles.ackInactive]}
                                onPress={handleAcknowledgePress}
                                disabled={announcement.acknowledged}
                            >
                                {isAcking ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Icon
                                            name={announcement.acknowledged ? "check" : "thumb-up"}
                                            size={12}
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
            </ScrollView>

            {viewerVisible && viewingFile && (
                <FileViewer
                    visible={viewerVisible}
                    onClose={() => {
                        setViewerVisible(false);
                        setViewingFile(null);
                    }}
                    announcementId={announcement.id}
                    filename={viewingFile}
                    allowDownload={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scrollView: { flex: 1 },
    card: {
        backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
        elevation: 2, borderWidth: 1, borderColor: '#f0f0f0',
    },
    topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    backBtn: { padding: 4, marginRight: 8 },
    headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarContainer: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
    avatarImage: { width: 24, height: 24, borderRadius: 12 },
    headerText: { marginLeft: 6, flex: 1 },
    authorName: { color: '#111827', fontSize: 13, fontWeight: '700' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1, gap: 4 },
    dateText: { color: '#6B7280', fontSize: 10 },
    categoryBadge: { color: '#2563EB', fontSize: 10, fontWeight: '600', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
    title: { color: '#1F2937', fontSize: 14, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
    content: { color: '#6B7280', fontSize: 12, lineHeight: 17, marginBottom: 8 },
    attachSection: { marginTop: 4, marginBottom: 4 },
    attachItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#F8FAFC', borderRadius: 6, marginBottom: 4 },
    attachInfo: { flex: 1, marginLeft: 6 },
    attachName: { fontSize: 12, color: '#1F2937', fontWeight: '500' },
    attachSize: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
    attachAction: { padding: 2 },
    progressText: { fontSize: 11, color: '#2563EB', fontWeight: '500' },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
    likeBtn: { flexDirection: 'row', alignItems: 'center' },
    likeText: { color: '#6B7280', fontSize: 11, marginLeft: 4, fontWeight: '500' },
    ackBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    ackInactive: { backgroundColor: '#ECFDF5', borderColor: '#059669' },
    ackActive: { backgroundColor: '#059669', borderColor: '#059669' },
    ackText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12, marginBottom: 16 },
    backBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default AnnouncementDetailScreen;
