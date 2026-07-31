// Interface matching your API structure + UI flags
export interface AnnouncementItem {
    id: number;
    title: string;
    announcement_category: string;
    announcement_start_date: string;
    announcement_end_date?: string;
    pin_as_important?: boolean;
    request_acknowledge?: boolean;
    prevent_download: boolean;
    announcement_content: string;
    announcement_tags?: string;
    announcement_attachments?: string;
    announcement_fullscreen?: boolean;
    organization: number;
    organization_name: string;
    created_by: number;
    created_by_name: string;
    created_on: string;
    updated_by?: number;
    updated_by_name?: string;
    updated_on?: string;
    count_of_likes?: number;
    count_of_views?: number;
    count_of_acknowledge?: number;

    // Status Flags (Mutable)
    viewed?: boolean;
    notified?: boolean;
    acknowledged?: boolean;
    liked?: boolean;
}

export interface AttachmentItem {
    name: string;
    size: number;
}
