import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  ViewStyle,
} from "react-native";
import React, { useState, useRef } from "react";
import * as Linking from "expo-linking";
import { Feather } from "@expo/vector-icons";

interface ReferenceProps {
  mediaUrls?: string[];
}

const Reference: React.FC<ReferenceProps> = ({ mediaUrls }) => {
  const [isReferenceCollapsed, setIsReferenceCollapsed] = useState(true);
  const [isImagesCollapsed, setIsImagesCollapsed] = useState(true);
  const [isVideosCollapsed, setIsVideosCollapsed] = useState(true);

  const referenceAnimation = useRef(new Animated.Value(0)).current;
  const imagesAnimation = useRef(new Animated.Value(0)).current;
  const videosAnimation = useRef(new Animated.Value(0)).current;

  // Filter media URLs
  const imageUrls =
    mediaUrls?.filter((url) =>
      url.split(".").pop()?.toLowerCase().match(/(jpg|jpeg|png|gif)/)
    ) || [];
  const videoUrls =
    mediaUrls?.filter((url) =>
      url.split(".").pop()?.toLowerCase().match(/(mp4|mov)/)
    ) || [];

  const toggleAccordion = (type: "reference" | "images" | "videos") => {
    if (type === "reference") {
      const willOpen = !isReferenceCollapsed;
      setIsReferenceCollapsed(willOpen);

      if (willOpen) {
        setIsImagesCollapsed(true);
        setIsVideosCollapsed(true);
        imagesAnimation.setValue(0);
        videosAnimation.setValue(0);
      }

      Animated.timing(referenceAnimation, {
        toValue: willOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else if (type === "images") {
      setIsImagesCollapsed(!isImagesCollapsed);
      Animated.timing(imagesAnimation, {
        toValue: isImagesCollapsed ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      setIsVideosCollapsed(!isVideosCollapsed);
      Animated.timing(videosAnimation, {
        toValue: isVideosCollapsed ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // Fix: overflow must be typed correctly
  const getAnimationStyles = (
    animation: Animated.Value
  ): Animated.WithAnimatedObject<ViewStyle> => ({
    maxHeight: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 500], // Safe upper bound
    }),
    opacity: animation,
    overflow: "hidden" as "hidden", // ✅ fixed type issue
  });

  const getFileIcon = (type: string) => {
    switch (true) {
      case type.includes("image"):
        return <Feather name="image" size={20} color="#666" />;
      case type.includes("video"):
        return <Feather name="video" size={20} color="#666" />;
      case type.includes("audio"):
        return <Feather name="music" size={20} color="#666" />;
      default:
        return <Feather name="file" size={20} color="#666" />;
    }
  };

  const getMediaType = (url: string) => {
    const extension = url.split(".").pop()?.toLowerCase() || "";
    return extension.match(/(jpg|jpeg|png|gif)/)
      ? "image"
      : extension.match(/(mp4|mov)/)
      ? "video"
      : extension.match(/(mp3|wav)/)
      ? "audio"
      : "file";
  };

  const renderMediaList = (urls: string[], type: "images" | "videos") => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.fileList}
    >
      {urls.map((url, index) => {
        const mediaType = getMediaType(url);
        return (
          <TouchableOpacity
            key={`${type}-${index}`}
            style={styles.fileItem}
            onPress={() => Linking.openURL(url)}
          >
            <View style={styles.fileIconContainer}>
              {mediaType === "image" ? (
                <Image source={{ uri: url }} style={styles.fileThumbnail} />
              ) : (
                getFileIcon(mediaType)
              )}
            </View>
            <Text style={styles.fileName} numberOfLines={1}>
              {mediaType} {index + 1}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Reference Accordion */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => toggleAccordion("reference")}
      >
        <Text style={styles.headerText}>Reference</Text>
        <Feather
          name={isReferenceCollapsed ? "chevron-down" : "chevron-up"}
          size={20}
          color="#333"
        />
      </TouchableOpacity>

      <Animated.View
        style={[styles.content, getAnimationStyles(referenceAnimation)]}
      >
        {mediaUrls && mediaUrls.length > 0 ? (
          <>
            {/* Images Accordion */}
            {imageUrls.length > 0 && (
              <View style={styles.nestedAccordion}>
                <TouchableOpacity
                  style={styles.nestedHeader}
                  onPress={() => toggleAccordion("images")}
                >
                  <Text style={styles.nestedHeaderText}>Images</Text>
                  <Feather
                    name={isImagesCollapsed ? "chevron-down" : "chevron-up"}
                    size={18}
                    color="#333"
                  />
                </TouchableOpacity>
                <Animated.View style={getAnimationStyles(imagesAnimation)}>
                  {renderMediaList(imageUrls, "images")}
                </Animated.View>
              </View>
            )}

            {/* Videos Accordion */}
            {videoUrls.length > 0 && (
              <View style={styles.nestedAccordion}>
                <TouchableOpacity
                  style={styles.nestedHeader}
                  onPress={() => toggleAccordion("videos")}
                >
                  <Text style={styles.nestedHeaderText}>Videos</Text>
                  <Feather
                    name={isVideosCollapsed ? "chevron-down" : "chevron-up"}
                    size={18}
                    color="#333"
                  />
                </TouchableOpacity>
                <Animated.View style={getAnimationStyles(videosAnimation)}>
                  {renderMediaList(videoUrls, "videos")}
                </Animated.View>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.noFilesText}>No files available</Text>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  nestedAccordion: {
    marginTop: 6,
    marginHorizontal: 15,
    marginBottom:10,
  },
  nestedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#e8e8e8",
    borderRadius: 6,
  },
  nestedHeaderText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    overflow: "hidden",
  },
  fileList: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  fileItem: {
    alignItems: "center",
    padding: 6,
    marginBottom: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 8,
    backgroundColor: "#fff",
    width: 70,
    height: 70,
  },
  fileIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  fileThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  fileName: {
    fontSize: 10,
    color: "#333",
    marginTop: 2,
    textAlign: "center",
  },
  noFilesText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    padding: 8,
  },
});

export default Reference;