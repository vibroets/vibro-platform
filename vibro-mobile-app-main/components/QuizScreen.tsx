import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services";

const getVideoProgressKey = (scheduleId: any, contentId: any, contentType: string, parentContentId?: any, parentContentType?: string) => {
  const schedPart = scheduleId != null ? `sched_${scheduleId}` : 'direct';
  const parentPart = parentContentId != null ? `_parent_${parentContentType}_${parentContentId}` : '';
  return `video_progress_${schedPart}_${contentType}_${contentId}${parentPart}`;
};
const getQuizProgressKey = (scheduleId: any, contentId: any, contentType: string, parentContentId?: any, parentContentType?: string) => {
  const schedPart = scheduleId != null ? `sched_${scheduleId}` : 'direct';
  const parentPart = parentContentId != null ? `_parent_${parentContentType}_${parentContentId}` : '';
  return `quiz_progress_${schedPart}_${contentType}_${contentId}${parentPart}`;
};

const QUESTION_TYPES = {
  MULTIPLE_CHOICE: "mcq",
  TRUE_FALSE: "truefalse",
  FILL_IN_BLANK: "fillblank",
  NPS_SCALE: "nps",
};

const shuffleArray = (array: any[]) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const prepareQuestionsForAttempt = (questions: any[]) => {
  if (!Array.isArray(questions)) return [];
  let processed = questions.map((q) => {
    let displayOptions = q.options || [];
    let optionMapping = displayOptions.map((_: any, i: number) => i);
    let correctAnswer = q.correctAnswer;

    if (q.type === QUESTION_TYPES.MULTIPLE_CHOICE || q.type === QUESTION_TYPES.TRUE_FALSE || !q.type) {
      const indices = displayOptions.map((_: any, i: number) => i);
      const shuffledIndices = shuffleArray(indices);
      displayOptions = shuffledIndices.map((i: number) => displayOptions[i]);
      optionMapping = shuffledIndices;
      if (typeof correctAnswer === "number") {
        correctAnswer = shuffledIndices.indexOf(correctAnswer);
      }
    }

    return { ...q, displayOptions, optionMapping, correctAnswer };
  });

  processed = shuffleArray(processed);
  return processed;
};

const checkAnswerCorrect = (question: any, answer: any) => {
  if (answer === null || answer === undefined || answer === "") return false;
  const qType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;

  switch (qType) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
    case QUESTION_TYPES.TRUE_FALSE:
      return Number(answer) === Number(question.correctAnswer);
    case QUESTION_TYPES.NPS_SCALE:
      if (question.correctAnswer === null || question.correctAnswer === undefined) return true;
      return Number(answer) === Number(question.correctAnswer);
    case QUESTION_TYPES.FILL_IN_BLANK: {
      const userAnswer = String(answer).trim();
      const correctText = String(question.correctText || "").trim();
      if (!correctText) return true;
      if (question.caseSensitive) return correctText === userAnswer;
      return correctText.toLowerCase() === userAnswer.toLowerCase();
    }
    default:
      return Number(answer) === Number(question.correctAnswer);
  }
};

const calculateScore = (questions: any[], answers: any[]) => {
  if (!questions.length) return 0;
  let correct = 0;
  let scorable = 0;
  questions.forEach((q, i) => {
    const answer = answers[i];
    if (answer === null || answer === undefined || answer === "") return;
    if (q.type === QUESTION_TYPES.NPS_SCALE && (q.correctAnswer === null || q.correctAnswer === undefined)) return;
    if (q.type === QUESTION_TYPES.FILL_IN_BLANK && !String(q.correctText || "").trim()) return;
    scorable++;
    if (checkAnswerCorrect(q, answer)) correct++;
  });
  if (scorable === 0) return 0;
  return Math.round((correct / scorable) * 100);
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface QuizScreenProps {
  item: any;
  scheduleId?: any;
  onBack: () => void;
  onQuizComplete?: (score: number, passed: boolean) => void;
}

export default function QuizScreen({ item, scheduleId, onBack, onQuizComplete }: QuizScreenProps) {
  const [quizData, setQuizData] = useState<any>(item);
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(1800);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [quizUnlocked, setQuizUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalCorrect, setFinalCorrect] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showLockedMsg, setShowLockedMsg] = useState(false);
  const [resumePosition, setResumePosition] = useState(0);
  const timerRef = useRef<any>(null);
  const lockedMsgTimer = useRef<any>(null);
  const progressSaveTimer = useRef<any>(null);
  const quizRestored = useRef(false);

  useEffect(() => {
    if (item.id && item.type) {
      AsyncStorage.getItem(getVideoProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType)).then((val: string | null) => {
        if (val) {
          const p = parseFloat(val);
          if (p > 0 && p < 95) setResumePosition(p);
        }
      });
    }
  }, [item.id, item.type, scheduleId]);

  useEffect(() => {
    const questions = item.questions || [];
    const questionsToUse = Math.min(item.questions_per_user || questions.length, questions.length);
    const prepared = prepareQuestionsForAttempt(questions);
    const selected = prepared.slice(0, questionsToUse);
    setShuffledQuestions(selected);
    setAnswers(new Array(selected.length).fill(null));
    setTimeRemaining((item.time_limit || 30) * 60);

    const videoUrl = item.video_url || item.video_file || item.content_url || item.file_url || item.file;
    if (videoUrl && (item.type === "video" || item.type === "training")) {
      if (item.video_already_completed) {
        setShowVideo(false);
        setVideoCompleted(true);
        setQuizUnlocked(true);
        setQuizStarted(true);
      } else {
        setShowVideo(true);
        setVideoCompleted(false);
      }
    } else {
      setShowVideo(false);
      setVideoCompleted(true);
    }

    // Restore saved quiz progress
    if (item.id && item.type) {
      AsyncStorage.getItem(getQuizProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType)).then((val: string | null) => {
        if (val) {
          try {
            const saved = JSON.parse(val);
            if (saved.savedQuestions && Array.isArray(saved.savedQuestions) && saved.savedQuestions.length > 0 && saved.answers && Array.isArray(saved.answers) && saved.savedQuestions.length === saved.answers.length) {
              setShuffledQuestions(saved.savedQuestions);
              setAnswers(saved.answers);
              if (saved.currentIndex != null && saved.currentIndex >= 0 && saved.currentIndex < saved.savedQuestions.length) {
                setCurrentQuestionIndex(saved.currentIndex);
              }
              if (saved.timeRemaining != null && saved.timeRemaining > 0) {
                setTimeRemaining(saved.timeRemaining);
              }
              if (item.video_already_completed || !videoUrl || !(item.type === "video" || item.type === "training")) {
                setQuizStarted(true);
              }
            }
          } catch (e) {}
        }
        quizRestored.current = true;
      });
    } else {
      quizRestored.current = true;
    }
  }, [item]);

  useEffect(() => {
    if (quizStarted && !quizCompleted && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [quizStarted, quizCompleted, timeRemaining]);

  // Save quiz progress to AsyncStorage
  useEffect(() => {
    if (!quizRestored.current || quizCompleted) return;
    if (item.id && item.type && shuffledQuestions.length > 0) {
      AsyncStorage.setItem(getQuizProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType), JSON.stringify({
        savedQuestions: shuffledQuestions,
        answers,
        currentIndex: currentQuestionIndex,
        timeRemaining,
      }));
    }
  }, [answers, currentQuestionIndex, timeRemaining, quizCompleted, item.id, item.type, scheduleId, shuffledQuestions]);

  const handleAnswerChange = (index: number, value: any) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    const currentAnswer = answers[currentQuestionIndex];
    if (!quizData?.allow_skip_questions && (currentAnswer === null || currentAnswer === undefined || currentAnswer === "")) {
      Alert.alert("Required", "Please answer this question before proceeding.");
      return;
    }
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = useCallback(() => {
    const unanswered = shuffledQuestions.filter((_, i) => answers[i] === null || answers[i] === undefined || answers[i] === "").length;
    if (unanswered > 0 && !quizCompleted) {
      Alert.alert(
        "Unanswered Questions",
        `You have ${unanswered} unanswered question(s). Submit anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", onPress: () => doSubmit() },
        ]
      );
    } else {
      doSubmit();
    }
  }, [shuffledQuestions, answers, quizCompleted]);

  const doSubmit = async () => {
    setQuizCompleted(true);
    if (item.id && item.type) {
      AsyncStorage.removeItem(getQuizProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType));
    }
    const score = calculateScore(shuffledQuestions, answers);
    const correctAnswers = Math.round((score / 100) * shuffledQuestions.length);
    setFinalScore(score);
    setFinalCorrect(correctAnswers);

    const timeTaken = (quizData.time_limit || 30) * 60 - timeRemaining;
    setSubmitting(true);
    try {
      await api.post("/learning/courses/submit-quiz-result/", {
        content_type: item.type,
        content_id: item.id,
        content_title: item.title,
        schedule_id: item._progressScheduleId || undefined,
        score,
        correct_answers: correctAnswers,
        total_questions: shuffledQuestions.length,
        time_taken: timeTaken,
        answers,
        questions: shuffledQuestions,
        pass_percentage: quizData.pass_percentage || 70,
      });
    } catch (e: any) {
      console.error("Failed to submit quiz result:", e?.message);
    } finally {
      setSubmitting(false);
      if (onQuizComplete) {
        const passThreshold = quizData?.pass_percentage || 70;
        onQuizComplete(score, score >= passThreshold);
      }
    }
  };

  const startQuiz = () => {
    if (!showVideo || videoCompleted) {
      setQuizStarted(true);
    }
  };

  const onVideoComplete = () => {
    setVideoCompleted(true);
    setQuizStarted(true);
  };

  const handleWebViewMessage = (event: any) => {
    const data = event.nativeEvent.data;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "progress") {
        setVideoProgress(parsed.progress);
        if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
        progressSaveTimer.current = setTimeout(() => {
          if (item.id && item.type && parsed.progress < 95) {
            AsyncStorage.setItem(getVideoProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType), String(parsed.progress));
          }
        }, 500);
        if (parsed.progress >= 95 && !quizUnlocked) {
          setQuizUnlocked(true);
          if (item.id && item.type) AsyncStorage.removeItem(getVideoProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType));
          const hasQuestions = item.questions && Array.isArray(item.questions) && item.questions.length > 0;
          if ((item.type === "video" || item.type === "training") && !hasQuestions) {
            api.post("/learning/courses/submit-quiz-result/", {
              content_type: item.type,
              content_id: item.id,
              content_title: item.title || "",
              score: 100,
              correct_answers: 0,
              total_questions: 0,
              time_taken: 0,
              answers: [],
              questions: [],
              pass_percentage: 0,
            }).catch(() => {});
          }
        }
      } else if (parsed.type === "locked") {
        setShowLockedMsg(true);
        if (lockedMsgTimer.current) clearTimeout(lockedMsgTimer.current);
        lockedMsgTimer.current = setTimeout(() => setShowLockedMsg(false), 2000);
      } else if (parsed.type === "unlocked") {
        setQuizUnlocked(true);
        if (item.id && item.type) AsyncStorage.removeItem(getVideoProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType));
      } else if (parsed.type === "ended") {
        setVideoCompleted(true);
        setQuizUnlocked(true);
        setQuizStarted(true);
        if (item.id && item.type) AsyncStorage.removeItem(getVideoProgressKey(item._progressScheduleId, item.id, item.type, item.parentContentId, item.parentContentType));
      }
    } catch (e) {}
  };

  const buildRestrictedVideoHtml = (videoUrl: string) => {
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
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'ended'}));
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

  // --- VIDEO SECTION ---
  if (showVideo && !videoCompleted) {
    const url = quizData.video_url || quizData.video_file || quizData.content_url || quizData.file_url || quizData.file;
    const fullUrl = url && !url.startsWith("http") ? `http://10.76.2.239:8000${url}` : url;
    const isYouTube = fullUrl && fullUrl.includes("youtu");
    const videoReady = quizUnlocked;

    let youtubeVideoId = "";
    if (isYouTube && fullUrl) {
      const match = fullUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
      youtubeVideoId = match ? match[1] : "";
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.videoHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.videoTitle} numberOfLines={1}>{quizData.title}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {isYouTube ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: buildYouTubeHtml(youtubeVideoId) }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              startInLoadingState={true}
              onMessage={handleWebViewMessage}
              renderLoading={() => (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              )}
            />
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={{ html: buildRestrictedVideoHtml(fullUrl || "") }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              startInLoadingState={true}
              onMessage={handleWebViewMessage}
              renderLoading={() => (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              )}
            />
          )}
        </View>
        <View style={styles.videoFooter}>
          <View style={styles.progressRow}>
            <Text style={styles.progressFooterText}>Progress: {Math.round(videoProgress)}%</Text>
            <Text style={styles.progressHintText}>
              {videoReady ? "Quiz unlocked - tap to start" : "Watch 95% to unlock quiz"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.startQuizBtn, !videoReady && styles.startQuizBtnLocked]}
            onPress={onVideoComplete}
            disabled={!videoReady}
          >
            <Text style={styles.startQuizBtnText}>
              {videoReady ? "Start Quiz" : "🔒 Locked"}
            </Text>
            {videoReady && <Ionicons name="arrow-forward" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- RESULTS SCREEN ---
  if (quizCompleted) {
    const passThreshold = quizData?.pass_percentage || 70;
    const hasPassed = finalScore >= passThreshold;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: hasPassed ? "#d1fae5" : "#fee2e2" }]}>
            <Ionicons name={hasPassed ? "checkmark-circle" : "close-circle"} size={48} color={hasPassed ? "#059669" : "#dc2626"} />
          </View>
          <Text style={styles.resultTitle}>{hasPassed ? "Congratulations!" : "Quiz Completed"}</Text>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Your Score</Text>
            <Text style={[styles.scoreValue, { color: hasPassed ? "#059669" : "#dc2626" }]}>{finalScore}%</Text>
            <Text style={styles.scorePass}>Pass: {passThreshold}%</Text>
          </View>
          <View style={styles.resultStats}>
            <View style={styles.resultStatBox}>
              <Text style={styles.resultStatLabel}>Correct</Text>
              <Text style={styles.resultStatValue}>{finalCorrect}/{shuffledQuestions.length}</Text>
            </View>
            <View style={styles.resultStatBox}>
              <Text style={styles.resultStatLabel}>Time</Text>
              <Text style={styles.resultStatValue}>{formatTime((quizData?.time_limit || 30) * 60 - timeRemaining)}</Text>
            </View>
          </View>
          {submitting && <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 12 }} />}
          <TouchableOpacity style={styles.resultBackBtn} onPress={onBack}>
            <Text style={styles.resultBackBtnText}>Back to Learn</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- START SCREEN ---
  if (!quizStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.quizHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.quizHeaderTitle} numberOfLines={1}>{quizData?.title}</Text>
        </View>
        <ScrollView contentContainerStyle={{ flex: 1, justifyContent: "center", padding: 20 }}>
          <View style={styles.startCard}>
            <View style={styles.startIcon}>
              <Ionicons name="help-circle-outline" size={40} color="#3b82f6" />
            </View>
            <Text style={styles.startTitle}>Ready to Start?</Text>
            <Text style={styles.startDesc}>
              You will answer {shuffledQuestions.length} questions in {quizData?.time_limit || 30} minutes.
            </Text>
            <View style={styles.startStats}>
              <View style={styles.startStatBox}>
                <Text style={styles.startStatLabel}>Questions</Text>
                <Text style={styles.startStatValue}>{shuffledQuestions.length}</Text>
              </View>
              <View style={styles.startStatBox}>
                <Text style={styles.startStatLabel}>Time Limit</Text>
                <Text style={styles.startStatValue}>{quizData?.time_limit || 30} min</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.startBtnLarge} onPress={startQuiz}>
              <Text style={styles.startBtnLargeText}>Start Quiz</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- QUESTION SCREEN ---
  const question = shuffledQuestions[currentQuestionIndex];
  if (!question) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyQuiz}>
          <Text style={styles.emptyQuizText}>No questions available for this quiz.</Text>
          <TouchableOpacity style={styles.resultBackBtn} onPress={onBack}>
            <Text style={styles.resultBackBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const qType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
  const currentAnswer = answers[currentQuestionIndex];

  const renderQuestionInput = () => {
    if (qType === QUESTION_TYPES.MULTIPLE_CHOICE || qType === QUESTION_TYPES.TRUE_FALSE) {
      const options = question.displayOptions || question.options || [];
      return (
        <View style={styles.optionsContainer}>
          {options.map((option: string, optionIndex: number) => (
            <TouchableOpacity
              key={optionIndex}
              style={[
                styles.optionCard,
                currentAnswer === optionIndex && styles.optionCardSelected,
              ]}
              onPress={() => handleAnswerChange(currentQuestionIndex, optionIndex)}
            >
              <View style={[styles.optionRadio, currentAnswer === optionIndex && styles.optionRadioSelected]}>
                {currentAnswer === optionIndex && <View style={styles.optionRadioInner} />}
              </View>
              <Text style={styles.optionText}>{option || `Option ${optionIndex + 1}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (qType === QUESTION_TYPES.FILL_IN_BLANK) {
      return (
        <TextInput
          style={styles.textInput}
          value={currentAnswer || ""}
          onChangeText={(text) => handleAnswerChange(currentQuestionIndex, text)}
          placeholder="Type your answer"
          placeholderTextColor="#999"
        />
      );
    }

    if (qType === QUESTION_TYPES.NPS_SCALE) {
      const min = Number(question.npsMin ?? 0);
      const max = Number(question.npsMax ?? 10);
      const minLabel = question.scaleMinLabel || "Not at all likely";
      const maxLabel = question.scaleMaxLabel || "Extremely likely";
      const values: number[] = [];
      for (let i = min; i <= max; i++) values.push(i);
      return (
        <View>
          <View style={styles.npsContainer}>
            {values.map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.npsButton,
                  Number(currentAnswer) === val && styles.npsButtonSelected,
                ]}
                onPress={() => handleAnswerChange(currentQuestionIndex, val)}
              >
                <Text style={[styles.npsText, Number(currentAnswer) === val && styles.npsTextSelected]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.npsLabels}>
            <Text style={styles.npsLabelText}>{minLabel}</Text>
            <Text style={styles.npsLabelText}>{maxLabel}</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.quizHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.quizHeaderTitle} numberOfLines={1}>{quizData?.title}</Text>
        <View style={styles.timerContainer}>
          <Ionicons name="time-outline" size={16} color={timeRemaining < 300 ? "#dc2626" : "#666"} />
          <Text style={[styles.timerText, timeRemaining < 300 && styles.timerWarning]}>
            {formatTime(timeRemaining)}
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>Q{currentQuestionIndex + 1} of {shuffledQuestions.length}</Text>
          <Text style={styles.progressPercent}>
            {Math.round(((currentQuestionIndex + 1) / shuffledQuestions.length) * 100)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentQuestionIndex + 1) / shuffledQuestions.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.questionText}>{question.question || "Question not available"}</Text>
        {renderQuestionInput()}
      </ScrollView>

      <View style={styles.navContainer}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnSecondary, currentQuestionIndex === 0 && styles.navBtnDisabled]}
          onPress={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
        >
          <Text style={styles.navBtnSecondaryText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnPrimary]}
          onPress={handleNextQuestion}
        >
          <Text style={styles.navBtnPrimaryText}>
            {currentQuestionIndex === shuffledQuestions.length - 1 ? "Submit Quiz" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },

  // Video
  videoHeader: { height: 50, backgroundColor: "#111", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  videoTitle: { color: "#fff", fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 },
  videoFooter: { backgroundColor: "#1a1a1a", padding: 16, alignItems: "center" },
  videoFooterText: { color: "#aaa", fontSize: 12, marginBottom: 10 },
  startQuizBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3b82f6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  startQuizBtnLocked: { backgroundColor: "#374151", opacity: 0.7 },
  startQuizBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  lockedToast: { position: "absolute", top: 20, left: "50%", transform: [{ translateX: -120 }], flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(220,38,38,0.95)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, zIndex: 9999 },
  lockedToastText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 10 },
  progressFooterText: { color: "#3b82f6", fontSize: 13, fontWeight: "700" },
  progressHintText: { color: "#9ca3af", fontSize: 11 },

  // Header
  quizHeader: { height: 55, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderColor: "#eee" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 5 },
  backBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  quizHeaderTitle: { fontSize: 15, fontWeight: "600", color: "#333", flex: 1, marginLeft: 8 },
  timerContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerText: { fontSize: 13, color: "#666", fontWeight: "600" },
  timerWarning: { color: "#dc2626", fontWeight: "bold" },

  // Progress
  progressContainer: { padding: 12, backgroundColor: "#fff" },
  progressInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressText: { fontSize: 12, color: "#666" },
  progressPercent: { fontSize: 12, color: "#666" },
  progressBar: { height: 4, backgroundColor: "#e5e7eb", borderRadius: 2 },
  progressBarFill: { height: 4, backgroundColor: "#3b82f6", borderRadius: 2 },

  // Question
  questionText: { fontSize: 17, fontWeight: "600", color: "#1f2937", marginBottom: 20, lineHeight: 24 },

  // Options
  optionsContainer: { gap: 10 },
  optionCard: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, backgroundColor: "#fff" },
  optionCardSelected: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  optionRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#d1d5db", marginRight: 12, justifyContent: "center", alignItems: "center" },
  optionRadioSelected: { borderColor: "#3b82f6" },
  optionRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3b82f6" },
  optionText: { fontSize: 15, color: "#1f2937", flex: 1, fontWeight: "500" },

  // Text Input
  textInput: { borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: "#fff", color: "#1f2937" },

  // NPS
  npsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 },
  npsButton: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: "#d1d5db", backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  npsButtonSelected: { borderColor: "#3b82f6", backgroundColor: "#3b82f6" },
  npsText: { fontSize: 15, fontWeight: "700", color: "#374151" },
  npsTextSelected: { color: "#fff" },
  npsLabels: { flexDirection: "row", justifyContent: "space-between" },
  npsLabelText: { fontSize: 11, color: "#6b7280" },

  // Navigation
  navContainer: { flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#eee" },
  navBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  navBtnPrimary: { backgroundColor: "#3b82f6" },
  navBtnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  navBtnSecondary: { backgroundColor: "#e5e7eb" },
  navBtnSecondaryText: { color: "#374151", fontSize: 14, fontWeight: "600" },
  navBtnDisabled: { opacity: 0.4 },

  // Start Screen
  startCard: { backgroundColor: "#fff", borderRadius: 16, padding: 28, alignItems: "center", elevation: 2 },
  startIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#dbeafe", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  startTitle: { fontSize: 22, fontWeight: "bold", color: "#1f2937", marginBottom: 8 },
  startDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 20 },
  startStats: { flexDirection: "row", gap: 12, marginBottom: 24, width: "100%" },
  startStatBox: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 10, padding: 14, alignItems: "center" },
  startStatLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  startStatValue: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  startBtnLarge: { backgroundColor: "#3b82f6", paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, width: "100%", alignItems: "center" },
  startBtnLargeText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Results
  resultContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  resultTitle: { fontSize: 24, fontWeight: "bold", color: "#1f2937", marginBottom: 20 },
  scoreCard: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 20, alignItems: "center", width: "100%", marginBottom: 16 },
  scoreLabel: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  scoreValue: { fontSize: 36, fontWeight: "bold" },
  scorePass: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  resultStats: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 24 },
  resultStatBox: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 10, padding: 14, alignItems: "center" },
  resultStatLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  resultStatValue: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
  resultBackBtn: { backgroundColor: "#3b82f6", paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, width: "100%", alignItems: "center" },
  resultBackBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Empty
  emptyQuiz: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyQuizText: { fontSize: 15, color: "#6b7280", marginBottom: 20 },

  // Loader
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
});
