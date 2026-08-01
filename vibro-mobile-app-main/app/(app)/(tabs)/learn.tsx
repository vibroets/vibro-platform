import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
  FlatList,
  Linking,
  AppState,
} from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import QRCodeSVG from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import api, { MEDIA_BASE_URL } from "../../../services";
import QuizScreen from "../../../components/QuizScreen";

const getMediaUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${MEDIA_BASE_URL}${url}`;
};

const getVideoProgressKey = (scheduleId: any, contentId: any, contentType: string, parentContentId?: any, parentContentType?: string) => {
  const schedPart = scheduleId != null ? `sched_${scheduleId}` : 'direct';
  const parentPart = parentContentId != null ? `_parent_${parentContentType}_${parentContentId}` : '';
  return `video_progress_${schedPart}_${contentType}_${contentId}${parentPart}`;
};

const saveVideoProgress = async (scheduleId: any, contentId: any, contentType: string, progress: number, parentContentId?: any, parentContentType?: string) => {
  try {
    await AsyncStorage.setItem(getVideoProgressKey(scheduleId, contentId, contentType, parentContentId, parentContentType), String(progress));
  } catch (e) {}
};

const getVideoProgress = async (scheduleId: any, contentId: any, contentType: string, parentContentId?: any, parentContentType?: string): Promise<number> => {
  try {
    const val = await AsyncStorage.getItem(getVideoProgressKey(scheduleId, contentId, contentType, parentContentId, parentContentType));
    return val ? parseFloat(val) : 0;
  } catch (e) { return 0; }
};

const clearVideoProgress = async (scheduleId: any, contentId: any, contentType: string, parentContentId?: any, parentContentType?: string) => {
  try {
    await AsyncStorage.removeItem(getVideoProgressKey(scheduleId, contentId, contentType, parentContentId, parentContentType));
  } catch (e) {}
};

// --- MEDIA VIEWER COMPONENT (Video + Document) ---
const buildRestrictedVideoHtml = (videoUrl: string, resumePosition: number = 0) => {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#000;overflow:hidden;width:100vw;height:100vh}video{width:100%;height:100%;object-fit:contain}video::-webkit-media-controls-progress-bar{background-color:rgba(255,255,255,0.3)}video.locked::-webkit-media-controls-progress-bar{background-color:#dc2626!important}video.locked::-webkit-media-controls-time-display{color:#dc2626!important}#lockedPill{position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(220,38,38,0.92);color:#fff;padding:5px 14px;border-radius:14px;font-size:11px;font-weight:600;z-index:9999;display:none;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)}#lockedPill.show{display:block;animation:slideUp 0.15s ease}@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}#playOverlay{position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9998;cursor:pointer}#playBtn{width:80px;height:80px;border-radius:40px;background:#3b82f6;display:flex;align-items:center;justify-content:center}#playBtn:after{content:'';width:0;height:0;border-left:24px solid #fff;border-top:16px solid transparent;border-bottom:16px solid transparent;margin-left:6px}#playText{color:#fff;font-size:14px;margin-top:16px}
</style></head><body>
<video id="v" src="${videoUrl}" controls controlsList="nodownload nofullscreen noremoteplayback" playsinline oncontextmenu="return false"></video>
<div id="lockedPill">🔒 Seeking disabled</div>
<div id="playOverlay"><div id="playBtn"></div><p id="playText">${resumePosition > 0 ? 'Resume from ' + Math.round(resumePosition) + '%' : 'Click to play video'}</p></div>
<script>
(function(){
  var v=document.getElementById('v');
  var pill=document.getElementById('lockedPill');
  var overlay=document.getElementById('playOverlay');
  var maxWatched=0;
  var isSeeking=false;
  var lastTime=0;
  var resumePct=${resumePosition};
  var lockTimer=null;

  function showLock(){
    v.classList.add('locked');
    pill.classList.add('show');
    if(lockTimer) clearTimeout(lockTimer);
    lockTimer=setTimeout(function(){
      pill.classList.remove('show');
      v.classList.remove('locked');
    },1500);
  }

  v.addEventListener('loadedmetadata',function(){
    if(resumePct>0 && resumePct<95 && v.duration>0){
      v.currentTime=(resumePct/100)*v.duration;
      maxWatched=v.currentTime;
    }
  });

  overlay.addEventListener('click',function(){
    overlay.style.display='none';
    v.play();
  });

  v.addEventListener('timeupdate',function(){
    if(isSeeking) return;
    if(v.currentTime>maxWatched) maxWatched=v.currentTime;
    lastTime=v.currentTime;
    var progress=0;
    if(v.duration>0) progress=(v.currentTime/v.duration)*100;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'progress',progress:Math.min(100,progress)}));
    if(progress>=95){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'unlocked'}));
    }
  });

  v.addEventListener('seeking',function(e){
    isSeeking=true;
    e.preventDefault();
    e.stopPropagation();
    if(v.currentTime>maxWatched){
      v.currentTime=maxWatched;
      showLock();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'locked'}));
    }
  });

  v.addEventListener('seeked',function(e){
    isSeeking=false;
    if(v.currentTime>maxWatched){
      v.currentTime=maxWatched;
      showLock();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'locked'}));
    }
  });

  v.addEventListener('ratechange',function(e){
    if(v.playbackRate>1){
      v.playbackRate=1;
      showLock();
    }
  });

  v.addEventListener('ended',function(){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'ended'}));
  });
  v.addEventListener('error',function(){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Video failed to load'}));
  });
})();
</script>
</body></html>`;
};

const buildYouTubeHtml = (videoId: string) => {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#000;overflow:hidden;width:100vw;height:100vh}#player{width:100%;height:100%}
</style></head><body>
<div id="player"></div>
<script>
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
var player;var maxWatched=0;var lastTime=0;
window.onYouTubeIframeAPIReady=function(){
  player=new YT.Player('player',{videoId:'${videoId}',playerVars:{controls:1,modestbranding:1,rel:0,disablekb:1,playsinline:1},events:{
    onReady:function(e){e.target.playVideo();},
    onStateChange:function(e){
      if(e.data===0){window.ReactNativeWebView.postMessage(JSON.stringify({type:'ended'}));}
    }
  }});
};
setInterval(function(){
  if(player&&player.getCurrentTime){
    var t=player.getCurrentTime();
    var d=player.getDuration();
    if(d>0){
      var p=(t/d)*100;
      if(t>maxWatched) maxWatched=t;
      if(t>lastTime+2 && t>maxWatched){
        player.seekTo(maxWatched,true);
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'locked'}));
      }
      lastTime=t;
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'progress',progress:Math.min(100,p)}));
      if(p>=95){window.ReactNativeWebView.postMessage(JSON.stringify({type:'unlocked'}));}
    }
  }
},1000);
</script>
</body></html>`;
};

const MediaViewer = ({ course, scheduleId, onBack, onStartFollowUp, onComplete }: { course: any; scheduleId?: any; onBack: () => void; onStartFollowUp?: () => void; onComplete?: () => void }) => {
  const rawUrl = course.video_url || course.video_file_url || course.content_url || course.file_url || getMediaUrl(course.video_file) || null;
  const isYouTube = rawUrl && rawUrl.includes("youtu");
  const [videoProgress, setVideoProgress] = useState(0);
  const [showLockedMsg, setShowLockedMsg] = useState(false);
  const [resumePosition, setResumePosition] = useState(0);
  const lockedMsgTimer = useRef<any>(null);
  const videoEndedRef = useRef(false);
  const progressSaveTimer = useRef<any>(null);
  const latestProgressRef = useRef(0);

  useEffect(() => {
    if (course.id && course.type) {
      getVideoProgress(course._progressScheduleId, course.id, course.type, course.parentContentId, course.parentContentType).then((p) => {
        if (p > 0 && p < 95) setResumePosition(p);
      });
    }
    return () => {
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
      if (course.id && course.type && latestProgressRef.current > 0 && latestProgressRef.current < 95) {
        saveVideoProgress(course._progressScheduleId, course.id, course.type, latestProgressRef.current, course.parentContentId, course.parentContentType);
      }
    };
  }, [course.id, course.type, course._progressScheduleId, course.parentContentId, course.parentContentType]);

  const handleWebViewMessage = (event: any) => {
    const data = event.nativeEvent.data;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "progress") {
        setVideoProgress(parsed.progress);
        latestProgressRef.current = parsed.progress;
        if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
        progressSaveTimer.current = setTimeout(() => {
          if (course.id && course.type && parsed.progress < 95) {
            saveVideoProgress(course._progressScheduleId, course.id, course.type, parsed.progress, course.parentContentId, course.parentContentType);
          }
        }, 500);
        if (parsed.progress >= 95 && !videoEndedRef.current) {
          videoEndedRef.current = true;
          if (course.id && course.type) clearVideoProgress(course._progressScheduleId, course.id, course.type, course.parentContentId, course.parentContentType);
          handleBack();
        }
      } else if (parsed.type === "locked") {
        setShowLockedMsg(true);
        if (lockedMsgTimer.current) clearTimeout(lockedMsgTimer.current);
        lockedMsgTimer.current = setTimeout(() => setShowLockedMsg(false), 2000);
      } else if (parsed.type === "ended") {
        setVideoProgress(100);
        if (!videoEndedRef.current) {
          videoEndedRef.current = true;
          if (course.id && course.type) clearVideoProgress(course._progressScheduleId, course.id, course.type, course.parentContentId, course.parentContentType);
          handleBack();
        }
      } else if (parsed.type === "error") {
        Alert.alert("Video Error", "Failed to load video. The video file may be inaccessible or the URL is invalid.\n\nURL: " + (finalUrl || 'N/A'), [
          { text: "OK", onPress: onBack }
        ]);
      }
    } catch (e) {}
  };
  const isDocument = course.asset_type === "document" || (rawUrl && (
    rawUrl.toLowerCase().endsWith(".pdf") ||
    rawUrl.toLowerCase().endsWith(".doc") ||
    rawUrl.toLowerCase().endsWith(".docx") ||
    rawUrl.toLowerCase().endsWith(".ppt") ||
    rawUrl.toLowerCase().endsWith(".pptx")
  ));
  const isUploadedFile = course.video_source === "upload" || course.videoSource === "upload" || course.video_source === "file" || course.videoSource === "file" || course.source_type === "file" || course.sourceType === "file" || course.source_type === "upload" || course.sourceType === "upload";
  const isVideoAsset = course.asset_type === "video" || course.type === "video";
  const isVideoFile = !isDocument && !isYouTube && (
    (isUploadedFile && rawUrl) ||
    (isVideoAsset && rawUrl) ||
    (rawUrl && (
      rawUrl.toLowerCase().endsWith(".mp4") ||
      rawUrl.toLowerCase().endsWith(".webm") ||
      rawUrl.toLowerCase().endsWith(".mov")
    ))
  );
  let finalUrl = rawUrl;
  if (isYouTube && rawUrl && !rawUrl.includes("embed")) {
    finalUrl = rawUrl.replace("watch?v=", "embed/");
  }

  const handleBack = () => {
    const completed = videoEndedRef.current;
    if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    if (course.id && course.type && latestProgressRef.current > 0 && latestProgressRef.current < 95) {
      saveVideoProgress(course._progressScheduleId, course.id, course.type, latestProgressRef.current, course.parentContentId, course.parentContentType);
    }
    Alert.alert(
      completed ? "Content Completed" : "Content Progress",
      completed
        ? (course.follow_up_type ? "You have finished viewing this content. Start the follow-up assessment?" : "You have finished watching this content. Mark as done?")
        : (course.follow_up_type ? "Did you finish viewing this content? You can start the follow-up assessment." : "Did you finish watching this content?"),
      [
        { text: "No, Not yet", style: "cancel", onPress: onBack },
        { 
          text: course.follow_up_type ? "Yes, Start Follow-up" : "Yes, I'm done", 
          onPress: () => {
            if (course.follow_up_type && onStartFollowUp) {
              onStartFollowUp();
            } else if (onComplete) {
              onComplete();
            } else {
              onBack();
            }
          } 
        }
      ]
    );
  };

  const [docOpened, setDocOpened] = useState(false);
  const [docReturned, setDocReturned] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  // Detect when user returns from external document viewer
  useEffect(() => {
    if (!docOpened) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        setDocReturned(true);
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [docOpened]);

  // Prompt follow-up when user returns from viewing document
  useEffect(() => {
    if (!docReturned || !course.follow_up_type) return;
    const timer = setTimeout(() => {
      Alert.alert(
        "Document Viewed",
        `You have viewed the training document. Ready to start the follow-up ${course.follow_up_type === "quiz" ? "quiz" : "video"}?`,
        [
          { text: "Not yet", style: "cancel" },
          { text: `Start ${course.follow_up_type === "quiz" ? "Quiz" : "Video"}`, onPress: () => {
            if (onStartFollowUp) onStartFollowUp();
          }}
        ]
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [docReturned, course.follow_up_type]);

  const openDocumentExternally = async () => {
    if (!finalUrl) return;
    try {
      // For PDFs and documents, use expo-web-browser for HTTPS URLs
      if (finalUrl.startsWith("https://") || finalUrl.startsWith("http://")) {
        setDocOpened(true);
        const result = await WebBrowser.openBrowserAsync(finalUrl);
        if (result.type === "dismiss") {
          setDocReturned(true);
        }
      } else {
        const supported = await Linking.canOpenURL(finalUrl);
        if (supported) {
          setDocOpened(true);
          await Linking.openURL(finalUrl);
        } else {
          Alert.alert("Cannot Open", "Your device cannot open this file type directly.", [{ text: "OK" }]);
        }
      }
    } catch (e: any) {
      // Fallback: try Linking.openURL
      try {
        setDocOpened(true);
        await Linking.openURL(finalUrl);
      } catch (e2: any) {
        Alert.alert("Error", `Could not open document: ${e?.message || e2?.message || "Unknown error"}`, [{ text: "OK" }]);
      }
    }
  };

  if (!finalUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <SafeAreaView style={{ flex: 0, backgroundColor: "#000" }} />
        <View style={styles.playerHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="alert-circle-outline" size={48} color="#666" />
          <Text style={{ color: "#999", marginTop: 12, fontSize: 16 }}>No content available</Text>
        </View>
      </View>
    );
  }

  // --- DOCUMENT VIEWER (opens in native viewer with restrictions) ---
  if (isDocument) {
    const allowDownload = course.allow_download || course.allowDownload || false;
    const allowPrint = course.allow_print || course.allowPrint || false;
    const allowShare = course.allow_share || course.allowShare || false;
    const hasRestrictions = !allowDownload || !allowPrint || !allowShare;

    return (
      <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
        <SafeAreaView style={{ flex: 0, backgroundColor: "#fff" }} />
        <View style={[styles.playerHeader, { backgroundColor: "#fff" }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: "#333" }]}>← {course.follow_up_type ? "Back / Start Follow-up" : "Back / Finish"}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: "center", alignItems: "center", padding: 20, flexGrow: 1 }}>
          <View style={styles.docCard}>
            <View style={styles.docIconContainer}>
              <Ionicons name="document-text-outline" size={48} color="#3b82f6" />
            </View>
            <Text style={styles.docTitle} numberOfLines={2}>{course.title || "Training Document"}</Text>
            <Text style={styles.docDesc} numberOfLines={3}>{course.description || ""}</Text>

            {/* Restriction Notices */}
            {hasRestrictions && (
              <View style={styles.restrictionBox}>
                <Text style={styles.restrictionTitle}>Document Restrictions</Text>
                <View style={styles.restrictionRow}>
                  <Ionicons name={allowDownload ? "checkmark-circle" : "close-circle"} size={16} color={allowDownload ? "#10b981" : "#ef4444"} />
                  <Text style={styles.restrictionText}>Download {allowDownload ? "Allowed" : "Disabled"}</Text>
                </View>
                <View style={styles.restrictionRow}>
                  <Ionicons name={allowPrint ? "checkmark-circle" : "close-circle"} size={16} color={allowPrint ? "#10b981" : "#ef4444"} />
                  <Text style={styles.restrictionText}>Print {allowPrint ? "Allowed" : "Disabled"}</Text>
                </View>
                <View style={styles.restrictionRow}>
                  <Ionicons name={allowShare ? "checkmark-circle" : "close-circle"} size={16} color={allowShare ? "#10b981" : "#ef4444"} />
                  <Text style={styles.restrictionText}>Share {allowShare ? "Allowed" : "Disabled"}</Text>
                </View>
                {!allowDownload && !allowPrint && !allowShare && (
                  <Text style={styles.restrictionWarning}>This document is view-only. Downloading, printing, and sharing are prohibited by administrator policy.</Text>
                )}
              </View>
            )}

            {/* Open Document Button */}
            <TouchableOpacity style={styles.openDocBtn} onPress={openDocumentExternally}>
              <Ionicons name={docOpened ? "eye-outline" : "open-outline"} size={20} color="#fff" />
              <Text style={styles.openDocBtnText}>{docOpened ? "Reopen Document" : "Open Document"}</Text>
            </TouchableOpacity>

            {/* Document Viewed Indicator */}
            {docOpened && (
              <View style={styles.viewedIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.viewedText}>Document opened</Text>
              </View>
            )}

            {/* Start Follow-up Button - appears after document is opened */}
            {course.follow_up_type && docOpened && (
              <TouchableOpacity style={[styles.openDocBtn, { backgroundColor: "#10b981", marginTop: 10 }]} onPress={() => {
                if (onStartFollowUp) onStartFollowUp();
              }}>
                <Ionicons name="play-circle-outline" size={20} color="#fff" />
                <Text style={styles.openDocBtnText}>Start Follow-up {course.follow_up_type === "quiz" ? "Quiz" : "Video"}</Text>
              </TouchableOpacity>
            )}

            {/* Follow-up hint before opening */}
            {course.follow_up_type && !docOpened && (
              <Text style={styles.followUpHint}>View the document to unlock the follow-up {course.follow_up_type === "quiz" ? "quiz" : "video"}</Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- WEB VIEWER (handles all video types: direct files, YouTube, streaming URLs) ---
  if (finalUrl) {
    let youtubeVideoId = "";
    if (isYouTube && finalUrl) {
      const match = finalUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
      youtubeVideoId = match ? match[1] : "";
    }
    const videoHtml = isVideoFile && !isYouTube
      ? buildRestrictedVideoHtml(finalUrl, resumePosition)
      : isYouTube
      ? buildYouTubeHtml(youtubeVideoId)
      : null;

    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <SafeAreaView style={{ flex: 0, backgroundColor: "#000" }} />
        <View style={styles.playerHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← {course.follow_up_type ? "Back / Start Follow-up" : "Back / Finish"}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <WebView
            originWhitelist={["*"]}
            source={videoHtml ? { html: videoHtml, baseUrl: `${MEDIA_BASE_URL}/` } : { uri: finalUrl }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            allowsFullscreenVideo={true}
            startInLoadingState={true}
            onMessage={handleWebViewMessage}
            renderLoading={() => (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            )}
            onError={(e) => {
              console.log("WebView error:", e?.nativeEvent?.description);
            }}
          />
        </View>
        {isVideoFile && (
          <View style={{ backgroundColor: "#111", paddingHorizontal: 15, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Progress: {Math.round(videoProgress)}%</Text>
            <Text style={{ color: videoProgress >= 95 ? "#059669" : "#9ca3af", fontSize: 12 }}>
              {videoProgress >= 95 ? "✓ Completed" : "Watch 95% to complete"}
            </Text>
          </View>
        )}
      </View>
    );
  }
};

// --- MAIN SCREEN ---
export default function LearnScreen() {
  const [activeTab, setActiveTab] = useState("my-training");
  const [subFilter, setSubFilter] = useState("all");
  const [assignedContent, setAssignedContent] = useState<any[]>([]);
  const [myResults, setMyResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [followUpContent, setFollowUpContent] = useState<any>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [scheduleCheckedIn, setScheduleCheckedIn] = useState(false);
  const [contentProgress, setContentProgress] = useState<Record<string, number>>({});
  const [quizScheduleContext, setQuizScheduleContext] = useState<any>(null);
  const [completedSchedules, setCompletedSchedules] = useState<any[]>([]);
  const [myCertificates, setMyCertificates] = useState<any[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);

  const fetchAssignedContent = async () => {
    try {
      const [contentRes, resultsRes, certRes] = await Promise.all([
        api.get("/learning/courses/my-assigned-content/"),
        api.get("/learning/courses/my-results/"),
        api.get("/learning/courses/my-certificates/"),
      ]);
      const data = contentRes.data;
      const all = [
        ...(data.quizzes || []).map((q: any) => ({ ...q, type: "quiz" })),
        ...(data.videos || []).map((v: any) => ({ ...v, type: "video" })),
        ...(data.trainings || []).map((t: any) => ({ ...t, type: "training" })),
        ...(data.training_schedules || []).map((s: any) => ({ ...s, type: "training-schedule" })),
      ];
      setAssignedContent(all);
      setMyResults(resultsRes.data || []);
      setCompletedSchedules(data.completed_schedules || []);
      setMyCertificates(Array.isArray(certRes.data) ? certRes.data : []);
      return { results: resultsRes.data || [] };
    } catch (error: any) {
      console.error("Error fetching data:", error?.message);
      return { results: [] };
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAssignedContent();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignedContent();
  };

  const quizzes = assignedContent.filter((c) => c.type === "quiz");
  const videos = assignedContent.filter((c) => c.type === "video");
  const trainings = assignedContent.filter((c) => c.type === "training");
  const schedules = assignedContent.filter((c) => c.type === "training-schedule");

  const filteredAssigned = subFilter === "all" ? assignedContent : assignedContent.filter((c) => c.type === subFilter);
  const filteredResults = subFilter === "all" ? myResults : myResults.filter((r) => (r.content_type || "quiz") === subFilter);

  const getTypeIcon = (type: string) => {
    if (type === "quiz") return "book-outline";
    if (type === "video") return "videocam-outline";
    if (type === "training-schedule") return "calendar-outline";
    return "document-text-outline";
  };

  const getTypeColor = (type: string) => {
    if (type === "quiz") return { bg: "#dbeafe", text: "#1d4ed8" };
    if (type === "video") return { bg: "#d1fae5", text: "#059669" };
    if (type === "training-schedule") return { bg: "#fef3c7", text: "#d97706" };
    return { bg: "#e0e7ff", text: "#4338ca" };
  };

  const findFollowUpContent = (item: any) => {
    if (!item.follow_up_type || !item.follow_up_id) return null;
    const followUpId = String(item.follow_up_id);
    const searchPool = [...assignedContent];
    // Also search schedule linked content since follow-up may only be in the schedule
    if (selectedSchedule?.linked_content) {
      searchPool.push(...selectedSchedule.linked_content);
    }
    if (item.follow_up_type === "quiz") {
      return searchPool.find((c) => c.type === "quiz" && String(c.id) === followUpId);
    } else if (item.follow_up_type === "video") {
      return searchPool.find((c) => c.type === "video" && String(c.id) === followUpId);
    } else if (item.follow_up_type === "training") {
      return searchPool.find((c) => c.type === "training" && String(c.id) === followUpId);
    }
    return null;
  };

  const handleOpenSchedule = async (schedule: any) => {
    setSelectedSchedule(schedule);
    setScheduleCheckedIn(false);
    const linkedContent = schedule.linked_content || [];
    const progressMap: Record<string, number> = {};
    for (const c of linkedContent) {
      const p = await getVideoProgress(schedule.id, c.id, c.type);
      if (p > 0 && p < 95) progressMap[`${c.type}_${c.id}`] = p;
    }
    setContentProgress(progressMap);
    try {
      const res = await api.post(`/learning/training-schedules/${schedule.id}/auto-checkin/`);
      setScheduleCheckedIn(true);
      if (res.data.attendance) {
        setSelectedSchedule({ ...schedule, my_attendance: res.data.attendance });
      }
    } catch (e: any) {
      console.error("Auto check-in failed:", e?.message);
    }
  };

  const handleCompleteSchedule = async () => {
    if (!selectedSchedule) return;
    try {
      await api.post(`/learning/training-schedules/${selectedSchedule.id}/complete-training/`);
      Alert.alert("Completed", "Your training has been marked as completed.", [
        { text: "OK", onPress: () => { setSelectedSchedule(null); fetchAssignedContent(); } }
      ]);
    } catch (e: any) {
      Alert.alert("Error", "Failed to mark training as completed.", [{ text: "OK" }]);
    }
  };

  const isContentCompleted = (content: any) => {
    const direct = myResults.some((r: any) => String(r.content_id) === String(content.id) && r.content_type === content.type && r.status === "passed");
    if (direct) return true;
    if (content.follow_up_type && content.follow_up_id) {
      return myResults.some((r: any) => String(r.content_id) === String(content.follow_up_id) && r.content_type === content.follow_up_type && r.status === "passed");
    }
    return false;
  };

  const isQuizFullyCompleted = (content: any) => {
    const direct = myResults.some((r: any) => String(r.content_id) === String(content.id) && r.content_type === content.type && r.status === "passed" && r.total_questions > 0);
    if (direct) return true;
    if (content.follow_up_type && content.follow_up_id) {
      return myResults.some((r: any) => String(r.content_id) === String(content.follow_up_id) && r.content_type === content.follow_up_type && r.status === "passed" && r.total_questions > 0);
    }
    return false;
  };

  const handleScheduleContentPress = (content: any) => {
    const hasQuestions = content.questions && Array.isArray(content.questions) && content.questions.length > 0;
    const schedId = selectedSchedule?.id;
    if (isContentCompleted(content)) {
      if (hasQuestions && !isQuizFullyCompleted(content)) {
        // Video was watched to completion but quiz not yet taken — allow reopening
        if (content.type === "video" || content.type === "training") {
          const url = content.video_url || content.video_file_url || getMediaUrl(content.video_file);
          setQuizScheduleContext(selectedSchedule);
          setSelectedQuiz({ ...content, video_url: url, _progressScheduleId: schedId });
          return;
        }
      }
      Alert.alert("Already Completed", "You have already completed this content. It cannot be reopened.", [{ text: "OK" }]);
      return;
    }
    if (content.type === "quiz") {
      if (hasQuestions) {
        setQuizScheduleContext(selectedSchedule);
        setSelectedQuiz({ ...content, _progressScheduleId: schedId });
      } else {
        Alert.alert(content.title, content.description || "No questions available for this quiz.", [{ text: "OK" }]);
      }
    } else if (content.type === "video") {
      const url = content.video_url || content.video_file_url || getMediaUrl(content.video_file);
      if (hasQuestions) {
        setQuizScheduleContext(selectedSchedule);
        setSelectedQuiz({ ...content, video_url: url, _progressScheduleId: schedId });
      } else if (url) {
        setSelectedVideo({ ...content, video_url: url, video_source: content.video_source || content.videoSource, videoSource: content.videoSource, _progressScheduleId: schedId });
      } else {
        Alert.alert(content.title, content.description || "No video content available.", [{ text: "OK" }]);
      }
    } else if (content.type === "training") {
      const url = content.content_url || content.file_url || getMediaUrl(content.file);
      if (url) {
        setSelectedVideo({ ...content, video_url: url, content_url: url, file_url: url, _progressScheduleId: schedId });
      } else {
        Alert.alert(content.title, content.description || "No training content available.", [{ text: "OK" }]);
      }
    }
  };

  const handleStartFollowUp = async () => {
    if (!selectedVideo) return;
    const parentContentId = selectedVideo.id;
    const parentContentType = selectedVideo.type;
    const schedId = selectedVideo._progressScheduleId ?? null;
    let followUp = findFollowUpContent(selectedVideo);
    
    // If not found locally, try fetching from API
    if (!followUp && selectedVideo.follow_up_type && selectedVideo.follow_up_id) {
      try {
        const fuType = selectedVideo.follow_up_type;
        const fuId = selectedVideo.follow_up_id;
        let endpoint = "";
        if (fuType === "video") endpoint = `/learning/videos/${fuId}/`;
        else if (fuType === "quiz") endpoint = `/learning/quizzes/${fuId}/`;
        else if (fuType === "training") endpoint = `/learning/training-items/${fuId}/`;
        if (endpoint) {
          const res = await api.get(endpoint);
          followUp = { ...res.data, type: fuType };
        }
      } catch (e: any) {
        console.error("Failed to fetch follow-up content:", e?.message);
      }
    }

    if (followUp) {
      setSelectedVideo(null);
      const hasQuestions = followUp.questions && Array.isArray(followUp.questions) && followUp.questions.length > 0;
      if (hasQuestions) {
        setSelectedQuiz({ ...followUp, parentContentId, parentContentType, parentContentTitle: selectedVideo.title, _progressScheduleId: schedId });
      } else if (followUp.type === "video") {
        const url = followUp.video_url || followUp.video_file_url || getMediaUrl(followUp.video_file);
        setSelectedVideo({ ...followUp, video_url: url, video_source: followUp.video_source || followUp.videoSource, videoSource: followUp.videoSource, parentContentId, parentContentType, _progressScheduleId: schedId });
      } else if (followUp.type === "training") {
        const url = followUp.content_url || followUp.file_url || getMediaUrl(followUp.file);
        if (url) {
          setSelectedVideo({ ...followUp, video_url: url, content_url: url, file_url: url, parentContentId, parentContentType, _progressScheduleId: schedId });
        } else {
          Alert.alert(followUp.title, followUp.description || "No training content available.", [{ text: "OK" }]);
        }
      } else {
        Alert.alert(followUp.title, followUp.description || "Follow-up content available.", [{ text: "OK" }]);
      }
    } else {
      Alert.alert("Follow-up", "Follow-up content not found. Please contact your administrator.", [{ text: "OK" }]);
    }
  };

  const handleVideoComplete = async () => {
    const video = selectedVideo;
    setSelectedVideo(null);
    try {
      await api.post("/learning/courses/submit-quiz-result/", {
        content_type: video.type,
        content_id: video.id,
        content_title: video.title || "",
        score: 100,
        correct_answers: 0,
        total_questions: 0,
        time_taken: 0,
        answers: [],
        questions: [],
        pass_percentage: 0,
      });
    } catch (e: any) {
      console.error("Failed to submit video result:", e?.message);
    }
    const { results } = await fetchAssignedContent();
    if (selectedSchedule) {
      const linkedContent = selectedSchedule.linked_content || [];
      const isCompletedFresh = (content: any) => {
        const hasQs = content.questions && Array.isArray(content.questions) && content.questions.length > 0;
        const matches = (r: any, cid: any, ctype: any, requireQ: boolean) =>
          String(r.content_id) === String(cid) && r.content_type === ctype && r.status === "passed" && (!requireQ || r.total_questions > 0);
        const direct = results.some((r: any) => matches(r, content.id, content.type, hasQs));
        if (direct) return true;
        if (content.follow_up_type && content.follow_up_id) {
          return results.some((r: any) => matches(r, content.follow_up_id, content.follow_up_type, hasQs));
        }
        return false;
      };
      const nextContent = linkedContent.find((c: any) =>
        !isCompletedFresh(c) && String(c.id) !== String(video.id)
      );
      if (nextContent) {
        handleScheduleContentPress(nextContent);
      }
    }
  };

  const handleItemPress = (item: any) => {
    const hasQuestions = item.questions && Array.isArray(item.questions) && item.questions.length > 0;
    if (item.type === "quiz") {
      if (hasQuestions) {
        setSelectedQuiz({ ...item, _progressScheduleId: null });
      } else {
        Alert.alert(item.title, item.description || "No questions available for this quiz.", [{ text: "OK" }]);
      }
    } else if (item.type === "video") {
      const url = item.video_url || item.video_file_url || getMediaUrl(item.video_file);
      if (hasQuestions) {
        setSelectedQuiz({ ...item, video_url: url, _progressScheduleId: null });
      } else if (url) {
        setSelectedVideo({ ...item, video_url: url, video_source: item.video_source || item.videoSource, videoSource: item.videoSource, _progressScheduleId: null });
      } else {
        Alert.alert(item.title, item.description || "No video content available.", [{ text: "OK" }]);
      }
    } else if (item.type === "training-schedule") {
      handleOpenSchedule(item);
    } else if (item.type === "training") {
      const url = item.content_url || item.file_url || getMediaUrl(item.file);
      if (url) {
        setSelectedVideo({ ...item, video_url: url, content_url: url, file_url: url, _progressScheduleId: null });
      } else {
        Alert.alert(item.title, item.description || "No training content available.", [{ text: "OK" }]);
      }
    } else {
      Alert.alert(item.title, item.description || "No description available.", [{ text: "OK" }]);
    }
  };

  // QUIZ SCREEN
  if (selectedQuiz) {
    return (
      <QuizScreen
        item={selectedQuiz}
        scheduleId={quizScheduleContext?.id}
        onBack={async () => { setSelectedQuiz(null); setQuizScheduleContext(null); if (selectedSchedule) { await fetchAssignedContent(); const linked = selectedSchedule.linked_content || []; const pm: Record<string, number> = {}; for (const c of linked) { const p = await getVideoProgress(selectedSchedule.id, c.id, c.type); if (p > 0 && p < 95) pm[`${c.type}_${c.id}`] = p; } setContentProgress(pm); } }}
        onQuizComplete={quizScheduleContext ? async (score: number, passed: boolean) => {
          try {
            const quiz = selectedQuiz;
            setSelectedQuiz(null);
            const { results } = await fetchAssignedContent();
            const linkedContent = quizScheduleContext.linked_content || [];
            const isCompletedFresh = (content: any) => {
              const hasQs = content.questions && Array.isArray(content.questions) && content.questions.length > 0;
              const matches = (r: any, cid: any, ctype: any, requireQ: boolean) =>
                String(r.content_id) === String(cid) && r.content_type === ctype && r.status === "passed" && (!requireQ || r.total_questions > 0);
              const direct = results.some((r: any) => matches(r, content.id, content.type, hasQs));
              if (direct) return true;
              if (content.follow_up_type && content.follow_up_id) {
                return results.some((r: any) => matches(r, content.follow_up_id, content.follow_up_type, hasQs));
              }
              return false;
            };
            const nextContent = linkedContent.find((c: any) =>
              !isCompletedFresh(c) && String(c.id) !== String(quiz.id)
            );
            if (nextContent) {
              setQuizScheduleContext(null);
              handleScheduleContentPress(nextContent);
            } else {
              // All content completed — go back to schedule detail so user can click Complete
              setQuizScheduleContext(null);
              // Refresh schedule data to reflect completion
              if (selectedSchedule) {
                const linked = selectedSchedule.linked_content || [];
                const pm: Record<string, number> = {};
                for (const c of linked) {
                  const p = await getVideoProgress(selectedSchedule.id, c.id, c.type);
                  if (p > 0 && p < 95) pm[`${c.type}_${c.id}`] = p;
                }
                setContentProgress(pm);
              }
              setTimeout(() => {
                Alert.alert(
                  "Quiz Submitted",
                  `Quiz submitted with ${score}%. ${passed ? "Passed!" : "Did not pass."} Click "Complete" to finish the training.`,
                  [{ text: "OK" }]
                );
              }, 300);
            }
          } catch (e: any) {
            console.error("onQuizComplete failed:", e?.message);
          }
        } : undefined}
      />
    );
  }

  // CERTIFICATE DETAIL VIEW
  if (selectedCertificate) {
    const cert = selectedCertificate;
    const issuedDate = cert.issued_at ? new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
    const expiryDate = cert.expires_at ? new Date(cert.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
    const isExpired = cert.expires_at && new Date(cert.expires_at) < new Date();
    const qrValue = `${api.defaults.baseURL || ""}/api/learning/courses/my-certificates/?cert=${cert.certificate_number}`;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedCertificate(null)} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Certificate</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {/* Certificate Card */}
          <View style={styles.certCardOuter}>
            {/* Outer Gold Border */}
            <View style={styles.certGoldBorder}>
              {/* Inner Blue Border */}
              <View style={styles.certBlueBorder}>
                {/* Content */}
                <View style={styles.certContent}>
                  {/* Organization Name */}
                  <Text style={styles.certOrgNameText}>
                    {cert.organization_name || "VIBRO Learning, Training & Development"}
                  </Text>

                  {/* Decorative Line */}
                  <View style={styles.certDecoLine} />

                  {/* Certificate Title */}
                  <Text style={styles.certTitleText}>CERTIFICATE OF COMPLETION</Text>

                  {/* Awarded to */}
                  <Text style={styles.certAwardedTo}>This certificate is awarded to</Text>

                  {/* Recipient Name */}
                  <Text style={styles.certRecipientName}>{cert.user_name || "Participant"}</Text>

                  {/* Department */}
                  {cert.user_department ? (
                    <Text style={styles.certDeptText}>Department: {cert.user_department}</Text>
                  ) : null}

                  {/* Decorative Line */}
                  <View style={styles.certDecoLineSmall} />

                  {/* For successfully completing */}
                  <Text style={styles.certAwardedTo}>for successfully completing</Text>

                  {/* Training Title */}
                  <Text style={styles.certTrainingTitleText}>{cert.quiz_title || "Training Program"}</Text>

                  {/* Conducted by */}
                  <Text style={styles.certConductedBy}>
                    conducted by {cert.organization_name || "VIBRO Learning, Training & Development"}
                  </Text>

                  {/* Score Badge */}
                  <View style={styles.certScoreBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#d97706" />
                    <Text style={styles.certScoreBadgeText}>
                      Score: {cert.score}% (Pass: {cert.pass_percentage}%)
                    </Text>
                  </View>

                  {/* Dates */}
                  <View style={styles.certDatesRow}>
                    <Text style={styles.certDateText}>
                      Issued on: <Text style={styles.certDateValue}>{issuedDate}</Text>
                    </Text>
                    {expiryDate ? (
                      <Text style={styles.certDateText}>
                        Valid until: <Text style={styles.certDateValue}>{expiryDate}</Text>
                      </Text>
                    ) : null}
                  </View>

                  {/* Certified Professional Badge */}
                  <View style={styles.certProBadge}>
                    <Ionicons name="ribbon" size={14} color="#fff" />
                    <Text style={styles.certProBadgeText}>Certified Professional</Text>
                  </View>

                  {/* Certificate Number */}
                  <Text style={styles.certNumberText}>
                    Certificate No: {cert.certificate_number}
                  </Text>

                  {/* Divider */}
                  <View style={styles.certDividerLine} />

                  {/* Digital Signature & QR Code */}
                  <View style={styles.certSignRow}>
                    {/* Signature */}
                    <View style={styles.certSignCol}>
                      <Text style={styles.certSignOrgName}>
                        {cert.organization_name || "VIBRO Learning, Training & Development"}
                      </Text>
                      <Text style={styles.certSignRole}>Authorized Signatory</Text>
                      <View style={styles.certDigitalSignRow}>
                        <Ionicons name="shield-checkmark" size={14} color="#2563eb" />
                        <Text style={styles.certDigitalSignText}>Digitally Signed</Text>
                      </View>
                    </View>

                    {/* QR Code */}
                    <View style={styles.certQRCol}>
                      <View style={styles.certQRBox}>
                        <QRCodeSVG
                          value={qrValue}
                          size={70}
                        />
                      </View>
                      <Text style={styles.certQRLabel}>Scan to verify</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Expired Warning */}
          {isExpired && (
            <View style={styles.certExpiredWarning}>
              <Ionicons name="alert-circle" size={18} color="#dc2626" />
              <Text style={styles.certExpiredText}>This certificate has expired and is no longer valid.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // MEDIA VIEWER (Video / Document) — must be checked before selectedSchedule
  // so that clicking "View" on content inside a schedule shows the video, not the schedule detail
  if (selectedVideo) {
    return (
      <MediaViewer
        course={selectedVideo}
        scheduleId={selectedSchedule?.id}
        onBack={async () => { setSelectedVideo(null); if (selectedSchedule) { await fetchAssignedContent(); const linked = selectedSchedule.linked_content || []; const pm: Record<string, number> = {}; for (const c of linked) { const p = await getVideoProgress(selectedSchedule.id, c.id, c.type); if (p > 0 && p < 95) pm[`${c.type}_${c.id}`] = p; } setContentProgress(pm); } }}
        onStartFollowUp={handleStartFollowUp}
        onComplete={handleVideoComplete}
      />
    );
  }

  // TRAINING SCHEDULE DETAIL VIEW
  if (selectedSchedule) {
    const linkedContent = selectedSchedule.linked_content || [];
    const myAtt = selectedSchedule.my_attendance;
    const isCompleted = myAtt?.check_out_time != null;
    const isCheckedIn = myAtt?.check_in_time != null;
    const completedContentCount = linkedContent.filter((c: any) => {
      const hasQs = c.questions && Array.isArray(c.questions) && c.questions.length > 0;
      return hasQs ? isQuizFullyCompleted(c) : isContentCompleted(c);
    }).length;
    const allContentCompleted = linkedContent.length === 0 || completedContentCount === linkedContent.length;
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#eee" }}>
          <TouchableOpacity onPress={() => { setSelectedSchedule(null); fetchAssignedContent(); }} style={{ marginRight: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: "bold", color: "#1f2937" }}>Training Details</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
          {/* Training Info Card */}
          <View style={styles.scheduleCard}>
            <Text style={styles.scheduleTitle}>{selectedSchedule.title}</Text>
            {selectedSchedule.description ? (
              <Text style={styles.scheduleDesc}>{selectedSchedule.description}</Text>
            ) : null}

            <View style={styles.scheduleInfoRow}>
              <Ionicons name="calendar-outline" size={14} color="#888" />
              <Text style={styles.scheduleInfoText}>
                {selectedSchedule.start_date} → {selectedSchedule.end_date}
              </Text>
              <Ionicons name="time-outline" size={14} color="#888" style={{ marginLeft: 8 }} />
              <Text style={styles.scheduleInfoText}>
                {selectedSchedule.start_time} - {selectedSchedule.end_time}
              </Text>
            </View>
            {selectedSchedule.venue_name ? (
              <View style={styles.scheduleInfoRow}>
                <Ionicons name="location-outline" size={14} color="#888" />
                <Text style={styles.scheduleInfoText}>{selectedSchedule.venue_name}</Text>
              </View>
            ) : null}
            {selectedSchedule.trainer_name ? (
              <View style={styles.scheduleInfoRow}>
                <Ionicons name="person-outline" size={14} color="#888" />
                <Text style={styles.scheduleInfoText}>{selectedSchedule.trainer_name}</Text>
              </View>
            ) : null}
          </View>

          {/* Attendance Status */}
          <View style={[styles.attendanceStatusCard, isCompleted ? { backgroundColor: "#d1fae5" } : isCheckedIn ? { backgroundColor: "#dbeafe" } : { backgroundColor: "#fef3c7" }]}>
            <Ionicons
              name={isCompleted ? "checkmark-circle" : isCheckedIn ? "enter-outline" : "time-outline"}
              size={20}
              color={isCompleted ? "#059669" : isCheckedIn ? "#2563eb" : "#d97706"}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.attendanceStatusText, { color: isCompleted ? "#059669" : isCheckedIn ? "#2563eb" : "#d97706" }]}>
                {isCompleted ? "Training Completed" : scheduleCheckedIn ? "Checked In" : "Checking in..."}
              </Text>
              {myAtt?.check_in_time ? (
                <Text style={styles.attendanceTimeText}>
                  Check-in: {new Date(myAtt.check_in_time).toLocaleTimeString()}
                  {myAtt.check_out_time ? `  |  Check-out: ${new Date(myAtt.check_out_time).toLocaleTimeString()}` : ""}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Linked Content */}
          <Text style={styles.sectionTitle}>Training Content</Text>
          {linkedContent.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>No content linked to this training.</Text>
            </View>
          ) : (
            linkedContent.map((content: any, index: number) => {
              const typeColors = getTypeColor(content.type);
              const completed = isContentCompleted(content);
              const fullyCompleted = isQuizFullyCompleted(content);
              const hasQs = content.questions && Array.isArray(content.questions) && content.questions.length > 0;
              const videoDoneQuizPending = completed && hasQs && !fullyCompleted;
              const progressKey = `${content.type}_${content.id}`;
              const savedProgress = contentProgress[progressKey] || 0;
              const inProgress = !completed && savedProgress > 0;
              return (
                <TouchableOpacity
                  key={`sched-content-${content.type}-${content.id}-${index}`}
                  style={[styles.contentCard, fullyCompleted && { opacity: 0.6 }]}
                  onPress={() => handleScheduleContentPress(content)}
                  activeOpacity={0.7}
                >
                  <View style={styles.contentCardHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.contentTitle} numberOfLines={2}>{content.title}</Text>
                      {content.description ? (
                        <Text style={styles.contentDesc} numberOfLines={1}>{content.description}</Text>
                      ) : null}
                    </View>
                    {fullyCompleted ? (
                      <View style={[styles.typeBadge, { backgroundColor: "#d1fae5" }]}>
                        <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        <Text style={[styles.typeBadgeText, { color: "#059669" }]}>Completed</Text>
                      </View>
                    ) : videoDoneQuizPending ? (
                      <View style={[styles.typeBadge, { backgroundColor: "#dbeafe" }]}>
                        <Ionicons name="videocam-outline" size={12} color="#2563eb" />
                        <Text style={[styles.typeBadgeText, { color: "#2563eb" }]}>Video Done</Text>
                      </View>
                    ) : inProgress ? (
                      <View style={[styles.typeBadge, { backgroundColor: "#fef3c7" }]}>
                        <Ionicons name="play-circle-outline" size={12} color="#d97706" />
                        <Text style={[styles.typeBadgeText, { color: "#d97706" }]}>{Math.round(savedProgress)}%</Text>
                      </View>
                    ) : (
                      <View style={[styles.typeBadge, { backgroundColor: typeColors.bg }]}>
                        <Ionicons name={getTypeIcon(content.type) as any} size={12} color={typeColors.text} />
                        <Text style={[styles.typeBadgeText, { color: typeColors.text }]}>
                          {content.type === "quiz" ? "Quiz" : content.type === "video" ? "Video" : "Training"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.contentCardFooter}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {content.time_limit ? <Text style={styles.metaText}>⏱ {content.time_limit} min</Text> : null}
                      {content.pass_percentage != null ? <Text style={styles.metaText}>Pass: {content.pass_percentage}%</Text> : null}
                      {hasQs ? (
                        <Text style={styles.metaText}>{content.questions.length} Qs</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity style={[styles.startBtn, fullyCompleted && { backgroundColor: "#9ca3af" }, inProgress && { backgroundColor: "#d97706" }, videoDoneQuizPending && { backgroundColor: "#2563eb" }]} onPress={() => handleScheduleContentPress(content)}>
                      <Text style={styles.startBtnText}>
                        {fullyCompleted ? "Done" : videoDoneQuizPending ? "Resume Quiz" : inProgress ? "Resume" : content.type === "video" || content.type === "training" ? "View" : "Start"}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Complete Button */}
          {!isCompleted && (
            <>
              {allContentCompleted ? (
                <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteSchedule}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <Text style={styles.completeBtnText}>Mark Training as Completed</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.incompleteWarning}>
                  <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
                  <Text style={styles.incompleteWarningText}>
                    Complete all training content ({completedContentCount}/{linkedContent.length}) before marking this training as completed.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const renderStatCard = (icon: string, label: string, value: string, color: string, bgColor: string) => (
    <View style={styles.statCard} key={label}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={{ marginLeft: 5 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );

  const renderContentItem = ({ item }: { item: any }) => {
    const typeColors = getTypeColor(item.type);
    return (
      <TouchableOpacity
        style={styles.contentCard}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.contentCardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.contentTitle} numberOfLines={2}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.contentDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
          <View style={[styles.typeBadge, { backgroundColor: typeColors.bg }]}>
            <Ionicons name={getTypeIcon(item.type) as any} size={12} color={typeColors.text} />
            <Text style={[styles.typeBadgeText, { color: typeColors.text }]}>
              {item.type === "quiz" ? "Quiz" : item.type === "video" ? "Video" : item.type === "training-schedule" ? "Schedule" : "Training"}
            </Text>
          </View>
        </View>

        <View style={styles.contentCardFooter}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {item.time_limit ? (
              <Text style={styles.metaText}>⏱ {item.time_limit} min</Text>
            ) : null}
            {item.pass_percentage != null ? (
              <Text style={styles.metaText}>Pass: {item.pass_percentage}%</Text>
            ) : null}
            {item.questions && Array.isArray(item.questions) && item.questions.length > 0 ? (
              <Text style={styles.metaText}>{item.questions.length} Qs</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => handleItemPress(item)}
          >
            <Text style={styles.startBtnText}>
              {item.type === "training-schedule" ? "Details" : item.type === "video" || item.type === "training" ? "View" : "Start"}
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Learning</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {renderStatCard("book-outline", "Quizzes", String(quizzes.length), "#2563eb", "#dbeafe")}
        {renderStatCard("videocam-outline", "Videos", String(videos.length), "#059669", "#d1fae5")}
        {renderStatCard("document-text-outline", "Trainings", String(trainings.length + schedules.length), "#4338ca", "#e0e7ff")}
        {renderStatCard("trophy-outline", "Attempts", String(myResults.length), "#d97706", "#fef3c7")}
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        {[
          { key: "my-training", label: "My Training" },
          { key: "dashboard", label: "Dashboard" },
          { key: "certificates", label: "Certificates" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => { setActiveTab(tab.key); setSubFilter("all"); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub Filter Pills */}
      {activeTab !== "certificates" && (
      <View style={styles.subFilterContainer}>
        {[
          { key: "all", label: "All" },
          { key: "quiz", label: "Quiz" },
          { key: "video", label: "Video" },
          { key: "training", label: "Training" },
          { key: "training-schedule", label: "Schedule" },
        ].map((sub) => (
          <TouchableOpacity
            key={sub.key}
            style={[styles.subFilterPill, subFilter === sub.key && styles.subFilterPillActive]}
            onPress={() => setSubFilter(sub.key)}
          >
            <Text style={[styles.subFilterText, subFilter === sub.key && styles.subFilterTextActive]}>
              {sub.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
        ) : activeTab === "my-training" ? (
          /* My Training Tab - Assigned Content */
          <View>
            {filteredAssigned.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="school-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>You have no assigned training yet.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredAssigned}
                renderItem={renderContentItem}
                keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 7 }} />}
              />
            )}
          </View>
        ) : activeTab === "certificates" ? (
          /* Certificates Tab */
          <View>
            <Text style={styles.sectionTitle}>My Certificates</Text>
            {myCertificates.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="ribbon-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No certificates yet. Complete training and quizzes to earn certificates.</Text>
              </View>
            ) : (
              myCertificates.map((cert: any, index: number) => {
                const isExpired = cert.expires_at && new Date(cert.expires_at) < new Date();
                const issuedDate = cert.issued_at ? new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
                return (
                  <TouchableOpacity
                    key={`cert-${cert.id}-${index}`}
                    style={styles.certListItem}
                    onPress={() => setSelectedCertificate(cert)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.certListItemIcon}>
                      <Ionicons name="ribbon" size={22} color={isExpired ? "#9ca3af" : "#d97706"} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.certListItemTitle} numberOfLines={2}>{cert.quiz_title || "Training Program"}</Text>
                      <Text style={styles.certListItemNumber}>{cert.certificate_number}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Text style={styles.certListItemDate}>Issued: {issuedDate}</Text>
                        <View style={[styles.certStatusBadge, { backgroundColor: isExpired ? "#fee2e2" : "#d1fae5" }]}>
                          <Text style={[styles.certStatusText, { color: isExpired ? "#dc2626" : "#059669" }]}>
                            {isExpired ? "Expired" : "Active"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#ccc" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          /* Dashboard Tab - Completed Schedules + Submitted Results */
          <View>
            {completedSchedules.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Completed Training</Text>
                {completedSchedules.map((sched: any, index: number) => {
                  const att = sched.my_attendance;
                  const checkOut = att?.check_out_time ? new Date(att.check_out_time).toLocaleDateString() : "";
                  // Find quiz results for this schedule's linked content (including follow-up targets)
                  const linkedContent = sched.linked_content || [];
                  const matchPairs: { id: string; type: string }[] = [];
                  for (const c of linkedContent) {
                    matchPairs.push({ id: String(c.id), type: c.type });
                    if (c.follow_up_type && c.follow_up_id) {
                      matchPairs.push({ id: String(c.follow_up_id), type: c.follow_up_type });
                    }
                  }
                  const schedResults = myResults.filter((r: any) =>
                    matchPairs.some((p) => p.id === String(r.content_id) && p.type === r.content_type) && r.total_questions > 0
                  );
                  const bestResult = schedResults.length > 0
                    ? schedResults.reduce((best: any, r: any) => (r.score > (best?.score || 0) ? r : best), schedResults[0])
                    : null;
                  const scorePct = bestResult ? Math.round((bestResult.correct_answers / bestResult.total_questions) * 100) : null;
                  const timeMin = bestResult ? Math.floor((bestResult.time_taken || 0) / 60) : 0;
                  const timeSec = bestResult ? (bestResult.time_taken || 0) % 60 : 0;
                  return (
                    <View key={`completed-sched-${sched.id}-${index}`} style={styles.resultCard}>
                      <View style={styles.resultCardHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.resultTitle} numberOfLines={1}>{sched.title}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <View style={[styles.typeBadge, { backgroundColor: "#fef3c7" }]}>
                              <Ionicons name="calendar-outline" size={12} color="#d97706" />
                              <Text style={[styles.typeBadgeText, { color: "#d97706" }]}>Schedule</Text>
                            </View>
                            <View style={[styles.resultBadge, { backgroundColor: "#d1fae5" }]}>
                              <Ionicons name="checkmark-circle" size={10} color="#059669" />
                              <Text style={[styles.resultBadgeText, { color: "#059669" }]}>Completed</Text>
                            </View>
                          </View>
                        </View>
                        {scorePct !== null && (
                          <Text style={styles.resultScore}>{scorePct}%</Text>
                        )}
                      </View>
                      <View style={styles.resultCardFooter}>
                        {bestResult ? (
                          <>
                            <Text style={styles.resultMeta}>{bestResult.correct_answers}/{bestResult.total_questions}</Text>
                            <Text style={styles.resultMeta}>{timeMin}m {timeSec}s</Text>
                          </>
                        ) : (
                          <Text style={styles.resultMeta}>Present</Text>
                        )}
                        <Text style={styles.resultMeta}>{checkOut}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.sectionTitle}>My Results</Text>
            {filteredResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="clipboard-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No quiz attempts yet. Complete a quiz to see your results here.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredResults}
                renderItem={({ item }) => {
                  const percentage = item.total_questions > 0 ? Math.round((item.correct_answers / item.total_questions) * 100) : Math.round(item.score || 0);
                  const hasPassed = item.status === "passed" || percentage >= (item.pass_percentage || 70);
                  const typeLabel = item.content_type === "video" ? "Video" : item.content_type === "training" ? "Training" : "Quiz";
                  const typeColors = getTypeColor(item.content_type || "quiz");
                  const completedDate = item.completed_at ? new Date(item.completed_at).toLocaleDateString() : "";
                  const timeMin = Math.floor((item.time_taken || 0) / 60);
                  const timeSec = (item.time_taken || 0) % 60;

                  return (
                    <View style={styles.resultCard}>
                      <View style={styles.resultCardHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.resultTitle} numberOfLines={1}>{item.content_title || "Unknown"}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <View style={[styles.typeBadge, { backgroundColor: typeColors.bg }]}>
                              <Text style={[styles.typeBadgeText, { color: typeColors.text }]}>{typeLabel}</Text>
                            </View>
                            <View style={[styles.resultBadge, { backgroundColor: hasPassed ? "#d1fae5" : "#fee2e2" }]}>
                              <Ionicons name={hasPassed ? "checkmark-circle" : "close-circle"} size={10} color={hasPassed ? "#059669" : "#ef4444"} />
                              <Text style={[styles.resultBadgeText, { color: hasPassed ? "#059669" : "#ef4444" }]}>{hasPassed ? "Pass" : "Fail"}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.resultScore}>{percentage}%</Text>
                      </View>
                      <View style={styles.resultCardFooter}>
                        <Text style={styles.resultMeta}>{item.correct_answers}/{item.total_questions}</Text>
                        <Text style={styles.resultMeta}>{timeMin}m {timeSec}s</Text>
                        <Text style={styles.resultMeta}>{completedDate}</Text>
                      </View>
                    </View>
                  );
                }}
                keyExtractor={(item, index) => `result-${item.id}-${index}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  header: { padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#eee" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  loader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },

  // Player
  playerHeader: { height: 50, backgroundColor: "#111", justifyContent: "center", paddingHorizontal: 15 },
  backButton: { padding: 5 },
  backButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  // Stats
  statsContainer: { flexDirection: "row", padding: 6, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  statCard: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fafbfc", borderRadius: 6, padding: 5, marginHorizontal: 2, borderWidth: 1, borderColor: "#eef0f3" },
  statIcon: { width: 24, height: 24, borderRadius: 5, justifyContent: "center", alignItems: "center" },
  statLabel: { fontSize: 8, color: "#888", fontWeight: "500" },
  statValue: { fontSize: 13, fontWeight: "bold", color: "#333" },

  // Tab Container
  tabContainer: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tab: { flex: 1, paddingVertical: 11, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "#3b82f6" },
  tabText: { color: "#999", fontSize: 12, fontWeight: "600" },
  activeTabText: { color: "#3b82f6" },

  // Sub Filter Pills
  subFilterContainer: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  subFilterPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: "#f5f5f5" },
  subFilterPillActive: { backgroundColor: "#3b82f6" },
  subFilterText: { fontSize: 11, fontWeight: "600", color: "#666" },
  subFilterTextActive: { color: "#fff" },

  // Section
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 10, color: "#333", letterSpacing: 0.3 },

  // Dashboard Grid
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  dashboardCard: { width: "48%", backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#eef0f3", elevation: 1 },
  dashboardIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  dashboardCardTitle: { fontSize: 12, fontWeight: "600", color: "#1f2937", marginBottom: 4, minHeight: 30 },

  // Type Badges
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 16, flexShrink: 0 },
  typeBadgeText: { fontSize: 9, fontWeight: "700" },
  typeBadgeSmall: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 16, alignSelf: "flex-start" },
  typeBadgeTextSmall: { fontSize: 8, fontWeight: "700" },

  // Content Card (My Training list)
  contentCard: { backgroundColor: "#fff", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#eef0f3", elevation: 1 },
  contentCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 },
  contentTitle: { fontSize: 13, fontWeight: "600", color: "#1f2937", flex: 1 },
  contentDesc: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  contentCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaText: { fontSize: 10, color: "#888" },
  startBtn: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#3b82f6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  startBtnText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  // Document Viewer
  docCard: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", width: "100%", maxWidth: 360, borderWidth: 1, borderColor: "#eee", elevation: 2 },
  docIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#dbeafe", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  docTitle: { fontSize: 18, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 6 },
  docDesc: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 12 },
  openDocBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#3b82f6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, width: "100%", justifyContent: "center" },
  openDocBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  restrictionBox: { width: "100%", backgroundColor: "#fef3c7", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#fde68a" },
  restrictionTitle: { fontSize: 13, fontWeight: "bold", color: "#92400e", marginBottom: 8 },
  restrictionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  restrictionText: { fontSize: 12, color: "#78350f" },
  restrictionWarning: { fontSize: 11, color: "#dc2626", marginTop: 6, fontStyle: "italic", textAlign: "center" },
  viewedIndicator: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  viewedText: { fontSize: 12, color: "#10b981", fontWeight: "600" },
  followUpHint: { fontSize: 11, color: "#888", marginTop: 10, textAlign: "center", fontStyle: "italic" },

  // Result Card (Dashboard)
  resultCard: { backgroundColor: "#fff", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#eef0f3", elevation: 1 },
  resultCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  resultTitle: { fontSize: 12, fontWeight: "600", color: "#1f2937", flex: 1 },
  resultBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 16, flexShrink: 0 },
  resultBadgeText: { fontSize: 8, fontWeight: "700" },
  resultCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultMeta: { fontSize: 9, color: "#888" },
  resultScore: { fontSize: 16, fontWeight: "bold", color: "#333", flexShrink: 0, marginLeft: 6 },

  // Empty State
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyText: { color: "#999", fontSize: 14, marginTop: 12, textAlign: "center" },

  // Training Schedule Detail
  scheduleCard: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#eef0f3", elevation: 1 },
  scheduleTitle: { fontSize: 16, fontWeight: "bold", color: "#1f2937", marginBottom: 4 },
  scheduleDesc: { fontSize: 12, color: "#888", marginBottom: 8 },
  scheduleInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  scheduleInfoText: { fontSize: 12, color: "#666" },
  attendanceStatusCard: { flexDirection: "row", alignItems: "center", borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#eef0f3" },
  attendanceStatusText: { fontSize: 13, fontWeight: "bold" },
  attendanceTimeText: { fontSize: 10, color: "#888", marginTop: 1 },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#10b981", paddingVertical: 11, borderRadius: 8, marginTop: 16 },
  completeBtnText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  incompleteWarning: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 8, padding: 10, marginTop: 16 },
  incompleteWarningText: { flex: 1, fontSize: 11, color: "#92400e", lineHeight: 16 },

  // Certificate Detail - LD_Software style
  certCardOuter: { backgroundColor: "#fff", borderRadius: 8, elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  certGoldBorder: { borderWidth: 4, borderColor: "#d97706", borderRadius: 6, margin: 4 },
  certBlueBorder: { borderWidth: 2, borderColor: "#1e3a5f", borderRadius: 4, margin: 4 },
  certContent: { padding: 16, alignItems: "center" },
  certOrgNameText: { fontSize: 14, fontWeight: "bold", color: "#1e3a5f", textAlign: "center", marginBottom: 4 },
  certDecoLine: { width: 120, height: 3, backgroundColor: "#d97706", marginBottom: 12 },
  certTitleText: { fontSize: 18, fontWeight: "bold", color: "#d97706", textAlign: "center", marginBottom: 12, letterSpacing: 1 },
  certAwardedTo: { fontSize: 12, color: "#6b7280", fontStyle: "italic", textAlign: "center", marginBottom: 6 },
  certRecipientName: { fontSize: 22, fontWeight: "bold", color: "#1e3a5f", textAlign: "center", marginBottom: 4 },
  certDeptText: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginBottom: 6 },
  certDecoLineSmall: { width: 80, height: 1.5, backgroundColor: "#d97706", marginBottom: 10 },
  certTrainingTitleText: { fontSize: 16, fontWeight: "bold", color: "#1e3a5f", textAlign: "center", marginBottom: 4 },
  certConductedBy: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginBottom: 12 },
  certScoreBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef3c7", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 12 },
  certScoreBadgeText: { fontSize: 13, fontWeight: "bold", color: "#92400e" },
  certDatesRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 12 },
  certDateText: { fontSize: 11, color: "#6b7280" },
  certDateValue: { fontSize: 11, fontWeight: "600", color: "#374151" },
  certProBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#d97706", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 10 },
  certProBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  certNumberText: { fontSize: 10, fontWeight: "600", color: "#d97706", textAlign: "center", marginBottom: 8 },
  certDividerLine: { height: 1, backgroundColor: "#e5e7eb", width: "100%", marginBottom: 12 },
  certSignRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", width: "100%" },
  certSignCol: { flex: 1, alignItems: "center" },
  certSignOrgName: { fontSize: 11, fontWeight: "bold", color: "#1e3a5f", marginBottom: 2 },
  certSignRole: { fontSize: 10, color: "#9ca3af", marginBottom: 6 },
  certDigitalSignRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  certDigitalSignText: { fontSize: 10, fontWeight: "600", color: "#2563eb" },
  certQRCol: { alignItems: "center" },
  certQRBox: { padding: 6, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, backgroundColor: "#fff" },
  certQRLabel: { fontSize: 9, color: "#9ca3af", marginTop: 4 },
  certExpiredWarning: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, padding: 12, marginTop: 12 },
  certExpiredText: { flex: 1, fontSize: 12, color: "#dc2626", fontWeight: "600" },

  // Certificate List Item
  certListItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#eef0f3", elevation: 1 },
  certListItemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center" },
  certListItemTitle: { fontSize: 13, fontWeight: "600", color: "#1f2937" },
  certListItemNumber: { fontSize: 10, color: "#9ca3af", marginTop: 1 },
  certListItemDate: { fontSize: 10, color: "#6b7280" },
  certStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 16 },
  certStatusText: { fontSize: 9, fontWeight: "700" },
});
